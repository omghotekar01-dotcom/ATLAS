import { describe, expect, it } from "vitest";

import { canonicalType, extractFromSolidity, extractProject } from "./solidity.js";
import { OPENZEPPELIN_SOURCE } from "./sources.js";

function extract(source: string) {
  return extractFromSolidity(source, "Example.sol", OPENZEPPELIN_SOURCE);
}

const TRANSFER_SELECTOR = "0xa9059cbb";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

describe("Solidity signature extraction", () => {
  it("canonicalizes aliases, arrays and payable addresses into ABI types", () => {
    const result = extract(`
      pragma solidity ^0.8.24;
      contract Types {
        function canonical(
          uint amount,
          int delta,
          address payable recipient,
          uint256[2] calldata pair,
          bytes32[] memory hashes,
          byte one
        ) external {}
      }
    `);

    expect(result.rejections).toEqual([]);
    expect(result.functions.map((entry) => entry.signature)).toEqual([
      "canonical(uint256,int256,address,uint256[2],bytes32[],bytes1)",
    ]);
    expect(result.functions[0]?.selector).toMatch(/^0x[0-9a-f]{8}$/);
  });

  it("keeps only external and public named functions", () => {
    const result = extract(`
      pragma solidity ^0.8.24;
      abstract contract Visibility {
        function externalEntry() external {}
        function publicEntry() public {}
        function internalEntry() internal {}
        function privateEntry() private {}
        constructor() {}
        fallback() external {}
        receive() external payable {}
      }
    `);

    expect(result.functions.map((entry) => entry.signature).sort()).toEqual([
      "externalEntry()",
      "publicEntry()",
    ]);
  });

  it("computes verified selectors and preserves a real selector collision", () => {
    const result = extract(`
      pragma solidity ^0.8.24;
      interface IKnown {
        function transfer(address to, uint256 amount) external;
        function many_msg_babbage(bytes1 value) external;
      }
    `);

    const selectors = Object.fromEntries(
      result.functions.map((entry) => [entry.signature, entry.selector]),
    );
    expect(selectors["transfer(address,uint256)"]).toBe(TRANSFER_SELECTOR);
    expect(selectors["many_msg_babbage(bytes1)"]).toBe(TRANSFER_SELECTOR);
    expect(result.functions).toHaveLength(2);
  });

  it("excludes indexed markers from event signatures and records the line", () => {
    const result = extract(`
      pragma solidity ^0.8.24;
      interface IEvents {
        event Transfer(address indexed from, address indexed to, uint256 value);
      }
    `);

    expect(result.rejections).toEqual([]);
    expect(result.events).toEqual([
      {
        kind: "event",
        topic0: TRANSFER_TOPIC,
        signature: "Transfer(address,address,uint256)",
        source: OPENZEPPELIN_SOURCE.repo,
        sourceId: `${OPENZEPPELIN_SOURCE.commitSha}:Example.sol:4:Transfer(address,address,uint256)`,
      },
    ]);
  });

  it("resolves contract, enum, user-defined value and struct types to ABI types", () => {
    const result = extract(`
      pragma solidity ^0.8.24;
      interface IERC20 { function balanceOf(address) external view returns (uint256); }
      enum Status { None, Active }
      type Price is uint128;
      struct Point { uint256 x; uint256 y; }

      contract Resolved {
        function tokens(IERC20 token, address payable to) external {}
        function status(Status value) external {}
        function price(Price value) external {}
        function move(Point memory point, Point[] memory path) external {}
      }
    `);

    expect(result.rejections).toEqual([]);
    expect(result.functions.map((entry) => entry.signature).sort()).toEqual([
      "balanceOf(address)",
      "move((uint256,uint256),(uint256,uint256)[])",
      "price(uint128)",
      "status(uint8)",
      "tokens(address,address)",
    ]);
  });

  it("resolves a type declared in another file of the same project", () => {
    const result = extractProject(
      [
        {
          path: "interfaces/IERC20.sol",
          content: `
            pragma solidity ^0.8.24;
            interface IERC20 {
              function balanceOf(address owner) external view returns (uint256);
            }
          `,
        },
        {
          path: "Vault.sol",
          content: `
            pragma solidity ^0.8.24;
            import {IERC20} from "./interfaces/IERC20.sol";
            contract Vault {
              function deposit(IERC20 token, uint256 amount) external {}
            }
          `,
        },
      ],
      OPENZEPPELIN_SOURCE,
    );

    expect(result.rejections).toEqual([]);
    expect(result.functions.map((entry) => entry.signature).sort()).toEqual([
      "balanceOf(address)",
      "deposit(address,uint256)",
    ]);
  });

  it("rejects unresolved, recursive and ambiguous types instead of guessing", () => {
    const result = extract(`
      pragma solidity ^0.8.24;
      contract Unsupported {
        struct Node { uint256 value; Node[] children; }
        function recursive(Node memory node) external {}
        function unknown(Missing memory value) external {}
        function callback(function(uint256) external returns (uint256) fn) external {}
        function constantLength(uint256[N] calldata values) external {}
      }
    `);

    expect(result.functions).toEqual([]);
    expect(result.rejections).toHaveLength(4);
    const reasons = result.rejections.map((entry) => entry.reason).join("\n");
    expect(reasons).toContain('struct "Node" is recursive');
    expect(reasons).toContain('unknown user-defined type "Missing"');
    expect(reasons).toContain("function types");
    expect(reasons).toContain("array length is not a numeric literal");
  });

  it("rejects a struct declared with conflicting shapes across files", () => {
    const result = extractProject(
      [
        { path: "A.sol", content: "pragma solidity ^0.8.24; struct Payload { uint256 a; }" },
        { path: "B.sol", content: "pragma solidity ^0.8.24; struct Payload { address a; }" },
        {
          path: "C.sol",
          content:
            "pragma solidity ^0.8.24; contract C { function use(Payload memory p) external {} }",
        },
      ],
      OPENZEPPELIN_SOURCE,
    );

    expect(result.functions).toEqual([]);
    expect(result.rejections[0]?.reason).toContain('"Payload" is declared with conflicting shapes');
  });

  it("reports a parse failure instead of throwing", () => {
    const result = extract("contract Broken { function oops( external {}");

    expect(result.functions).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.rejections[0]).toMatchObject({ kind: "file", filePath: "Example.sol" });
  });

  it("is deterministic for the same file content", () => {
    const source = `
      pragma solidity ^0.8.24;
      interface IDeterministic {
        event Ping(address indexed from);
        function ping(address to) external;
      }
    `;

    expect(extract(source)).toEqual(extract(source));
  });
});

describe("canonicalType", () => {
  it("rejects a missing type name", () => {
    expect(canonicalType(null)).toEqual({
      ok: false,
      reason: "parameter has no resolvable type name",
    });
  });

  it("rejects a fixed array with a non-positive length", () => {
    expect(
      canonicalType({
        type: "ArrayTypeName",
        baseTypeName: { type: "ElementaryTypeName", name: "uint", stateMutability: null },
        length: { type: "NumberLiteral", number: "0", subdenomination: null },
      }),
    ).toEqual({ ok: false, reason: 'array length "0" is not a positive integer literal' });
  });
});
