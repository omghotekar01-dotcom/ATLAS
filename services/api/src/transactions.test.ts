import { describe, expect, it } from "vitest";
import { encodeFunctionData, parseAbi, toEventSelector } from "viem";
import type { ChainTransaction } from "@atlas/chain";
import { ChainIdSchema, HashSchema, NotFoundError, UpstreamUnavailableError } from "@atlas/schemas";

import { createApp } from "./app-factory.js";
import {
  chainStore,
  eventRecord,
  fakeReader,
  functionRecord,
  makeDependencies,
  memoryEvents,
  memoryFunctions,
} from "./test-support.js";

const HASH = `0x${"a".repeat(64)}`;
const FROM = "0x0000000000000000000000000000000000000001";
const CONTRACT = "0x0000000000000000000000000000000000000002";
const SELECTOR = "0xa9059cbb";

const TRANSFER_EVENT = "Transfer(address,address,uint256)";
const TRANSFER_TOPIC = toEventSelector(TRANSFER_EVENT);
const padded = (address: string) => `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;

const calldata = encodeFunctionData({
  abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
  functionName: "transfer",
  args: [CONTRACT, 42n],
});

const transferLog = {
  address: CONTRACT,
  topics: [TRANSFER_TOPIC, padded(FROM), padded(CONTRACT)],
  data: `0x${42n.toString(16).padStart(64, "0")}`,
};

function transaction(overrides: Record<string, unknown> = {}): ChainTransaction {
  return {
    hash: HashSchema.parse(HASH),
    chainId: ChainIdSchema.parse(1),
    from: FROM,
    to: CONTRACT,
    input: calldata,
    blockNumber: 16,
    ...overrides,
  };
}

function dependencies(
  options: {
    receipt?: unknown;
    readerOverrides?: Parameters<typeof fakeReader>[0];
    functions?: ReturnType<typeof memoryFunctions>;
  } = {},
) {
  const reader = fakeReader({
    getTransaction: async () => transaction(),
    getReceipt: async () =>
      options.receipt === undefined
        ? { status: "success", blockNumber: 16, logs: [transferLog] }
        : (options.receipt as never),
    ...options.readerOverrides,
  });

  return makeDependencies({
    functions:
      options.functions ??
      memoryFunctions([functionRecord("transfer(address,uint256)", SELECTOR, "a")]),
    events: memoryEvents([eventRecord(TRANSFER_EVENT, TRANSFER_TOPIC, "b", [true, true, false])]),
    chains: chainStore(new Map([[1, reader]])),
  });
}

async function analyze(payload: unknown, deps = dependencies()) {
  const app = createApp({ dependencies: deps, rateLimitPerMinute: 0, upstreamTimeoutMs: 2_000 });
  return app.inject({
    method: "POST",
    url: "/v1/transactions/analyze",
    payload: payload as object,
  });
}

describe("POST /v1/transactions/analyze", () => {
  it("separates RPC facts, canonical candidates and decoded calldata", async () => {
    const response = await analyze({ chainId: 1, hash: HASH });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body) as {
      transaction: { source: string; hash: string; chainId: number };
      receipt: { status: string; source: string };
      functionLookup: { candidates: unknown[] };
      functionDecode: { decoded: { decodeStatus: string; arguments: { value: unknown }[] }[] };
      eventResults: { decoded: { decodeStatus: string }[] }[];
      limitations: string[];
      warnings: string[];
    };

    expect(payload.transaction).toMatchObject({ source: "rpc", hash: HASH, chainId: 1 });
    expect(payload.receipt).toMatchObject({ status: "success", source: "rpc" });
    expect(payload.functionLookup.candidates).toHaveLength(1);
    expect(payload.functionDecode.decoded[0]).toMatchObject({ decodeStatus: "success" });
    expect(payload.functionDecode.decoded[0]?.arguments[1]?.value).toBe("42");
    expect(payload.eventResults[0]?.decoded[0]).toMatchObject({ decodeStatus: "success" });
    expect(payload.limitations.length).toBeGreaterThan(0);
    expect(payload.warnings).toEqual([]);
  });

  it("reports a reverted transaction without hiding the receipt", async () => {
    const response = await analyze(
      { chainId: 1, hash: HASH },
      dependencies({ receipt: { status: "reverted", blockNumber: 16, logs: [] } }),
    );

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body) as {
      receipt: { status: string };
      warnings: string[];
    };
    expect(payload.receipt.status).toBe("reverted");
    expect(payload.warnings.join(" ")).toMatch(/reverted/i);
  });

  it("reports a pending transaction with a null receipt", async () => {
    const response = await analyze({ chainId: 1, hash: HASH }, dependencies({ receipt: null }));

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body) as { receipt: unknown; warnings: string[] };
    expect(payload.receipt).toBeNull();
    expect(payload.warnings.join(" ")).toMatch(/pending/i);
  });

  it("returns 404 for an unknown transaction", async () => {
    const response = await analyze(
      { chainId: 1, hash: HASH },
      dependencies({
        readerOverrides: {
          getTransaction: async () => {
            throw new NotFoundError("Transaction was not found.");
          },
        },
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("returns 404 for an unsupported chain", async () => {
    const response = await analyze({ chainId: 137, hash: HASH });

    expect(response.statusCode).toBe(404);
    const payload = JSON.parse(response.body) as { error: { message: string } };
    expect(payload.error.message).toMatch(/not supported/);
  });

  it("returns 502 when no RPC is configured", async () => {
    const response = await analyze(
      { chainId: 1, hash: HASH },
      makeDependencies({
        chains: {
          get() {
            throw new UpstreamUnavailableError(
              "No RPC endpoint is configured for Ethereum Mainnet.",
            );
          },
        },
      }),
    );

    expect(response.statusCode).toBe(502);
    expect(JSON.parse(response.body)).toMatchObject({
      error: { code: "UPSTREAM_UNAVAILABLE" },
    });
  });

  it("returns 502 for an RPC outage", async () => {
    const response = await analyze(
      { chainId: 1, hash: HASH },
      dependencies({
        readerOverrides: {
          getTransaction: async () => {
            throw new UpstreamUnavailableError("The RPC endpoint failed.");
          },
        },
      }),
    );

    expect(response.statusCode).toBe(502);
  });

  it("reports an unknown function without inventing a match", async () => {
    const response = await analyze(
      { chainId: 1, hash: HASH },
      dependencies({ functions: memoryFunctions([]) }),
    );

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body) as {
      functionLookup: { candidates: unknown[]; ambiguous: boolean };
      functionDecode: { decoded: unknown[]; warnings: string[] };
      warnings: string[];
    };
    expect(payload.functionLookup).toMatchObject({ candidates: [], ambiguous: false });
    expect(payload.functionDecode.decoded).toEqual([]);
    expect(payload.functionDecode.warnings.join(" ")).toMatch(/No canonical signature/);
    expect(payload.warnings).toEqual([]);
  });

  it("still reports on-chain facts when the registry is offline", async () => {
    const response = await analyze(
      { chainId: 1, hash: HASH },
      dependencies({
        functions: {
          ...memoryFunctions([]),
          findBySelector: async () => {
            throw new UpstreamUnavailableError("Rabdi is unreachable.");
          },
        },
      }),
    );

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body) as {
      transaction: { source: string };
      functionLookup: unknown;
      functionDecode: unknown;
      warnings: string[];
    };
    expect(payload.transaction.source).toBe("rpc");
    expect(payload.functionLookup).toBeNull();
    expect(payload.functionDecode).toBeNull();
    expect(payload.warnings.join(" ")).toMatch(/Signature lookup is unavailable/);
  });

  it("handles contract creation and empty calldata", async () => {
    const creation = await analyze(
      { chainId: 1, hash: HASH },
      dependencies({
        readerOverrides: {
          getTransaction: async () => transaction({ to: null, input: "0x6080" }),
        },
      }),
    );
    expect(creation.statusCode).toBe(200);
    const creationPayload = JSON.parse(creation.body) as {
      functionLookup: unknown;
      limitations: string[];
    };
    expect(creationPayload.functionLookup).toBeNull();
    expect(creationPayload.limitations.join(" ")).toMatch(/contract-creation/);

    const empty = await analyze(
      { chainId: 1, hash: HASH },
      dependencies({
        readerOverrides: { getTransaction: async () => transaction({ input: "0x" }) },
      }),
    );
    expect(empty.statusCode).toBe(200);
    const emptyPayload = JSON.parse(empty.body) as {
      functionLookup: unknown;
      limitations: string[];
    };
    expect(emptyPayload.functionLookup).toBeNull();
    expect(emptyPayload.limitations.join(" ")).toMatch(/empty calldata/);
  });

  it("preserves colliding candidates and partial decode outcomes", async () => {
    const response = await analyze(
      { chainId: 1, hash: HASH },
      dependencies({
        functions: memoryFunctions([
          functionRecord("transfer(address,uint256)", SELECTOR, "a"),
          functionRecord("many_msg_babbage(bytes1)", SELECTOR, "b", "ethereum/ERCs"),
        ]),
      }),
    );

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body) as {
      functionLookup: { ambiguous: boolean; candidates: unknown[] };
      functionDecode: { ambiguous: boolean; decoded: { decodeStatus: string }[] };
    };
    expect(payload.functionLookup.ambiguous).toBe(true);
    expect(payload.functionLookup.candidates).toHaveLength(2);
    expect(payload.functionDecode.ambiguous).toBe(true);
    expect(payload.functionDecode.decoded.map((attempt) => attempt.decodeStatus)).toEqual([
      "success",
      "failed",
    ]);
  });

  it("keeps going when one log has an incorrect or unknown topic", async () => {
    const unknownLog = {
      address: CONTRACT,
      topics: [`0x${"9".repeat(64)}`],
      data: "0x",
    };
    const response = await analyze(
      { chainId: 1, hash: HASH },
      dependencies({
        receipt: { status: "success", blockNumber: 16, logs: [transferLog, unknownLog] },
      }),
    );

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body) as {
      eventResults: { topic0: string; decoded: { decodeStatus: string }[]; warnings: string[] }[];
    };
    expect(payload.eventResults).toHaveLength(2);
    expect(payload.eventResults[0]?.decoded[0]).toMatchObject({ decodeStatus: "success" });
    expect(payload.eventResults[1]?.decoded).toEqual([]);
    expect(payload.eventResults[1]?.warnings.join(" ")).toMatch(/No canonical event signature/);
  });

  it("rejects malformed analysis requests", async () => {
    const response = await analyze({ chainId: 1, hash: "0x1234" });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({ error: { code: "INVALID_INPUT" } });
  });
});
