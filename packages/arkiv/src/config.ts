import { createPublicClient, createWalletClient } from "@arkiv-network/sdk";
import type { PublicArkivClient, WalletArkivClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { privateKeyToAccount } from "viem/accounts";
import { http, type Hex } from "viem";

export interface ArkivEnvironment {
  accessKey: string;
  privateKey?: Hex;
}

export function readArkivEnvironment(env: NodeJS.ProcessEnv = process.env): ArkivEnvironment {
  const accessKey = env.ARKIV_ACCESS_KEY?.trim();
  if (!accessKey) {
    throw new Error("ARKIV_ACCESS_KEY is required to use the Rabdi network.");
  }

  const privateKey = env.ARKIV_PRIVATE_KEY?.trim();
  if (privateKey && !/^0x[0-9a-f]{64}$/i.test(privateKey)) {
    throw new Error("ARKIV_PRIVATE_KEY must be a 32-byte hexadecimal private key.");
  }

  return privateKey ? { accessKey, privateKey: privateKey as Hex } : { accessKey };
}

export function createArkivPublicClient(accessKey: string): PublicArkivClient {
  return createPublicClient({
    chain: rabdi({ accessKey }),
    transport: http(),
  });
}

export function createArkivWalletClient(environment: ArkivEnvironment): WalletArkivClient {
  if (!environment.privateKey) {
    throw new Error("ARKIV_PRIVATE_KEY is required for Arkiv writes.");
  }

  const account = privateKeyToAccount(environment.privateKey);
  return createWalletClient({
    chain: rabdi({ accessKey: environment.accessKey }),
    transport: http(),
    account,
  });
}
