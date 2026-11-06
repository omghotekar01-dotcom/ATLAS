import { describe, expect, it, vi } from "vitest";
import { encodeAbiParameters } from "viem";
import { InvalidInputError, UpstreamUnavailableError } from "@atlas/schemas";
import { parseRoleUint256, readEnsV2Role } from "./ensv2.js";
import { createApp } from "./app-factory.js";
import { makeDependencies } from "./test-support.js";

const account = "0x000000000000000000000000000000000000dEaD";

describe("ENSv2 permissioned roles", () => {
  it("rejects invalid role bitmaps without network", () => {
    expect(() => parseRoleUint256("-1", 0n)).toThrow(InvalidInputError);
    expect(() => parseRoleUint256("1e3", 0n)).toThrow(InvalidInputError);
    expect(() => parseRoleUint256((1n << 256n).toString(), 0n)).toThrow(InvalidInputError);
    expect(parseRoleUint256(undefined, 1n << 24n)).toBe(16777216n);
  });
  it("fails when the operator did not configure a registry, no fake publisher proof", async () => {
    await expect(readEnsV2Role(account, undefined, undefined, {})).rejects.toThrow(
      UpstreamUnavailableError,
    );
  });
  it("pins registry calls to the verified block and sends read-only call fields", async () => {
    const calls: unknown[] = [];
    const fetchRpc = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const { id, method, params } = await request.json();
      let result;
      switch (method) {
        case "eth_chainId":
          result = "0xaa36a7";
          break;
        case "eth_blockNumber":
          result = "0x123";
          break;
        case "eth_getCode":
          result = "0x01";
          break;
        case "eth_call":
          calls.push(params);
          result =
            calls.length === 1
              ? encodeAbiParameters([{ type: "bool" }], [true])
              : encodeAbiParameters([{ type: "uint256" }], [1n << 24n]);
          break;
        default:
          throw new Error(`Unexpected RPC method: ${method}`);
      }
      return Response.json({ jsonrpc: "2.0", id, result });
    });
    vi.stubGlobal("fetch", fetchRpc);
    try {
      const proof = await readEnsV2Role(account, undefined, undefined, {
        ATLAS_RPC_URL_11155111: "https://rpc.example",
        ATLAS_ENSV2_REGISTRY: account,
      });
      expect(proof).toMatchObject({ authorized: true, roleBitmap: "16777216", blockNumber: "291" });
      expect(calls).toHaveLength(2);
      for (const call of calls) {
        expect(call).toEqual([
          { to: account, data: expect.stringMatching(/^0x[0-9a-f]+$/) },
          "0x123",
        ]);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("exposes a real adapter contract behind the API without altering other routes", async () => {
    const app = createApp({
      dependencies: makeDependencies(),
      rateLimitPerMinute: 0,
      ensV2RoleLookup: async () => ({
        kind: "ensv2-eac-role" as const,
        chainId: 11155111 as const,
        registry: account.toLowerCase() as never,
        account: account.toLowerCase() as never,
        resource: "0",
        requiredRoles: "16777216",
        roleBitmap: "0",
        authorized: false,
        blockNumber: "12345",
        warnings: ["Test-injected response; not live evidence."],
      }),
    });
    const res = await app.inject({ method: "GET", url: `/v1/ensv2/roles/${account}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      authorized: false,
      resource: "0",
      requiredRoles: "16777216",
    });
    const bad = await app.inject({ method: "GET", url: `/v1/ensv2/roles/${account}?resource=-1` });
    expect(bad.statusCode).toBe(400);
    await app.close();
  });
});
