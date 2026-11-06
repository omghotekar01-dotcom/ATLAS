import { describe, expect, it, vi } from "vitest";
import { checkArkivHealth, RABDI_CHAIN_ID } from "./health.js";

describe("checkArkivHealth", () => {
  it("reports the Rabdi network identity and request latency", async () => {
    const client = { getChainId: vi.fn().mockResolvedValue(RABDI_CHAIN_ID) };

    await expect(checkArkivHealth(client)).resolves.toMatchObject({
      status: "ok",
      network: "rabdi",
      chainId: RABDI_CHAIN_ID,
      latencyMs: expect.any(Number),
    });
    expect(client.getChainId).toHaveBeenCalledOnce();
  });

  it("reports a mismatched chain instead of treating it as healthy", async () => {
    await expect(checkArkivHealth({ getChainId: async () => 1 })).resolves.toMatchObject({
      status: "wrong-network",
      network: "rabdi",
      expectedChainId: RABDI_CHAIN_ID,
      actualChainId: 1,
    });
  });

  it("returns an actionable, credential-safe error when the network is unavailable", async () => {
    const result = await checkArkivHealth({
      getChainId: async () => {
        throw new Error("request URL contained an access key");
      },
    });

    expect(result).toMatchObject({
      status: "unavailable",
      network: "rabdi",
      code: "NETWORK_UNAVAILABLE",
      message: expect.stringContaining("ARKIV_ACCESS_KEY"),
      latencyMs: expect.any(Number),
    });
    expect(JSON.stringify(result)).not.toContain("request URL contained an access key");
  });
});
