import { describe, expect, it } from "vitest";
import { NotFoundError, UpstreamUnavailableError } from "@atlas/schemas";

import { readChainConfig, findSupportedChain } from "./chains.js";
import { createChainReader, createChainReaderFromClient } from "./reader.js";
import { fakeClient, FROM, RAW_RECEIPT, RAW_TRANSACTION, TO, TX_HASH } from "./test-fixtures.js";

function readerFor(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const client = fakeClient((method) => {
    calls.push(method);
    if (overrides.throwOn === method) throw new Error("socket hang up");
    if (method === "eth_getTransactionByHash")
      return "transaction" in overrides ? overrides.transaction : RAW_TRANSACTION;
    if (method === "eth_getTransactionReceipt")
      return "receipt" in overrides ? overrides.receipt : RAW_RECEIPT;
    if (method === "eth_blockNumber") return "0x20";
    throw new Error(`unexpected RPC method ${method}`);
  });
  return { reader: createChainReaderFromClient(client, 1 as never), calls };
}

describe("chain configuration", () => {
  it("only reports chains with an operator-supplied endpoint", () => {
    expect(readChainConfig({})).toEqual([]);
    expect(
      readChainConfig({ ATLAS_RPC_URL_1: "https://rpc.example", ATLAS_RPC_URL_137: "x" }),
    ).toEqual([{ chainId: 1, rpcUrl: "https://rpc.example" }]);
    expect(findSupportedChain(1)?.name).toBe("Ethereum Mainnet");
    expect(findSupportedChain(137)).toBeUndefined();
  });

  it("refuses to construct a reader for an unsupported chain", () => {
    expect(() =>
      createChainReader({ chainId: 137 as never, rpcUrl: "https://rpc.example" }),
    ).toThrow(NotFoundError);
  });
});

describe("transaction retrieval", () => {
  it("returns verified on-chain transaction fields", async () => {
    const { reader } = readerFor();

    const transaction = await reader.getTransaction(TX_HASH);

    expect(transaction).toEqual({
      hash: TX_HASH,
      chainId: 1,
      from: FROM,
      to: TO,
      input: "0xa9059cbb",
      blockNumber: 16,
    });
  });

  it("maps a successful receipt", async () => {
    const { reader } = readerFor();

    const receipt = await reader.getReceipt(TX_HASH);

    expect(receipt).toMatchObject({ status: "success", blockNumber: 16, logs: [] });
  });

  it("maps a reverted receipt", async () => {
    const { reader } = readerFor({ receipt: { ...RAW_RECEIPT, status: "0x0" } });

    await expect(reader.getReceipt(TX_HASH)).resolves.toMatchObject({ status: "reverted" });
  });

  it("returns null for a pending transaction receipt", async () => {
    const { reader } = readerFor({ receipt: null });

    await expect(reader.getReceipt(TX_HASH)).resolves.toBeNull();
    await expect(reader.getTransaction(TX_HASH)).resolves.toMatchObject({ hash: TX_HASH });
  });

  it("reports an unknown transaction as not found", async () => {
    const { reader } = readerFor({ transaction: null });

    await expect(reader.getTransaction(TX_HASH)).rejects.toBeInstanceOf(NotFoundError);
    await expect(reader.getTransaction(TX_HASH)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects malformed hashes before calling the RPC", async () => {
    const { reader, calls } = readerFor();

    await expect(reader.getTransaction("0x1234")).rejects.toBeInstanceOf(NotFoundError);
    expect(calls).toEqual([]);
  });

  it("surfaces RPC outages as upstream failures", async () => {
    const { reader } = readerFor({ throwOn: "eth_getTransactionByHash" });

    await expect(reader.getTransaction(TX_HASH)).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it("reads the latest block", async () => {
    const { reader } = readerFor();
    await expect(reader.getBlockNumber()).resolves.toBe(32n);
  });
});
