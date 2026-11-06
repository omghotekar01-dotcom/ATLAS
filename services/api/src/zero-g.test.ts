import { describe, expect, it, vi } from "vitest";
import { explainWithZeroG } from "./zero-g.js";
import { CalldataDecodeResultSchema, ExplainResultSchema } from "@atlas/schemas";
import { createApp } from "./app-factory.js";
import { functionRecord, makeDependencies, memoryFunctions } from "./test-support.js";

const decoded = CalldataDecodeResultSchema.parse({
  selector: "0x9010d07c",
  ambiguous: false,
  decoded: [
    {
      signature: "getRoleMember(bytes32,uint256)",
      provenance: {
        recordHash: `0x${"a".repeat(64)}`,
        datasetVersion: "openzeppelin-v1",
        importedAt: "2026-11-06T00:00:00.000Z",
      },
      decodeStatus: "success",
      arguments: [
        { name: "role", type: "bytes32", value: `0x${"0".repeat(64)}` },
        { name: "index", type: "uint256", value: "0" },
      ],
    },
  ],
  warnings: [],
});
const env = {
  ATLAS_0G_API_KEY: "server-secret-not-for-browser",
  ATLAS_0G_MODEL: "an-operator-selected-model",
};
const mockResponse = (response: Response) => vi.fn(async () => response) as unknown as typeof fetch;

describe("0G Private Computer read-only explanation adapter", () => {
  it("sends only bounded deterministic evidence with private mode, returns a genuine provider ID", async () => {
    const fetchMock = mockResponse(
      new Response(
        JSON.stringify({
          id: "chatcmpl-real-provider-id",
          choices: [
            {
              message: { content: "This is a role membership read; the result is not known here." },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const output = await explainWithZeroG(decoded, env, fetchMock);
    expect(output.requestId).toBe("chatcmpl-real-provider-id");
    expect(output.status).toBe("ai-interpretation");
    expect(output.decoded).toEqual(decoded);
    const [, options] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(options.headers["X-0G-Provider-Trust-Mode"]).toBe("private");
    expect(options.body).not.toContain(env.ATLAS_0G_API_KEY);
    expect(options.body).toContain("getRoleMember(bytes32,uint256)");
  });

  it("does not call 0G when credentials are absent", async () => {
    const mock = mockResponse(new Response("irrelevant"));
    await expect(explainWithZeroG(decoded, {}, mock)).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
    expect(mock).not.toHaveBeenCalled();
  });

  it("will not fabricate interpretation for unknown selectors", async () => {
    const unknown = CalldataDecodeResultSchema.parse({
      selector: "0xdeadbeef",
      ambiguous: false,
      decoded: [],
      warnings: [],
    });
    await expect(explainWithZeroG(unknown, env)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("maps actual authentication, credit, rate-limit and malformed response errors", async () => {
    await expect(
      explainWithZeroG(decoded, env, mockResponse(new Response(null, { status: 401 }))),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      explainWithZeroG(decoded, env, mockResponse(new Response(null, { status: 402 }))),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    await expect(
      explainWithZeroG(decoded, env, mockResponse(new Response(null, { status: 429 }))),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(
      explainWithZeroG(decoded, env, mockResponse(new Response("<html>fail</html>"))),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });
});

describe("0G API integration (deterministic mock, not a live sponsor claim)", () => {
  it("decodes canonical calldata before invoking the explanation adapter", async () => {
    const calldata = `0x9010d07c${"0".repeat(128)}`;
    const app = createApp({
      rateLimitPerMinute: 0,
      dependencies: makeDependencies({
        functions: memoryFunctions([
          functionRecord("getRoleMember(bytes32,uint256)", "0x9010d07c", "a"),
        ]),
      }),
      zeroGExplain: async (evidence) =>
        ExplainResultSchema.parse({
          provider: "0g-private-computer",
          status: "ai-interpretation",
          model: "test-model",
          requestId: "provider-mock-only",
          explanation: "Read-only role membership lookup.",
          decoded: evidence,
          warnings: ["This is an AI interpretation."],
        }),
    });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/explain",
        payload: { calldata },
      });
      expect(response.statusCode).toBe(200);
      const result = ExplainResultSchema.parse(response.json());
      expect(result.decoded.decoded[0]?.signature).toBe("getRoleMember(bytes32,uint256)");
      expect(result.requestId).toBe("provider-mock-only");
    } finally {
      await app.close();
    }
  });
});
