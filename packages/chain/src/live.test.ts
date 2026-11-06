import { describe, expect, it } from "vitest";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { NotFoundError, type ChainId } from "@atlas/schemas";

import { createChainReader } from "./reader.js";

/**
 * Read-only live RPC check. Disabled unless explicitly enabled:
 *   ATLAS_LIVE_RPC=1 ATLAS_RPC_URL_1=https://... pnpm --filter @atlas/chain test
 * No transaction is signed or sent.
 */
const rpcUrl = process.env.ATLAS_RPC_URL_1?.trim();
const enabled = process.env.ATLAS_LIVE_RPC === "1" && Boolean(rpcUrl);

describe.skipIf(!enabled)("live Ethereum RPC", () => {
  it("reads a mined transaction and its receipt through the chain adapter", async () => {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl, { timeout: 20_000, retryCount: 0 }),
    });

    const block = await client.getBlock({ includeTransactions: true });
    const transaction = block.transactions.find((entry) => typeof entry !== "string");
    expect(transaction && typeof transaction !== "string").toBeTruthy();
    if (!transaction || typeof transaction === "string") return;

    const reader = createChainReader({ chainId: 1 as ChainId, rpcUrl: rpcUrl! });
    const mapped = await reader.getTransaction(transaction.hash);

    expect(mapped.hash).toBe(transaction.hash);
    expect(mapped.chainId).toBe(1);
    expect(mapped.blockNumber).toBe(Number(block.number));

    const receipt = await reader.getReceipt(transaction.hash);
    expect(receipt).not.toBeNull();
    expect(["success", "reverted"]).toContain(receipt?.status);
    expect(receipt?.blockNumber).toBe(Number(block.number));
  }, 40_000);

  it("distinguishes a missing transaction from an RPC failure", async () => {
    const reader = createChainReader({ chainId: 1 as ChainId, rpcUrl: rpcUrl! });
    await expect(reader.getTransaction(`0x${"0".repeat(64)}`)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  }, 30_000);
});
