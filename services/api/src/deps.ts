import {
  ArkivEventRepository,
  ArkivFunctionRepository,
  checkArkivHealth,
  createArkivPublicClient,
} from "@atlas/arkiv";
import {
  readChainConfig,
  createChainReader,
  findSupportedChain,
  type ChainReader,
} from "@atlas/chain";
import type { EventSignatureRepository, FunctionSignatureRepository } from "@atlas/core";
import { getAddress } from "viem";
import {
  NotFoundError,
  UpstreamUnavailableError,
  type ChainId,
  type Selector,
  type Hash,
} from "@atlas/schemas";

export interface ChainStore {
  get(chainId: number): ChainReader;
}

export interface ApiDependencies {
  readonly functions: FunctionSignatureRepository;
  readonly events: EventSignatureRepository;
  readonly chains: ChainStore;
  readonly health: () => Promise<{ arkiv: { connected: boolean } }>;
  readonly version: string;
}

class UnconfiguredEventRepository implements EventSignatureRepository {
  constructor(private readonly reason: string) {}

  async findByTopic0(): Promise<never> {
    throw new UpstreamUnavailableError(this.reason);
  }
}

class UnconfiguredFunctionRepository implements FunctionSignatureRepository {
  constructor(private readonly reason: string) {}

  async findBySelector(): Promise<never> {
    throw new UpstreamUnavailableError(this.reason);
  }

  async findByRecordHash(): Promise<never> {
    throw new UpstreamUnavailableError(this.reason);
  }

  async searchBySignature(): Promise<never> {
    throw new UpstreamUnavailableError(this.reason);
  }
}

function configuredChains(env: Readonly<Record<string, string | undefined>>): ChainStore {
  const configs = new Map(
    readChainConfig(env).map((config) => [config.chainId, createChainReader(config)] as const),
  );

  return {
    get(chainId: number) {
      const reader = configs.get(chainId as ChainId);
      if (reader) return reader;
      const supported = findSupportedChain(chainId);
      if (!supported) {
        throw new NotFoundError(
          `Chain ${chainId} is not supported. Supported chains: Ethereum Mainnet (1), Ethereum Sepolia (11155111).`,
          { chainId },
        );
      }
      throw new UpstreamUnavailableError(
        `No RPC endpoint is configured for ${supported.name}; set ${supported.rpcEnvVar}.`,
        { chainId },
      );
    },
  };
}

export const API_VERSION = "0.1.0";

/**
 * Wires the service to real adapters from environment configuration. When Arkiv
 * is not configured, reads fail loudly with UPSTREAM_UNAVAILABLE; the service
 * never substitutes fixtures.
 */
export function createDefaultDependencies(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ApiDependencies {
  const accessKey = env.ARKIV_ACCESS_KEY?.trim();
  const creatorInput = env.ATLAS_ARKIV_CREATOR_ADDRESS?.trim();

  let functions: FunctionSignatureRepository;
  let events: EventSignatureRepository;
  let health: ApiDependencies["health"];

  if (accessKey && creatorInput) {
    const creator = getAddress(creatorInput);
    const client = createArkivPublicClient(accessKey);
    const repository = new ArkivFunctionRepository(client, creator);
    functions = repository as unknown as FunctionSignatureRepository;
    events = new ArkivEventRepository(client, creator) as unknown as EventSignatureRepository;
    health = async () => ({
      arkiv: { connected: (await checkArkivHealth(client)).status === "ok" },
    });
  } else {
    const reason =
      "Arkiv read access is not configured. Set ARKIV_ACCESS_KEY and ATLAS_ARKIV_CREATOR_ADDRESS.";
    functions = new UnconfiguredFunctionRepository(reason);
    events = new UnconfiguredEventRepository(reason);
    health = async () => ({ arkiv: { connected: false } });
  }

  return {
    functions,
    events,
    chains: configuredChains(env),
    health,
    version: API_VERSION,
  };
}

export type { Selector, Hash };
