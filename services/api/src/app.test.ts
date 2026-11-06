import { describe, expect, it } from "vitest";
import { encodeFunctionData, parseAbi, toEventSelector } from "viem";
import { ApiErrorSchema, UpstreamUnavailableError } from "@atlas/schemas";

import { createApp } from "./app-factory.js";
import {
  eventRecord,
  functionRecord,
  makeDependencies,
  memoryEvents,
  memoryFunctions,
} from "./test-support.js";

const TRANSFER = "transfer(address,uint256)";
const TRANSFER_SELECTOR = "0xa9059cbb";
const RECIPIENT = "0x000000000000000000000000000000000000dEaD";

const transferCalldata = encodeFunctionData({
  abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
  functionName: "transfer",
  args: [RECIPIENT, 1_000_000n],
});

function makeApp(
  overrides: Parameters<typeof makeDependencies>[0] = {},
  options: { rateLimitPerMinute?: number; upstreamTimeoutMs?: number } = {},
) {
  return createApp({
    dependencies: makeDependencies(overrides),
    rateLimitPerMinute: options.rateLimitPerMinute ?? 0,
    upstreamTimeoutMs: options.upstreamTimeoutMs ?? 2_000,
  });
}

async function body(response: { body: string }): Promise<Record<string, unknown>> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

describe("GET /health", () => {
  it("reports ok when Arkiv is reachable", async () => {
    const app = makeApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(await body(response)).toMatchObject({
      status: "ok",
      version: "test",
      arkiv: { connected: true },
    });
  });

  it("reports degraded, not ok, when Arkiv is unreachable", async () => {
    const app = makeApp({ health: async () => ({ arkiv: { connected: false } }) });
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(await body(response)).toMatchObject({ status: "degraded", arkiv: { connected: false } });
  });
});

describe("GET /v1/functions/:selector", () => {
  it("returns a canonical candidate", async () => {
    const app = makeApp({
      functions: memoryFunctions([functionRecord(TRANSFER, TRANSFER_SELECTOR, "a")]),
    });

    const response = await app.inject({
      method: "GET",
      url: `/v1/functions/${TRANSFER_SELECTOR}`,
      headers: { "x-request-id": "req-test-1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBe("req-test-1");
    const payload = await body(response);
    expect(payload).toMatchObject({
      identifier: TRANSFER_SELECTOR,
      kind: "function",
      ambiguous: false,
      registry: "arkiv-rabdi",
    });
    expect(payload.candidates).toHaveLength(1);
  });

  it("returns a valid empty result for an unknown selector", async () => {
    const app = makeApp();
    const response = await app.inject({ method: "GET", url: "/v1/functions/0xdeadbeef" });

    expect(response.statusCode).toBe(200);
    expect(await body(response)).toMatchObject({ identifier: "0xdeadbeef", candidates: [] });
  });

  it("returns a structured 400 for a malformed selector", async () => {
    const app = makeApp();
    const response = await app.inject({ method: "GET", url: "/v1/functions/0x1234" });

    expect(response.statusCode).toBe(400);
    const payload = ApiErrorSchema.parse(await body(response));
    expect(payload.error.code).toBe("INVALID_SELECTOR");
    expect(payload.error.requestId).toBeTruthy();
  });

  it("returns 502 when the registry is offline, never an empty success", async () => {
    const app = makeApp({
      functions: {
        ...memoryFunctions([]),
        findBySelector: async () => {
          throw new UpstreamUnavailableError("Rabdi is unreachable.");
        },
      },
    });

    const response = await app.inject({ method: "GET", url: `/v1/functions/${TRANSFER_SELECTOR}` });

    expect(response.statusCode).toBe(502);
    const payload = ApiErrorSchema.parse(await body(response));
    expect(payload.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("returns 502 when the registry exceeds the timeout", async () => {
    const app = makeApp(
      {
        functions: {
          ...memoryFunctions([]),
          findBySelector: () => new Promise(() => {}),
        },
      },
      { upstreamTimeoutMs: 30 },
    );

    const response = await app.inject({ method: "GET", url: `/v1/functions/${TRANSFER_SELECTOR}` });

    expect(response.statusCode).toBe(502);
    expect(await body(response)).toMatchObject({
      error: { code: "UPSTREAM_UNAVAILABLE", message: "Signature lookup timed out." },
    });
  });

  it("does not echo internal 4xx error messages", async () => {
    const secret = "ARKIV_ACCESS_KEY=must-not-be-returned";
    const app = makeApp();
    app.get("/internal-test", async () => {
      throw Object.assign(new Error(secret), { statusCode: 400 });
    });

    const response = await app.inject({ method: "GET", url: "/internal-test" });

    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(secret);
    expect(await body(response)).toMatchObject({
      error: { code: "INVALID_INPUT", message: "Malformed request." },
    });
  });
});

describe("GET /v1/functions/search", () => {
  const records = [
    functionRecord("approve(address,uint256)", "0x095ea7b3", "a"),
    functionRecord(TRANSFER, TRANSFER_SELECTOR, "b"),
    functionRecord("transferFrom(address,address,uint256)", "0x23b872dd", "c"),
  ];

  it("returns matching canonical signatures", async () => {
    const app = makeApp({ functions: memoryFunctions(records) });
    const response = await app.inject({
      method: "GET",
      url: "/v1/functions/search?q=transfer&limit=1",
    });

    expect(response.statusCode).toBe(200);
    const payload = (await body(response)) as {
      items: { signature: string }[];
      pagination: { nextCursor: string | null };
    };
    expect(payload.items).toHaveLength(1);
    expect(payload.pagination.nextCursor).toBe("1");
  });

  it("requires q and validates limit", async () => {
    const app = makeApp({ functions: memoryFunctions(records) });

    expect((await app.inject({ method: "GET", url: "/v1/functions/search" })).statusCode).toBe(400);
    const badLimit = await app.inject({
      method: "GET",
      url: "/v1/functions/search?q=transfer&limit=abc",
    });
    expect(badLimit.statusCode).toBe(400);
    expect((await body(badLimit)).error).toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("POST /v1/decode/calldata", () => {
  it("decodes bigint arguments as decimal strings", async () => {
    const app = makeApp({
      functions: memoryFunctions([functionRecord(TRANSFER, TRANSFER_SELECTOR, "a")]),
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/decode/calldata",
      payload: { calldata: transferCalldata },
    });

    expect(response.statusCode).toBe(200);
    const payload = (await body(response)) as {
      decoded: { decodeStatus: string; arguments: { value: unknown }[] }[];
    };
    expect(payload.decoded[0]).toMatchObject({ decodeStatus: "success" });
    expect(payload.decoded[0]?.arguments[1]?.value).toBe("1000000");
  });

  it("keeps every colliding candidate with a per-candidate status", async () => {
    const app = makeApp({
      functions: memoryFunctions([
        functionRecord(TRANSFER, TRANSFER_SELECTOR, "a"),
        functionRecord("many_msg_babbage(bytes1)", TRANSFER_SELECTOR, "b", "ethereum/ERCs"),
      ]),
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/decode/calldata",
      payload: { calldata: transferCalldata },
    });

    expect(response.statusCode).toBe(200);
    const payload = (await body(response)) as {
      ambiguous: boolean;
      decoded: { decodeStatus: string }[];
    };
    expect(payload.ambiguous).toBe(true);
    expect(payload.decoded.map((attempt) => attempt.decodeStatus)).toEqual(["success", "failed"]);
  });

  it("accepts the PRD's strict flag without changing candidate outcomes", async () => {
    const app = makeApp({
      functions: memoryFunctions([functionRecord(TRANSFER, TRANSFER_SELECTOR, "a")]),
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/decode/calldata",
      payload: { calldata: transferCalldata, strict: true },
    });

    expect(response.statusCode).toBe(200);
    expect(await body(response)).toMatchObject({
      selector: TRANSFER_SELECTOR,
      ambiguous: false,
      decoded: [{ signature: TRANSFER, decodeStatus: "success" }],
    });
  });

  it("rejects malformed calldata with a 400 envelope", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/decode/calldata",
      payload: { calldata: "0xzz" },
    });

    expect(response.statusCode).toBe(400);
    expect(await body(response)).toMatchObject({ error: { code: "INVALID_INPUT" } });
  });

  it("rejects malformed JSON", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/decode/calldata",
      headers: { "content-type": "application/json" },
      payload: "{",
    });

    expect(response.statusCode).toBe(400);
    expect(await body(response)).toMatchObject({ error: { code: "INVALID_INPUT" } });
  });
});

const TRANSFER_EVENT = "Transfer(address,address,uint256)";
const TRANSFER_TOPIC = toEventSelector(TRANSFER_EVENT);
const padded = (address: string) => `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;

const transferLog = {
  topics: [TRANSFER_TOPIC, padded(RECIPIENT), padded(RECIPIENT)],
  data: `0x${1_000_000n.toString(16).padStart(64, "0")}`,
};

describe("event routes", () => {
  it("returns a valid empty topic lookup", async () => {
    const app = makeApp();
    const response = await app.inject({ method: "GET", url: `/v1/events/${TRANSFER_TOPIC}` });

    expect(response.statusCode).toBe(200);
    expect(await body(response)).toMatchObject({ identifier: TRANSFER_TOPIC, candidates: [] });
  });

  it("rejects a malformed topic0", async () => {
    const app = makeApp();
    const response = await app.inject({ method: "GET", url: "/v1/events/0x12" });
    expect(response.statusCode).toBe(400);
    expect(await body(response)).toMatchObject({ error: { code: "INVALID_TOPIC0" } });
  });

  it("decodes logs with the pinned indexed layout", async () => {
    const app = makeApp({
      events: memoryEvents([eventRecord(TRANSFER_EVENT, TRANSFER_TOPIC, "a", [true, true, false])]),
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/decode/logs",
      payload: { logs: [transferLog] },
    });

    expect(response.statusCode).toBe(200);
    const payload = (await body(response)) as {
      results: { decoded: { decodeStatus: string; arguments: { value: unknown }[] }[] }[];
    };
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]?.decoded[0]).toMatchObject({ decodeStatus: "success" });
    expect(payload.results[0]?.decoded[0]?.arguments[2]).toMatchObject({ value: "1000000" });
  });

  it("rejects malformed topics and data before decoding", async () => {
    const app = makeApp();
    const badTopic = await app.inject({
      method: "POST",
      url: "/v1/decode/logs",
      payload: { logs: [{ topics: ["0x12"], data: "0x" }] },
    });
    expect(badTopic.statusCode).toBe(400);
    expect(await body(badTopic)).toMatchObject({ error: { code: "INVALID_INPUT" } });

    const badData = await app.inject({
      method: "POST",
      url: "/v1/decode/logs",
      payload: { logs: [{ topics: [TRANSFER_TOPIC], data: "0xzz" }] },
    });
    expect(badData.statusCode).toBe(400);
    expect(await body(badData)).toMatchObject({ error: { code: "INVALID_INPUT" } });
  });

  it("rejects an empty logs array", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/decode/logs",
      payload: { logs: [] },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe("service behaviour", () => {
  it("uses request ids in errors and echoes a supplied id", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/functions/nope",
      headers: { "x-request-id": "client-request-7" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["x-request-id"]).toBe("client-request-7");
    const payload = ApiErrorSchema.parse(await body(response));
    expect(payload.error.requestId).toBe("client-request-7");
  });

  it("returns an error envelope for unknown routes", async () => {
    const app = makeApp();
    const secret = "sensitive-query-value";
    const response = await app.inject({
      method: "GET",
      url: `/v2/nope?accessKey=${secret}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain(secret);
    expect(await body(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("rate limits /v1 requests with a 429 envelope", async () => {
    const app = makeApp({}, { rateLimitPerMinute: 2 });

    expect((await app.inject({ method: "GET", url: "/v1/functions/0xdeadbeef" })).statusCode).toBe(
      200,
    );
    expect((await app.inject({ method: "GET", url: "/v1/functions/0xdeadbeef" })).statusCode).toBe(
      200,
    );
    const limited = await app.inject({ method: "GET", url: "/v1/functions/0xdeadbeef" });

    expect(limited.statusCode).toBe(429);
    expect(await body(limited)).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(limited.headers["retry-after"]).toBeTruthy();
  });

  it("does not rate limit /health", async () => {
    const app = makeApp({}, { rateLimitPerMinute: 1 });
    await app.inject({ method: "GET", url: "/v1/functions/0xdeadbeef" });
    await app.inject({ method: "GET", url: "/v1/functions/0xdeadbeef" });

    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
  });
});
