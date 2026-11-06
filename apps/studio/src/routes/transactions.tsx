import { anonymousTransaction } from "@/lib/atlas/anon-rpc";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { atlasClient } from "@/api/atlasClient";
import type { ApiResult, TransactionInvestigation } from "@/api/types";
import { isHex } from "@/lib/atlas/hex";
import { PageHeader, Panel, Pill } from "@/components/atlas/primitives";
import { NotAvailable } from "@/components/atlas/NotAvailable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transaction Lab — ATLAS" },
      {
        name: "description",
        content: "Inspect a transaction's verified RPC facts and decoded calldata.",
      },
      { property: "og:title", content: "Transaction Lab — ATLAS" },
      {
        property: "og:description",
        content: "Look up a transaction and separate chain facts from interpretations.",
      },
    ],
  }),
  component: Transactions,
});

const NETWORKS = [
  { label: "Ethereum Mainnet", id: 1 },
  { label: "Ethereum Sepolia", id: 11155111 },
] as const;

function Facts({ data }: { data: TransactionInvestigation }) {
  const { transaction, receipt } = data;
  return (
    <Panel className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Verified RPC facts</h2>
        <Pill tone="success">source: {transaction.source}</Pill>
        {receipt && (
          <Pill tone={receipt.status === "success" ? "success" : "error"}>{receipt.status}</Pill>
        )}
      </div>
      <dl className="grid gap-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <dt className="text-muted-foreground">Hash</dt>
          <dd className="break-all font-mono text-xs">{transaction.hash}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-muted-foreground">Chain</dt>
          <dd>{transaction.chainId}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-muted-foreground">From</dt>
          <dd className="break-all font-mono text-xs">{transaction.from}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-muted-foreground">To</dt>
          <dd className="break-all font-mono text-xs">{transaction.to ?? "(contract creation)"}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-muted-foreground">Block</dt>
          <dd>{transaction.blockNumber ?? "pending / unknown"}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-muted-foreground">Receipt</dt>
          <dd>{receipt ? receipt.status : "not available yet"}</dd>
        </div>
      </dl>

      {data.functionDecode && (
        <div className="border-t border-border/70 pt-3">
          <h3 className="text-sm font-semibold">Decoded calldata</h3>
          <div className="mt-2 space-y-2">
            {data.functionDecode.decoded.map((attempt) => (
              <div key={attempt.signature} className="rounded-lg border border-border/70 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-xs">{attempt.signature}</code>
                  <Pill tone={attempt.decodeStatus === "success" ? "success" : "error"}>
                    {attempt.decodeStatus}
                  </Pill>
                </div>
                {attempt.decodeStatus === "success" && (
                  <ul className="mt-1 space-y-1 text-xs">
                    {attempt.arguments.map((argument) => (
                      <li key={argument.name} className="break-all">
                        <span className="text-muted-foreground">
                          {argument.name} ({argument.type}):{" "}
                        </span>
                        <code>{JSON.stringify(argument.value)}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.eventResults.length > 0 && (
        <div className="border-t border-border/70 pt-3">
          <h3 className="text-sm font-semibold">Decoded logs ({data.eventResults.length})</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {data.eventResults.map((result, index) => (
              <li key={`${result.topic0}-${index}`} className="break-all">
                <span className="text-muted-foreground">Log {index}: </span>
                {result.decoded.length === 0
                  ? "no canonical event signature"
                  : result.decoded.map((attempt) => attempt.signature).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.warnings.length > 0 && (
        <div className="border-t border-border/70 pt-3">
          <h3 className="text-sm font-semibold">Warnings</h3>
          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
            {data.warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-border/70 pt-3">
        <h3 className="text-sm font-semibold">Limitations</h3>
        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
          {data.limitations.map((limitation) => (
            <li key={limitation}>• {limitation}</li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function Result({ result }: { result: ApiResult<TransactionInvestigation> | null }) {
  if (!result) return null;
  if (result.kind === "unconfigured") {
    return (
      <NotAvailable
        title="Transaction analysis"
        requirements={[
          "Set VITE_ATLAS_API_URL to the ATLAS API",
          "Configure ATLAS_RPC_URL_1 or ATLAS_RPC_URL_11155111 on the API",
        ]}
      >
        The Studio has no API endpoint configured, so no request is sent.
      </NotAvailable>
    );
  }
  if (result.kind === "network-error" || result.kind === "http-error") {
    return (
      <Panel className="border-dashed">
        <div className="flex items-center gap-2">
          <Pill tone="error">Request failed</Pill>
          {result.kind === "http-error" && (
            <span className="text-sm text-muted-foreground">HTTP {result.status}</span>
          )}
        </div>
        <p className="mt-2 break-words text-sm text-muted-foreground">{result.message}</p>
      </Panel>
    );
  }
  if (result.kind === "empty") {
    return (
      <Panel className="border-dashed">
        <p className="text-sm text-muted-foreground">No transaction data returned.</p>
      </Panel>
    );
  }
  return <Facts data={result.data} />;
}

function Transactions() {
  const [privacy, setPrivacy] = useState(false);
  const [bootstrap, setBootstrap] = useState("");
  const [target, setTarget] = useState("");
  const [anon, setAnon] = useState<Awaited<ReturnType<typeof anonymousTransaction>> | null>(null);
  const [counts, setCounts] = useState({ anon: 0, failed: 0, direct: 0 });
  const [hash, setHash] = useState("");
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]["label"]>("Ethereum Mainnet");
  const [result, setResult] = useState<ApiResult<TransactionInvestigation> | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function analyze() {
    setLocalError(null);
    if (!isHex(hash, 32)) {
      setLocalError("A transaction hash must be 32 bytes of hex.");
      return;
    }
    const chain = NETWORKS.find((entry) => entry.label === network);
    if (!chain) {
      setLocalError("Choose a supported network.");
      return;
    }

    setBusy(true);
    setResult(null);
    setAnon(null);
    try {
      if (privacy) {
        setAnon(await anonymousTransaction(bootstrap, target, chain.id, hash));
        setCounts((current) => ({ ...current, anon: current.anon + 1 }));
        return;
      }
      setCounts((current) => ({ ...current, direct: current.direct + 1 }));
      setResult(await atlasClient.analyzeTransaction({ chainId: chain.id, hash }));
    } catch (error) {
      if (privacy) setCounts((current) => ({ ...current, failed: current.failed + 1 }));
      setLocalError(error instanceof Error ? error.message : "Transaction request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Investigate"
        title="Transaction Lab"
        description="Look up a transaction from a configured RPC endpoint. Chain facts are separated from signature interpretations."
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="space-y-5 lg:col-span-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="tx" className="text-sm font-medium">
                Transaction hash
              </label>
              {hash.trim() &&
                (isHex(hash, 32) ? (
                  <Pill tone="success">valid</Pill>
                ) : (
                  <Pill tone="warning">expects 32 bytes hex</Pill>
                ))}
            </div>
            <input
              id="tx"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              spellCheck={false}
              placeholder="0x…"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-[13px] outline-none placeholder:text-subtle focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Network</label>
            <Select value={network} onValueChange={(value) => setNetwork(value as typeof network)}>
              <SelectTrigger className="h-10 rounded-lg bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NETWORKS.map((entry) => (
                  <SelectItem key={entry.id} value={entry.label}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              ATLAS only reads chains with a configured RPC endpoint. Other networks are not
              advertised.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={privacy}
              disabled={busy}
              onChange={(event) => {
                setPrivacy(event.target.checked);
                setResult(null);
                setAnon(null);
              }}
            />
            Use Nym privacy mode
          </label>
          <p className="text-xs text-muted-foreground">
            {privacy
              ? "Nym reads the transaction in this browser. Specifier bootstrap is direct. Decode and receipts are excluded. No direct fallback."
              : "Standard analysis uses the API's configured direct RPC."}
          </p>
          {privacy && (
            <div className="space-y-2">
              <label className="block text-sm">
                Public Mainnet bootstrap RPC
                <input
                  type="url"
                  className="block w-full rounded border border-input bg-background px-2 py-1"
                  value={bootstrap}
                  onChange={(event) => setBootstrap(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="block text-sm">
                Public destination RPC
                <input
                  type="url"
                  className="block w-full rounded border border-input bg-background px-2 py-1"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  disabled={busy}
                />
              </label>
            </div>
          )}
          <p className="text-xs text-muted-foreground" role="status">
            This page session: {counts.anon} Nym lookups completed, {counts.failed} failed,{" "}
            {counts.direct} direct analyses requested, 0 automatic fallbacks.
          </p>
          {localError && <p className="text-sm text-error">{localError}</p>}
          <Button disabled={busy} className="rounded-xl" onClick={analyze}>
            {busy ? "Analyzing…" : "Analyze transaction"}
          </Button>
        </Panel>
        <div className="space-y-4 lg:col-span-2">
          <Result result={result} />
          {anon && (
            <Panel className="space-y-2">
              <h2 className="font-semibold">Nym RPC transaction lookup</h2>
              <p className="break-all font-mono text-xs">{anon.hash}</p>
              <p className="text-sm">Block {anon.block ?? "pending"}</p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
