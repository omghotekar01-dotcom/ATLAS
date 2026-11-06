import { describe, expect, it } from "vitest";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { TransactionInvestigationSchema } from "@atlas/schemas";

import { createApp } from "./app-factory.js";
import { createDefaultDependencies } from "./deps.js";

/**
 * Read-only live RPC API check. Disabled unless explicitly enabled:
 *   ATLAS_LIVE_RPC=1 ATLAS_RPC_URL_1=https://... pnpm --filter @atlas/api test
 * No Arkiv credentials are used, so registry fields must degrade honestly.
 */
const rpcUrl = process.env.ATLAS_RPC_URL_1?.trim();
const enabled = process.env.ATLAS_LIVE_RPC === "1" && Boolean(rpcUrl);

describe.skipIf(!enabled)("live transaction API over a public RPC", () => {
  it("returns verified facts and does not fabricate Arkiv candidates", async () => {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl, { timeout: 20_000, retryCount: 0 }),
    });
    const block = await client.getBlock({ includeTransactions: true });
    const transaction = block.transactions.find((entry) => typeof entry !== "string");
    if (!transaction || typeof transaction === "string")
      throw new Error("No transaction in block.");

    const app = createApp({
      dependencies: createDefaultDependencies({ ATLAS_RPC_URL_1: rpcUrl }),
      rateLimitPerMinute: 0,
      upstreamTimeoutMs: 10_000,
    });
    const address = await app.listen({ port: 0, host: "127.0.0.1" });

    try {
      const response = await fetch(`${address}/v1/transactions/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chainId: 1, hash: transaction.hash }),
      });
      expect(response.status).toBe(200);
      const payload = TransactionInvestigationSchema.parse(await response.json());

      expect(payload.transaction).toMatchObject({
        hash: transaction.hash,
        chainId: 1,
        source: "rpc",
      });
      expect(payload.receipt).not.toBeNull();
      expect(payload.receipt?.source).toBe("rpc");
      expect(payload.functionLookup).toBeNull();
      expect(payload.functionDecode).toBeNull();
      expect(payload.warnings.join(" ")).toMatch(/Signature lookup is unavailable/);
      expect(JSON.stringify(payload)).not.toMatch(/safety score|risk score/i);
    } finally {
      await app.close();
    }
  }, 40_000);
});
