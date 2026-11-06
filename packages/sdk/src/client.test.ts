import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { AtlasClient } from "./client.js";
import { AtlasSdkError } from "./errors.js";

const REQUEST_ID = "req-123";
const TRANSFER_TOPIC = `0x${"d".repeat(64)}`;

const lookupPayload = {
  identifier: "0xa9059cbb",
  kind: "function",
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
};

interface Recorded {
  method: string;
  url: string;
  headers: IncomingMessage["headers"];
  body: string;
}

const servers: { close: () => Promise<void> }[] = [];

function serve(
  handler: (request: Recorded, response: ServerResponse) => void,
): Promise<{ baseUrl: string; requests: Recorded[] }> {
  const requests: Recorded[] = [];
  return new Promise((resolve) => {
    const server = createServer((incoming, outgoing) => {
      let body = "";
      incoming.on("data", (chunk) => {
        body += chunk;
      });
      incoming.on("end", () => {
        const recorded = {
          method: incoming.method ?? "GET",
          url: incoming.url ?? "/",
          headers: incoming.headers,
          body,
        };
        requests.push(recorded);
        handler(recorded, outgoing);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      servers.push({
        close: () =>
          new Promise((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
      resolve({ baseUrl: `http://127.0.0.1:${port}`, requests });
    });
  });
}

function json(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json", "x-request-id": REQUEST_ID });
  response.end(JSON.stringify(payload));
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("AtlasClient", () => {
  it("looks up a selector and validates the response", async () => {
    const { baseUrl, requests } = await serve((_request, response) =>
      json(response, 200, lookupPayload),
    );
    const client = new AtlasClient({ baseUrl });

    const result = await client.lookupFunction("0xA9059CBB");

    expect(result.candidates[0]?.signature).toBe("transfer(address,uint256)");
    expect(requests[0]).toMatchObject({
      method: "GET",
      url: "/v1/functions/0xA9059CBB",
    });
    expect(requests[0]?.headers.accept).toBe("application/json");
  });

  it("builds search queries and pagination parameters", async () => {
    const { baseUrl, requests } = await serve((_request, response) =>
      json(response, 200, { items: [], pagination: { nextCursor: null } }),
    );
    const client = new AtlasClient({ baseUrl, headers: { authorization: "Bearer test" } });

    await client.searchFunctions("transfer", { limit: 5, cursor: "10" });

    const url = new URL(requests[0]!.url, baseUrl);
    expect(url.pathname).toBe("/v1/functions/search");
    expect(url.searchParams.get("q")).toBe("transfer");
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("cursor")).toBe("10");
    expect(requests[0]?.headers.authorization).toBe("Bearer test");
  });

  it("posts calldata for decoding", async () => {
    const { baseUrl, requests } = await serve((_request, response) =>
      json(response, 200, {
        selector: "0xa9059cbb",
        ambiguous: false,
        decoded: [],
        warnings: [],
      }),
    );
    const client = new AtlasClient({ baseUrl });

    const result = await client.decodeCalldata("0xa9059cbb00");

    expect(result.selector).toBe("0xa9059cbb");
    expect(JSON.parse(requests[0]!.body)).toEqual({ calldata: "0xa9059cbb00" });
    expect(requests[0]?.headers["content-type"]).toContain("application/json");
  });

  it("looks up event topics and analyzes transactions", async () => {
    const { baseUrl, requests } = await serve((request, response) => {
      if (request.url.startsWith("/v1/events/")) {
        return json(response, 200, {
          identifier: TRANSFER_TOPIC,
          kind: "event",
          ambiguous: false,
          candidates: [],
          registry: "arkiv-rabdi",
          warnings: [],
        });
      }
      return json(response, 200, {
        transaction: {
          hash: `0x${"a".repeat(64)}`,
          chainId: 1,
          from: "0x0000000000000000000000000000000000000001",
          to: null,
          input: "0x",
          blockNumber: null,
          source: "rpc",
        },
        receipt: null,
        functionLookup: null,
        functionDecode: null,
        eventResults: [],
        limitations: [],
        warnings: [],
      });
    });
    const client = new AtlasClient({ baseUrl });

    await expect(client.lookupEvent(TRANSFER_TOPIC)).resolves.toMatchObject({ kind: "event" });
    await expect(
      client.analyzeTransaction({ chainId: 1, hash: `0x${"a".repeat(64)}` }),
    ).resolves.toMatchObject({ receipt: null });
    expect(requests[1]?.url).toBe("/v1/transactions/analyze");
  });

  it("maps API error envelopes to typed errors", async () => {
    const { baseUrl } = await serve((_request, response) =>
      json(response, 429, {
        error: {
          code: "RATE_LIMITED",
          message: "Rate limit exceeded.",
          details: { limit: 2 },
          requestId: REQUEST_ID,
        },
      }),
    );
    const client = new AtlasClient({ baseUrl });

    const error = await client.lookupFunction("0xa9059cbb").catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(AtlasSdkError);
    expect(error).toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
      requestId: REQUEST_ID,
      details: { limit: 2 },
    });
  });

  it("rejects non-JSON and structurally invalid responses", async () => {
    const { baseUrl } = await serve((request, response) => {
      if (request.url.includes("non-json")) {
        response.writeHead(200, { "content-type": "text/html" });
        return response.end("<html></html>");
      }
      return json(response, 200, { identifier: "nope" });
    });
    const client = new AtlasClient({ baseUrl });

    await expect(client.lookupFunction("non-json")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    await expect(client.lookupFunction("0xa9059cbb")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("reports an unreachable service as NETWORK_ERROR", async () => {
    const client = new AtlasClient({ baseUrl: "http://127.0.0.1:1" });

    await expect(client.health()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("times out slow responses", async () => {
    const { baseUrl } = await serve(() => {
      // Never respond: the client timeout must fire.
    });
    const client = new AtlasClient({ baseUrl, timeoutMs: 25 });

    await expect(client.health()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: expect.stringContaining("25 ms"),
    });
  });

  it("rejects invalid base URLs at construction time", () => {
    expect(() => new AtlasClient({ baseUrl: "ftp://example.com" })).toThrow(AtlasSdkError);
    expect(() => new AtlasClient({ baseUrl: "not a url" })).toThrow(AtlasSdkError);
  });
});
