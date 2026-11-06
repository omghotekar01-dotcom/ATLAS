/** Real browser-only Ethereum Foundation anon-rpc harness, using the Nym
 * mixnet specifier from the official wallet/app integration guide.
 * Never uses the passthrough worker, and never silently falls back to fetch.
 */
export const NYM_MAINNET_SPECIFIER = "0x3aCD9742C68F6d993066Ae25533e09b9e1f60eD0";

export function assertPublicRpcUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a valid HTTPS public RPC URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Anon-RPC demo requires an HTTPS URL without embedded credentials.");
  }
  return url.toString();
}

async function timeBound<T>(task: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Anon-RPC browser worker timed out.")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface AnonymousBlockProof {
  readonly method: "eth_blockNumber";
  readonly blockNumber: string;
  readonly workerSpecifier: string;
  readonly transport: "anon-rpc-browser-harness-nym";
  readonly bootstrap: "direct-one-time-specifier-read";
  readonly warning: string;
}

/**
 * A true worker.fetch request via the browser harness and Nym worker.
 * One bootstrap request reads the specifier through a direct RPC; only the
 * subsequent eth_blockNumber is attempted through the anonymous worker.
 */
async function withAnonymousRpc<T>(
  bootstrapUrlRaw: string,
  targetRpcUrlRaw: string,
  read: (rpc: (method: string, params?: string[]) => Promise<unknown>) => Promise<T>,
): Promise<T> {
  const bootstrap = assertPublicRpcUrl(bootstrapUrlRaw);
  const target = assertPublicRpcUrl(targetRpcUrlRaw);
  const { AnonRpcWorker } = await import("@anon-rpc/browser-harness");
  let serial = 0;
  const provider = {
    request: async ({ method, params }: { method: string; params?: unknown }) => {
      const response = await fetch(bootstrap, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++serial, method, params: params ?? [] }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok)
        throw new Error(`Specifier bootstrap RPC returned HTTP ${response.status}.`);
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("result" in body)) {
        throw new Error("Specifier bootstrap RPC returned invalid JSON-RPC data.");
      }
      return body.result;
    },
  };
  const worker = new AnonRpcWorker({
    address: NYM_MAINNET_SPECIFIER,
    preExisting: { rpcProvider: provider },
  });
  try {
    try {
      await timeBound(worker.ready, 55_000);
    } catch (cause) {
      throw new Error(
        `Nym bootstrap or worker initialization failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
        { cause },
      );
    }
    return await read(async (method, params = []) => {
      const id = ++serial;
      const response = await timeBound(
        worker.fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        }),
        40_000,
      ).catch((cause: unknown) => {
        throw new Error(
          `Nym worker RPC request failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
          { cause },
        );
      });
      if (!response.ok) throw new Error(`Anon-RPC Nym worker returned HTTP ${response.status}.`);
      const payload: unknown = await timeBound(response.json(), 5_000);
      if (
        !payload ||
        typeof payload !== "object" ||
        !("result" in payload) ||
        !("id" in payload) ||
        payload.id !== id ||
        !("jsonrpc" in payload) ||
        payload.jsonrpc !== "2.0" ||
        "error" in payload
      ) {
        throw new Error("Nym worker returned invalid JSON-RPC data.");
      }
      return payload.result;
    });
  } finally {
    worker.close();
  }
}

export async function anonymousBlockNumber(
  bootstrap: string,
  target: string,
): Promise<AnonymousBlockProof> {
  return withAnonymousRpc(bootstrap, target, async (rpc) => {
    const result = await rpc("eth_blockNumber");
    if (typeof result !== "string" || !/^0x[0-9a-f]{1,64}$/i.test(result)) {
      throw new Error("Nym worker returned no valid block number.");
    }
    return {
      method: "eth_blockNumber",
      blockNumber: BigInt(result).toString(),
      workerSpecifier: NYM_MAINNET_SPECIFIER,
      transport: "anon-rpc-browser-harness-nym",
      bootstrap: "direct-one-time-specifier-read",
      warning:
        "The bootstrap RPC is direct. The chain read used a hash-pinned Nym worker; independent exit-IP anonymity verification was not performed.",
    };
  });
}

export async function anonymousTransaction(
  bootstrap: string,
  target: string,
  chainId: number,
  hash: string,
) {
  if (![1, 11155111].includes(chainId) || !/^0x[0-9a-f]{64}$/i.test(hash)) {
    throw new Error("Choose a supported chain and provide a valid transaction hash.");
  }
  return withAnonymousRpc(bootstrap, target, async (rpc) => {
    const network = await rpc("eth_chainId");
    if (network !== `0x${chainId.toString(16)}`)
      throw new Error("Anonymous target is on the wrong chain.");
    const tx = await rpc("eth_getTransactionByHash", [hash]);
    if (tx === null) throw new Error("Transaction was not found on the selected chain.");
    if (
      !tx ||
      typeof tx !== "object" ||
      !("hash" in tx) ||
      typeof tx.hash !== "string" ||
      tx.hash.toLowerCase() !== hash.toLowerCase() ||
      !("blockNumber" in tx) ||
      (tx.blockNumber !== null &&
        (typeof tx.blockNumber !== "string" || !/^0x[0-9a-f]{1,64}$/i.test(tx.blockNumber)))
    ) {
      throw new Error("Nym worker returned an invalid transaction.");
    }
    return {
      hash: tx.hash,
      block: tx.blockNumber === null ? null : BigInt(tx.blockNumber).toString(),
    };
  });
}
