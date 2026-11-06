export const RABDI_CHAIN_ID = 7794095;

export interface ArkivHealthClient {
  getChainId(): Promise<number>;
}

export type ArkivHealthResult =
  | {
      status: "ok";
      network: "rabdi";
      chainId: typeof RABDI_CHAIN_ID;
      latencyMs: number;
    }
  | {
      status: "wrong-network";
      network: "rabdi";
      expectedChainId: typeof RABDI_CHAIN_ID;
      actualChainId: number;
      latencyMs: number;
    }
  | {
      status: "unavailable";
      network: "rabdi";
      code: "NETWORK_UNAVAILABLE";
      message: string;
      latencyMs: number;
    };

export async function checkArkivHealth(client: ArkivHealthClient): Promise<ArkivHealthResult> {
  const startedAt = performance.now();
  let chainId: number;

  try {
    chainId = await client.getChainId();
  } catch {
    return {
      status: "unavailable",
      network: "rabdi",
      code: "NETWORK_UNAVAILABLE",
      message: "Could not reach Rabdi. Check ARKIV_ACCESS_KEY and RPC connectivity.",
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  if (chainId !== RABDI_CHAIN_ID) {
    return {
      status: "wrong-network",
      network: "rabdi",
      expectedChainId: RABDI_CHAIN_ID,
      actualChainId: chainId,
      latencyMs,
    };
  }

  return { status: "ok", network: "rabdi", chainId: RABDI_CHAIN_ID, latencyMs };
}
