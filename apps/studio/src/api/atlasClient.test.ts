import { afterEach, describe, expect, it, vi } from "vitest";
import { atlasClient } from "./atlasClient.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ATLAS API client", () => {
  it("does not make a request when the API URL is unconfigured", async () => {
    vi.stubEnv("VITE_ATLAS_API_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(atlasClient.getFunctionBySelector("0xa9059cbb")).resolves.toEqual({
      kind: "unconfigured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates API responses against shared domain schemas", async () => {
    vi.stubEnv("VITE_ATLAS_API_URL", "https://api.example.test/");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            identifier: "0xa9059cbb",
            kind: "function",
            ambiguous: false,
            candidates: [],
            registry: "arkiv-rabdi",
            warnings: [],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(atlasClient.getFunctionBySelector("0xa9059cbb")).resolves.toEqual({
      kind: "empty",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.test/v1/functions/0xa9059cbb",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("does not turn HTTP 404 responses into successful empty results", async () => {
    vi.stubEnv("VITE_ATLAS_API_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "NOT_FOUND",
              message: "No matching selector resource.",
              details: null,
              requestId: "req_test",
            },
          }),
          { status: 404 },
        ),
      ),
    );

    await expect(atlasClient.getFunctionBySelector("0xa9059cbb")).resolves.toMatchObject({
      kind: "http-error",
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("does not show fetch exception details that may contain credentials", async () => {
    const secret = "ARKIV_ACCESS_KEY=must-not-be-shown";
    vi.stubEnv("VITE_ATLAS_API_URL", "https://api.example.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(`Request failed for ${secret}`)));

    await expect(atlasClient.getFunctionBySelector("0xa9059cbb")).resolves.toEqual({
      kind: "network-error",
      message: "The API could not be reached. Check the configured URL and network connection.",
    });
  });

  it("reports a contract error for a malformed successful response", async () => {
    vi.stubEnv("VITE_ATLAS_API_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 })),
    );

    await expect(atlasClient.getFunctionBySelector("0xa9059cbb")).resolves.toMatchObject({
      kind: "http-error",
      status: 200,
      message: "The API response did not match the ATLAS contract.",
    });
  });
});

describe("ATLAS event and transaction routes", () => {
  it("looks up an event topic0", async () => {
    vi.stubEnv("VITE_ATLAS_API_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            identifier: `0x${"d".repeat(64)}`,
            kind: "event",
            ambiguous: false,
            candidates: [],
            registry: "arkiv-rabdi",
            warnings: [],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(atlasClient.getEventByTopic0(`0x${"d".repeat(64)}`)).resolves.toEqual({
      kind: "empty",
    });
  });

  describe("ENSv2 permission client", () => {
    it("encodes provided name, resource and role query parameters and validates the response", async () => {
      vi.stubEnv("VITE_ATLAS_API_URL", "https://api.example.test/");
      const proof = {
        kind: "ensv2-eac-role",
        chainId: 11155111,
        registry: "0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4",
        account: "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3",
        resource: "0",
        requiredRoles: "1",
        roleBitmap: "1",
        authorized: true,
        blockNumber: "123",
        warnings: ["Read-only test response."],
      };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(proof))));

      await expect(
        atlasClient.checkEnsV2Role({
          account: proof.account,
          resource: "0",
          role: "1",
        }),
      ).resolves.toMatchObject({ kind: "ok", data: { authorized: true } });
      expect(fetch).toHaveBeenCalledWith(
        `https://api.example.test/v1/ensv2/roles/${proof.account}?resource=0&role=1`,
        expect.any(Object),
      );
    });

    it("omits absent query values and never adds a resource to a name request", async () => {
      vi.stubEnv("VITE_ATLAS_API_URL", "https://api.example.test");
      const proof = {
        kind: "ensv2-eac-role",
        chainId: 11155111,
        registry: "0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4",
        account: "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3",
        resource: "11",
        requiredRoles: "16777216",
        roleBitmap: "16777216",
        authorized: true,
        blockNumber: "123",
        warnings: [],
      };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(proof))));

      await atlasClient.checkEnsV2Role({
        account: proof.account,
        name: "name.eth",
        role: "16777216",
      });

      expect(fetch).toHaveBeenCalledWith(
        `https://api.example.test/v1/ensv2/roles/${proof.account}?name=name.eth&role=16777216`,
        expect.any(Object),
      );
    });
  });

  it("posts logs for decoding and returns per-log results", async () => {
    vi.stubEnv("VITE_ATLAS_API_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                topic0: `0x${"d".repeat(64)}`,
                ambiguous: false,
                decoded: [],
                warnings: [],
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const response = await atlasClient.decodeLogs([
      { topics: [`0x${"d".repeat(64)}`], data: "0x" },
    ]);

    expect(response.kind).toBe("ok");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.test/v1/decode/logs",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("analyzes a transaction and validates the investigation contract", async () => {
    vi.stubEnv("VITE_ATLAS_API_URL", "https://api.example.test");
    const payload = {
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
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));

    const response = await atlasClient.analyzeTransaction({
      chainId: 1,
      hash: `0x${"a".repeat(64)}`,
    });

    expect(response).toMatchObject({ kind: "ok", data: { receipt: null } });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.test/v1/transactions/analyze",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chainId: 1, hash: `0x${"a".repeat(64)}` }),
      }),
    );
  });
});
