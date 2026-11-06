import {
  HashSchema,
  NotFoundError,
  UpstreamUnavailableError,
  type ChainId,
  type Hash,
} from "@atlas/schemas";
import {
  createPublicClient,
  http,
  type Hash as ViemHash,
  type PublicClient,
  type Transaction,
} from "viem";

import { findSupportedChain, type ChainRpcConfig } from "./chains.js";

export interface ChainTransaction {
  readonly hash: Hash;
  readonly chainId: ChainId;
  readonly from: string;
  readonly to: string | null;
  readonly input: string;
  readonly blockNumber: number | null;
}

export interface ChainLog {
  readonly address: string;
  readonly topics: readonly string[];
  readonly data: string;
}

export interface ChainReceipt {
  readonly status: "success" | "reverted";
  readonly logs: readonly ChainLog[];
  readonly blockNumber: number;
}

/** Read-only chain access. One instance is bound to one chain. */
export interface ChainReader {
  readonly chainId: ChainId;
  getTransaction(hash: string): Promise<ChainTransaction>;
  getReceipt(hash: string): Promise<ChainReceipt | null>;
  getBlockNumber(): Promise<bigint>;
}

export const DEFAULT_CHAIN_TIMEOUT_MS = 10_000;

function isTransactionNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TransactionNotFoundError" || error.name === "TransactionReceiptNotFoundError")
  );
}

function unavailable(chainId: ChainId, action: string, error: unknown): UpstreamUnavailableError {
  return new UpstreamUnavailableError(
    `The RPC endpoint for chain ${chainId} failed while ${action}.`,
    { chainId },
    { cause: error },
  );
}

function toNumber(value: bigint | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function mapTransaction(transaction: Transaction, chainId: ChainId): ChainTransaction {
  return {
    hash: HashSchema.parse(transaction.hash),
    chainId,
    from: transaction.from,
    to: transaction.to,
    input: transaction.input ?? "0x",
    blockNumber: toNumber(transaction.blockNumber),
  };
}

export function createChainReaderFromClient(client: PublicClient, chainId: ChainId): ChainReader {
  return {
    chainId,
    async getTransaction(hash: string) {
      const parsed = HashSchema.safeParse(hash);
      if (!parsed.success) {
        throw new NotFoundError(`"${hash}" is not a 32-byte transaction hash.`);
      }

      let transaction: Transaction | null;
      try {
        transaction = await client.getTransaction({ hash: parsed.data as ViemHash });
      } catch (error) {
        if (isTransactionNotFound(error)) {
          throw new NotFoundError(
            `Transaction ${parsed.data} was not found on chain ${chainId}. It may not exist or may not have been propagated to this RPC.`,
            { hash: parsed.data, chainId },
          );
        }
        throw unavailable(chainId, "fetching the transaction", error);
      }

      if (!transaction) {
        throw new NotFoundError(`Transaction ${parsed.data} was not found on chain ${chainId}.`, {
          hash: parsed.data,
          chainId,
        });
      }

      return mapTransaction(transaction, chainId);
    },
    async getReceipt(hash: string) {
      const parsed = HashSchema.safeParse(hash);
      if (!parsed.success) {
        throw new NotFoundError(`"${hash}" is not a 32-byte transaction hash.`);
      }

      try {
        const receipt = await client.getTransactionReceipt({ hash: parsed.data as ViemHash });
        return {
          status: receipt.status === "success" ? "success" : "reverted",
          blockNumber: toNumber(receipt.blockNumber) ?? 0,
          logs: receipt.logs.map((log) => ({
            address: log.address,
            topics: log.topics,
            data: log.data,
          })),
        };
      } catch (error) {
        if (isTransactionNotFound(error)) return null;
        throw unavailable(chainId, "fetching the transaction receipt", error);
      }
    },
    async getBlockNumber() {
      try {
        return await client.getBlockNumber();
      } catch (error) {
        throw unavailable(chainId, "reading the latest block", error);
      }
    },
  };
}

/** Builds a reader for a configured chain; unknown chains are rejected. */
export function createChainReader(
  config: ChainRpcConfig,
  options: { timeoutMs?: number } = {},
): ChainReader {
  const supported = findSupportedChain(config.chainId);
  if (!supported) {
    throw new NotFoundError(
      `Chain ${config.chainId} is not supported by ATLAS. Supported chains: ${[1, 11155111].join(", ")}.`,
      { chainId: config.chainId },
    );
  }

  const client = createPublicClient({
    chain: supported.chain,
    transport: http(config.rpcUrl, {
      timeout: options.timeoutMs ?? DEFAULT_CHAIN_TIMEOUT_MS,
      retryCount: 0,
    }),
  });

  return createChainReaderFromClient(client, config.chainId);
}
