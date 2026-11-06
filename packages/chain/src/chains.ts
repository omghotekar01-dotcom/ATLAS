import { ChainIdSchema, type ChainId } from "@atlas/schemas";
import { mainnet, sepolia, type Chain } from "viem/chains";

export interface SupportedChain {
  readonly chainId: ChainId;
  readonly name: string;
  /** viem chain definition used for formatting and contract calls. */
  readonly chain: Chain;
  /** Environment variable that must contain an RPC endpoint. */
  readonly rpcEnvVar: string;
}

/**
 * Chains ATLAS can read on demand. Only chains with an operator-supplied RPC
 * endpoint are advertised as operational; nothing here implies an index.
 */
export const SUPPORTED_CHAINS: readonly SupportedChain[] = [
  {
    chainId: ChainIdSchema.parse(1),
    name: "Ethereum Mainnet",
    chain: mainnet,
    rpcEnvVar: "ATLAS_RPC_URL_1",
  },
  {
    chainId: ChainIdSchema.parse(11155111),
    name: "Ethereum Sepolia",
    chain: sepolia,
    rpcEnvVar: "ATLAS_RPC_URL_11155111",
  },
];

export function findSupportedChain(chainId: number): SupportedChain | undefined {
  return SUPPORTED_CHAINS.find((entry) => entry.chainId === chainId);
}

export interface ChainRpcConfig {
  readonly chainId: ChainId;
  readonly rpcUrl: string;
}

/** Reads RPC endpoints from the environment. No default endpoint is invented. */
export function readChainConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ChainRpcConfig[] {
  return SUPPORTED_CHAINS.flatMap((entry) => {
    const rpcUrl = env[entry.rpcEnvVar]?.trim();
    return rpcUrl ? [{ chainId: entry.chainId, rpcUrl }] : [];
  });
}
