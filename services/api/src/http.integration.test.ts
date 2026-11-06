import type { Address, Hex } from "viem";
import type { FastifyInstance } from "fastify";
import type { PublicArkivClient } from "@arkiv-network/sdk";
import { afterEach, describe, expect, it } from "vitest";
import { encodeFunctionData, parseAbi, stringToHex, toEventSelector } from "viem";
import { ArkivEventRepository, ArkivFunctionRepository } from "@atlas/arkiv";
import {
  ApiErrorSchema,
  FunctionLookupResultSchema,
  FunctionSearchResultSchema,
  CalldataDecodeResultSchema,
} from "@atlas/schemas";

import { createApp } from "./app-factory.js";
import { createDefaultDependencies } from "./deps.js";
import { makeDependencies } from "./test-support.js";

const creator = "0x0000000000000000000000000000000000000001" as Address;
const RECIPIENT = "0x000000000000000000000000000000000000dEaD";
const TRANSFER = "transfer(address,uint256)";
const TRANSFER_SELECTOR = "0xa9059cbb";

const calldata = encodeFunctionData({
  abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
  functionName: "transfer",
  args: [RECIPIENT, 1_000_000n],
});

function entity(signature: string, selector: string, seed: number): Record<string, unknown> {
  const hex = (value: number) => value.toString(16).padStart(64, "0");
  return {
    $key: `0x${hex(seed)}` as Hex,
    $creator: creator,
    selector: { value: selector },
    signature: { value: stringToHex(signature) },
    source: { value: "OpenZeppelin/openzeppelin-contracts" },
    sourceId: { value: `efaa6f78ab1d:${signature}` },
    importedAt: { value: "2026-11-06T00:00:00.000Z" },
    datasetVersion: { value: "openzeppelin-contracts@efaa6f78ab1d-2026-11-02" },
    recordHash: { value: `0x${hex(seed + 1)}` },
  };
}

function eventEntity(signature: string, seed: number): Record<string, unknown> {
  const hex = (value: number) => value.toString(16).padStart(64, "0");
  return {
    $key: `0x${hex(seed)}` as Hex,
    $creator: creator,
    topic0: { value: toEventSelector(signature) },
    signature: { value: stringToHex(signature) },
    indexed: { value: "1,1,0" },
    source: { value: "ethereum/ERCs" },
    sourceId: { value: `7dafd1125ffb:${signature}` },
    importedAt: { value: "2026-11-06T00:00:00.000Z" },
    datasetVersion: { value: "ethereum-ercs@7dafd1125ffb-2026-11-04" },
    recordHash: { value: `0x${hex(seed + 1)}` },
  };
}

function fakeClient(
  pages: readonly (readonly Record<string, unknown>[])[],
  failure?: Error,
): PublicArkivClient {
  return {
    select() {
      let page = 0;
      const builder = {
        from() {
          return this;
        },
        createdBy() {
          return this;
        },
        where() {
          return this;
        },
        orderBy() {
          return this;
        },
        limit() {
          return this;
        },
        async fetch() {
          if (failure) throw failure;
          const entities = pages[page] ?? [];
          page += 1;
          return { entities, blockNumber: 0n, skipped: 0, count: undefined };
        },
      };
      return builder;
    },
  } as unknown as PublicArkivClient;
}

const running: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(running.splice(0).map((app) => app.close()));
});

async function serve(app: ReturnType<typeof createApp>): Promise<string> {
  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  running.push(app);
  return address.replace("http://0.0.0.0", "http://127.0.0.1").replace(/\/$/, "");
}

function adapterApp(
  pages: readonly (readonly Record<string, unknown>[])[],
  options: { failure?: Error; timeoutMs?: number; rateLimit?: number } = {},
) {
  const repository = new ArkivFunctionRepository(fakeClient(pages, options.failure), creator);
  return createApp({
    dependencies: makeDependencies({ functions: repository as never }),
    rateLimitPerMinute: options.rateLimit ?? 0,
    upstreamTimeoutMs: options.timeoutMs ?? 1_000,
  });
}

describe("HTTP API over the real Arkiv repository adapter", () => {
  it("serves lookup, search and calldata decode through the adapter", async () => {
    const base = await serve(adapterApp([[entity(TRANSFER, TRANSFER_SELECTOR, 1)]]));

    const lookupResponse = await fetch(`${base}/v1/functions/${TRANSFER_SELECTOR}`, {
      headers: { "x-request-id": "req-integration-1" },
    });
    expect(lookupResponse.status).toBe(200);
    expect(lookupResponse.headers.get("x-request-id")).toBe("req-integration-1");
    const lookup = FunctionLookupResultSchema.parse(await lookupResponse.json());
    expect(lookup.ambiguous).toBe(false);
    expect(lookup.candidates).toHaveLength(1);
    expect(lookup.candidates[0]).toMatchObject({
      signature: TRANSFER,
      source: "OpenZeppelin/openzeppelin-contracts",
      provenance: { datasetVersion: "openzeppelin-contracts@efaa6f78ab1d-2026-11-02" },
    });

    const searchResponse = await fetch(`${base}/v1/functions/search?q=transfer&limit=20`);
    expect(searchResponse.status).toBe(200);
    const search = FunctionSearchResultSchema.parse(await searchResponse.json());
    expect(search.items.map((item) => item.signature)).toEqual([TRANSFER]);
    expect(search.pagination.nextCursor).toBeNull();

    const decodeResponse = await fetch(`${base}/v1/decode/calldata`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ calldata, strict: false }),
    });
    expect(decodeResponse.status).toBe(200);
    const decoded = CalldataDecodeResultSchema.parse(await decodeResponse.json());
    expect(decoded.selector).toBe(TRANSFER_SELECTOR);
    expect(decoded.decoded[0]).toMatchObject({
      signature: TRANSFER,
      decodeStatus: "success",
      arguments: [
        { name: "arg0", type: "address", value: RECIPIENT.toLowerCase() },
        { name: "arg1", type: "uint256", value: "1000000" },
      ],
    });
  });

  it("preserves every colliding candidate with independent decode outcomes", async () => {
    const base = await serve(
      adapterApp([
        [
          entity(TRANSFER, TRANSFER_SELECTOR, 10),
          entity("many_msg_babbage(bytes1)", TRANSFER_SELECTOR, 20),
        ],
      ]),
    );

    const lookup = FunctionLookupResultSchema.parse(
      await (await fetch(`${base}/v1/functions/${TRANSFER_SELECTOR}`)).json(),
    );
    expect(lookup.ambiguous).toBe(true);
    expect(lookup.candidates).toHaveLength(2);
    expect(lookup.warnings.join(" ")).toContain("does not rank");

    const decoded = CalldataDecodeResultSchema.parse(
      await (
        await fetch(`${base}/v1/decode/calldata`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ calldata }),
        })
      ).json(),
    );
    expect(decoded.ambiguous).toBe(true);
    expect(decoded.decoded).toHaveLength(2);
    const transfer = decoded.decoded.find((item) => item.signature === TRANSFER);
    const colliding = decoded.decoded.find((item) => item.signature !== TRANSFER);
    expect(transfer?.decodeStatus).toBe("success");
    expect(colliding?.decodeStatus).toBe("failed");
  });

  it("serves event lookup and log decoding through the Arkiv event adapter", async () => {
    const transferEvent = "Transfer(address,address,uint256)";
    const topic0 = toEventSelector(transferEvent);
    const repository = new ArkivEventRepository(
      fakeClient([[eventEntity(transferEvent, 30)]]),
      creator,
    );
    const app = createApp({
      dependencies: makeDependencies({ events: repository as never }),
      rateLimitPerMinute: 0,
      upstreamTimeoutMs: 500,
    });
    const base = await serve(app);

    const lookup = await fetch(`${base}/v1/events/${topic0}`);
    expect(lookup.status).toBe(200);
    expect(await lookup.json()).toMatchObject({
      identifier: topic0,
      kind: "event",
      candidates: [{ signature: transferEvent }],
    });

    const padded = (address: string) => `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
    const response = await fetch(`${base}/v1/decode/logs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        logs: [
          {
            topics: [topic0, padded(RECIPIENT), padded(RECIPIENT)],
            data: `0x${"0".repeat(62)}2a`,
          },
        ],
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      results: [
        {
          topic0,
          decoded: [
            {
              signature: transferEvent,
              decodeStatus: "success",
              arguments: [
                { type: "address", value: RECIPIENT.toLowerCase() },
                { type: "address", value: RECIPIENT.toLowerCase() },
                { type: "uint256", value: "42" },
              ],
            },
          ],
        },
      ],
    });
  });

  it("returns a valid empty lookup for a selector with no mirrored record", async () => {
    const base = await serve(adapterApp([[]]));
    const response = await fetch(`${base}/v1/functions/0xdeadbeef`);
    expect(response.status).toBe(200);
    expect(FunctionLookupResultSchema.parse(await response.json())).toMatchObject({
      identifier: "0xdeadbeef",
      ambiguous: false,
      candidates: [],
    });
  });

  it("maps an Arkiv RPC failure to 502, never a fake success", async () => {
    const base = await serve(adapterApp([[]], { failure: new Error("Rabdi unavailable") }));
    const response = await fetch(`${base}/v1/functions/${TRANSFER_SELECTOR}`);
    expect(response.status).toBe(502);
    const error = ApiErrorSchema.parse(await response.json());
    expect(error.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(error.error.requestId.length).toBeGreaterThan(0);

    const search = await fetch(`${base}/v1/functions/search?q=transfer`);
    expect(search.status).toBe(502);
  });

  it("enforces the timeout as UPSTREAM_UNAVAILABLE", async () => {
    const hanging = {
      async findBySelector() {
        return await new Promise(() => undefined);
      },
      async findByRecordHash() {
        return [];
      },
      async searchBySignature() {
        return { items: [], nextCursor: null };
      },
    };
    const app = createApp({
      dependencies: makeDependencies({ functions: hanging as never }),
      rateLimitPerMinute: 0,
      upstreamTimeoutMs: 25,
    });
    const base = await serve(app);
    const response = await fetch(`${base}/v1/functions/${TRANSFER_SELECTOR}`);
    expect(response.status).toBe(502);
    expect(ApiErrorSchema.parse(await response.json()).error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("rejects invalid input and rate-limits excess requests", async () => {
    const base = await serve(
      adapterApp([[entity(TRANSFER, TRANSFER_SELECTOR, 1)]], { rateLimit: 3 }),
    );

    const invalid = await fetch(`${base}/v1/functions/nope`);
    expect(invalid.status).toBe(400);
    expect(ApiErrorSchema.parse(await invalid.json()).error.code).toBe("INVALID_SELECTOR");

    expect((await fetch(`${base}/v1/functions/${TRANSFER_SELECTOR}`)).status).toBe(200);
    expect((await fetch(`${base}/v1/functions/${TRANSFER_SELECTOR}`)).status).toBe(200);
    const limited = await fetch(`${base}/v1/functions/${TRANSFER_SELECTOR}`);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect(ApiErrorSchema.parse(await limited.json()).error.code).toBe("RATE_LIMITED");
  });

  it("reports degraded health when the health probe hangs", async () => {
    const app = createApp({
      dependencies: makeDependencies({ health: async () => await new Promise(() => undefined) }),
      rateLimitPerMinute: 0,
      upstreamTimeoutMs: 20,
    });
    const base = await serve(app);
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "degraded",
      arkiv: { connected: false },
    });
  });

  it("reports degraded health and 502 when Arkiv is not configured", async () => {
    const app = createApp({
      dependencies: createDefaultDependencies({}),
      rateLimitPerMinute: 0,
      upstreamTimeoutMs: 500,
    });
    const base = await serve(app);

    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      status: "degraded",
      arkiv: { connected: false },
    });

    const lookup = await fetch(`${base}/v1/functions/${TRANSFER_SELECTOR}`);
    expect(lookup.status).toBe(502);
    expect(ApiErrorSchema.parse(await lookup.json()).error.code).toBe("UPSTREAM_UNAVAILABLE");

    const event = await fetch(`${base}/v1/events/${toEventSelector(TRANSFER)}`);
    expect(event.status).toBe(502);
    expect(ApiErrorSchema.parse(await event.json()).error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});
