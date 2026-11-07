import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AtlasSdkError } from "@atlas/sdk";
import {
  FunctionLookupResultSchema,
  type FunctionLookupResult,
  type TransactionInvestigation,
} from "@atlas/schemas";

import { run, type CliClient } from "./cli.js";

const SELECTOR = "0xa9059cbb";
const TOPIC = `0x${"d".repeat(64)}`;
const HASH = `0x${"a".repeat(64)}`;

const lookup: FunctionLookupResult = FunctionLookupResultSchema.parse({
  identifier: SELECTOR,
  kind: "function" as const,
  ambiguous: false,
  candidates: [
    {
      signature: "transfer(address,uint256)",
      source: "OpenZeppelin/openzeppelin-contracts",
      sourceId: "efaa6f78ab1d:contracts/token/ERC20/IERC20.sol:42:transfer(address,uint256)",
      entityKey: `0x${"1".repeat(64)}`,
      provenance: {
        datasetVersion: "openzeppelin-contracts@efaa6f78ab1d-2026-11-02",
        importedAt: "2026-11-06T00:00:00.000Z",
        recordHash: `0x${"2".repeat(64)}`,
      },
    },
  ],
  registry: "arkiv-rabdi",
  warnings: [],
});

const DEMO_SELECTOR = "0x9010d07c";
const demoLookup: FunctionLookupResult = FunctionLookupResultSchema.parse({
  ...lookup,
  identifier: DEMO_SELECTOR,
  candidates: lookup.candidates.map((candidate) => ({
    ...candidate,
    signature: "getRoleMember(bytes32,uint256)",
  })),
});

function fakeClient(overrides: Partial<CliClient> = {}): CliClient {
  const unexpected = async (): Promise<never> => {
    throw new Error("unexpected client call");
  };
  return {
    health: unexpected,
    lookupFunction: unexpected,
    searchFunctions: unexpected,
    decodeCalldata: unexpected,
    lookupEvent: unexpected,
    decodeLogs: unexpected,
    analyzeTransaction: unexpected,
    ...overrides,
  };
}

function capture() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    options: {
      stdout: (line: string) => stdout.push(line),
      stderr: (line: string) => stderr.push(line),
    },
  };
}

describe("atlas CLI", () => {
  it("prints a human-readable lookup", async () => {
    const io = capture();
    const code = await run(["lookup", SELECTOR], {
      client: fakeClient({ lookupFunction: async () => lookup }),
      ...io.options,
    });

    expect(code).toBe(0);
    const output = io.stdout.join("\n");
    expect(output).toContain(`Function selector ${SELECTOR}`);
    expect(output).toContain("transfer(address,uint256)");
  });

  it("offers a clear quickstart in atlas --help", async () => {
    const io = capture();
    const code = await run(["--help"], { client: fakeClient(), ...io.options });
    expect(code).toBe(0);
    expect(io.stdout.join("\n")).toContain("atlas try");
    expect(io.stdout.join("\n")).toContain("npm i -g @omghotekar/atlas-cli");
  });

  it("runs atlas try against the real lookup client, without fixtures", async () => {
    const io = capture();
    const lookupFunction = vi.fn(async () => demoLookup);
    const code = await run(["try"], {
      client: fakeClient({ lookupFunction }),
      ...io.options,
    });
    expect(code).toBe(0);
    expect(lookupFunction).toHaveBeenCalledExactlyOnceWith(DEMO_SELECTOR);
    expect(io.stdout.join("\n")).toContain("Live Arkiv Rabdi example");
    expect(io.stdout.join("\n")).toContain("getRoleMember(bytes32,uint256)");
  });

  it("keeps atlas try --json machine-readable", async () => {
    const io = capture();
    const code = await run(["try", "--json"], {
      client: fakeClient({ lookupFunction: async () => demoLookup }),
      ...io.options,
    });
    expect(code).toBe(0);
    expect(JSON.parse(io.stdout.join("\n")).identifier).toBe(DEMO_SELECTOR);
  });

  it("fails instead of inventing a verified record when the API has no match", async () => {
    const io = capture();
    const code = await run(["try"], {
      client: fakeClient({
        lookupFunction: async () => ({ ...demoLookup, candidates: [] }),
      }),
      ...io.options,
    });
    expect(code).toBe(1);
    expect(io.stdout).toEqual([]);
    expect(io.stderr.join("\n")).toContain("unavailable or missing source evidence");
  });

  it("reports real backend failures from atlas try", async () => {
    const io = capture();
    const code = await run(["try"], {
      client: fakeClient({
        lookupFunction: async () => {
          throw new AtlasSdkError("UPSTREAM_UNAVAILABLE", "Arkiv unreachable", {
            requestId: "req-live-demo",
          });
        },
      }),
      ...io.options,
    });
    expect(code).toBe(1);
    expect(io.stdout).toEqual([]);
    expect(io.stderr.join("\n")).toContain("req-live-demo");
  });

  it("prints JSON when asked", async () => {
    const io = capture();
    const code = await run(["lookup", SELECTOR, "--json"], {
      client: fakeClient({ lookupFunction: async () => lookup }),
      ...io.options,
    });

    expect(code).toBe(0);
    expect(JSON.parse(io.stdout.join("\n"))).toMatchObject({ identifier: SELECTOR });
  });

  it("reports sponsor readiness as JSON without promoting unprobed services", async () => {
    const io = capture();
    const status = {
      arkiv: "connected",
      swarm: "unconfigured",
      ensv2: "configured-unprobed",
      zeroG: "unconfigured",
      anonRpc: "browser-only",
    } as const;
    const code = await run(["integrations", "--json"], {
      client: fakeClient({ integrationStatus: async () => status }),
      ...io.options,
    });
    expect(code).toBe(0);
    expect(JSON.parse(io.stdout.join("\n"))).toEqual(status);
  });

  it("searches with limit and cursor", async () => {
    const io = capture();
    const search = vi.fn(async () => ({
      items: [],
      pagination: { nextCursor: null },
    }));

    const code = await run(["search", "transfer", "--limit", "5"], {
      client: fakeClient({ searchFunctions: search }),
      ...io.options,
    });

    expect(code).toBe(0);
    expect(search).toHaveBeenCalledWith("transfer", { limit: 5 });
  });

  it("rejects an invalid limit with exit code 2", async () => {
    const io = capture();
    const code = await run(["search", "transfer", "--limit", "1000"], {
      client: fakeClient(),
      ...io.options,
    });

    expect(code).toBe(2);
    expect(io.stderr.join("\n")).toContain("1 to 100");
  });

  it("maps SDK failures to meaningful exit codes", async () => {
    const cases: [AtlasSdkError, number][] = [
      [new AtlasSdkError("INVALID_SELECTOR", "bad selector"), 2],
      [new AtlasSdkError("NOT_FOUND", "missing"), 3],
      [new AtlasSdkError("DECODE_FAILED", "cannot decode"), 4],
      [new AtlasSdkError("NETWORK_ERROR", "offline"), 1],
      [new AtlasSdkError("UPSTREAM_UNAVAILABLE", "registry down", { requestId: "req-9" }), 1],
    ];

    for (const [error, expected] of cases) {
      const io = capture();
      const code = await run(["lookup", SELECTOR], {
        client: fakeClient({
          lookupFunction: async () => {
            throw error;
          },
        }),
        ...io.options,
      });
      expect(code).toBe(expected);
      expect(io.stderr.join("\n")).toContain(error.code);
    }
  });

  it("returns exit code 2 for unknown commands and missing arguments", async () => {
    const unknown = capture();
    expect(await run(["nope"], { client: fakeClient(), ...unknown.options })).toBe(2);
    expect(await run(["lookup"], { client: fakeClient(), ...capture().options })).toBe(2);
  });

  it("reports doctor health and degraded status", async () => {
    const ok = capture();
    expect(
      await run(["doctor"], {
        client: fakeClient({
          health: async () => ({ status: "ok", version: "0.1.0", arkiv: { connected: true } }),
        }),
        ...ok.options,
        env: { ATLAS_API_URL: "http://127.0.0.1:4000" },
      }),
    ).toBe(0);
    expect(ok.stdout.join("\n")).toContain("http://127.0.0.1:4000");

    const degraded = capture();
    expect(
      await run(["doctor"], {
        client: fakeClient({
          health: async () => ({
            status: "degraded",
            version: "0.1.0",
            arkiv: { connected: false },
          }),
        }),
        ...degraded.options,
      }),
    ).toBe(1);
  });

  it("decodes logs from a file", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "atlas-cli-"));
    const file = path.join(directory, "logs.json");
    await writeFile(
      file,
      JSON.stringify({
        logs: [{ topics: [TOPIC], data: "0x" }],
      }),
      "utf8",
    );

    try {
      const io = capture();
      const decodeLogs = vi.fn(async () => []);
      const code = await run(["logs", "--file", file], {
        client: fakeClient({ decodeLogs }),
        ...io.options,
      });

      expect(code).toBe(0);
      expect(decodeLogs).toHaveBeenCalledWith([{ topics: [TOPIC], data: "0x" }]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a malformed logs file", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "atlas-cli-"));
    const file = path.join(directory, "logs.json");
    await writeFile(file, "{not json", "utf8");

    try {
      const io = capture();
      const code = await run(["logs", "--file", file], {
        client: fakeClient(),
        ...io.options,
      });
      expect(code).toBe(2);
      expect(io.stderr.join("\n")).toContain("not valid JSON");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("formats transaction facts separately from interpretations", async () => {
    const io = capture();
    const analyze = vi.fn(
      async () =>
        ({
          transaction: {
            hash: HASH,
            chainId: 1,
            from: "0x0000000000000000000000000000000000000001",
            to: "0x0000000000000000000000000000000000000002",
            input: "0xa9059cbb",
            blockNumber: 16,
            source: "rpc" as const,
          },
          receipt: { status: "reverted" as const, source: "rpc" as const },
          functionLookup: lookup,
          functionDecode: null,
          eventResults: [],
          limitations: ["Internal calls are not decoded."],
          warnings: ["Execution reverted."],
        }) as unknown as TransactionInvestigation,
    );

    const code = await run(["tx", HASH, "--chain", "1"], {
      client: fakeClient({ analyzeTransaction: analyze }),
      ...io.options,
    });

    expect(code).toBe(0);
    const output = io.stdout.join("\n");
    expect(output).toContain("(source: RPC)");
    expect(output).toContain("Receipt: reverted");
    expect(output).toContain("Limitations:");
    expect(output).toContain("Internal calls are not decoded.");
    expect(analyze).toHaveBeenCalledWith({ chainId: 1, hash: HASH });
  });
});
