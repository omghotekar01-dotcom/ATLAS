import { useState } from "react";
import { ChevronDown, Fingerprint, ShieldCheck, ShieldX, Copy, ExternalLink } from "lucide-react";
import type { EnsV2RoleResult } from "@atlas/schemas";
import type { FunctionCandidate } from "@/api/types";
import { atlasClient, type EnsV2RoleQuery } from "@/api/atlasClient";

const EXAMPLE_AUTHORIZED = "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3";
const EXAMPLE_DENIED = "0xAd797f58aFD3265C00504382171eC0818262D3ca";
const ACCOUNT_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/**
 * This is an evidence bundle for two independent observations.
 * No ENSv2 role check binds an ENS name to a Solidity source or an Arkiv record.
 */
export function makePublisherEvidence(
  candidate: FunctionCandidate,
  selector: string,
  query: EnsV2RoleQuery,
  proof: EnsV2RoleResult,
) {
  return {
    format: "atlas-publisher-evidence-v1" as const,
    source: {
      selector,
      signature: candidate.signature,
      sourceRepository: candidate.source,
      sourceId: candidate.sourceId,
      recordHash: candidate.provenance.recordHash,
      arkivEntityKey: candidate.entityKey,
    },
    ensv2: {
      queriedAccount: query.account,
      requestedName: query.name ?? null,
      requestedResource: query.resource ?? null,
      requestedRole: query.role ?? "16777216",
      proof,
    },
    sourceBindingVerified: false as const,
    limitation:
      "The ENSv2 role response proves permission at the queried registry/block only. No signed or on-chain binding between this account/name and the ABI source is provided.",
  };
}

export function PublisherEvidence({
  candidate,
  selector,
}: {
  candidate: FunctionCandidate;
  selector: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [evidence, setEvidence] = useState<ReturnType<typeof makePublisherEvidence> | null>(null);

  const normalizedAccount = account.trim();
  const normalizedName = name.trim();
  const nameValid =
    !normalizedName ||
    (normalizedName.length <= 255 &&
      normalizedName.toLowerCase().endsWith(".eth") &&
      normalizedName.split(".").length <= 4 &&
      normalizedName.split(".").every(Boolean));
  const canCheck = ACCOUNT_PATTERN.test(normalizedAccount) && nameValid && !loading;

  function resetEvidence() {
    setEvidence(null);
    setError("");
    setCopied("");
  }

  async function verify(query: EnsV2RoleQuery) {
    setLoading(true);
    resetEvidence();
    try {
      const response = await atlasClient.checkEnsV2Role(query);
      if (response.kind === "ok") {
        setEvidence(makePublisherEvidence(candidate, selector, query, response.data));
      } else if (response.kind === "http-error" || response.kind === "network-error") {
        setError(response.message);
      } else {
        setError("The ENSv2 registry check is unavailable or has no result.");
      }
    } catch {
      setError("The live ENSv2 check could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  function runExample(address: string) {
    setAccount(address);
    setName("");
    setRole("1");
    void verify({ account: address, resource: "0", role: "1" });
  }

  async function copyEvidence() {
    if (!evidence) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(evidence, null, 2));
      setCopied("Evidence JSON copied.");
    } catch {
      setCopied("Clipboard unavailable; select the JSON below to copy it.");
    }
  }

  const proof = evidence?.ensv2.proof;
  const explorerUrl = proof
    ? `https://${proof.chainId === 11155111 ? "sepolia." : ""}etherscan.io/address/${proof.registry}`
    : "";

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card/60 shadow-sm">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-secondary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Fingerprint className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">
              ENSv2 · Publisher permission
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Live registry check · Provenance evidence
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full border border-border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:inline-flex">
            Read-only
          </span>
          <ChevronDown aria-hidden="true" className={expanded ? "size-4 rotate-180" : "size-4"} />
        </span>
      </button>
      {expanded && (
        <div className="space-y-4 border-t border-border bg-background/30 p-4 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                01 / Arkiv source
              </p>
              <p className="mt-2 break-all font-mono text-xs">{candidate.signature}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                02 / ENSv2 authority
              </p>
              <p className="mt-2 text-xs">Sepolia · Permissioned Registry</p>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Compare this Arkiv signature record with a live ENSv2 registry permission. These are
            independent evidence sources, NOT proof that the ENS account owns, signed, or published
            this ABI.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => runExample(EXAMPLE_AUTHORIZED)}
              className="min-h-10 rounded-xl border border-border bg-card px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              Live authorized root-role example
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => runExample(EXAMPLE_DENIED)}
              className="min-h-10 rounded-xl border border-border bg-card px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              Live denied root-role example
            </button>
          </div>
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canCheck) return;
              void verify({
                account: normalizedAccount,
                role,
                ...(normalizedName ? { name: normalizedName } : { resource: "0" }),
              });
            }}
          >
            <label className="block text-xs font-medium">
              Publisher account to check
              <input
                value={account}
                onChange={(event) => {
                  setAccount(event.target.value);
                  resetEvidence();
                }}
                placeholder="0x…"
                spellCheck={false}
                autoComplete="off"
                aria-invalid={account.length > 0 && !ACCOUNT_PATTERN.test(normalizedAccount)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs"
              />
            </label>
            <label className="block text-xs font-medium">
              ENS .eth name (optional; empty means root resource)
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  resetEvidence();
                }}
                placeholder="publisher.eth"
                spellCheck={false}
                aria-invalid={!nameValid}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs"
              />
            </label>
            <label className="block text-xs font-medium">
              Permission
              <select
                value={role}
                onChange={(event) => {
                  setRole(event.target.value);
                  resetEvidence();
                }}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs"
              >
                <option value="1">Registrar (1)</option>
                <option value="16777216">Set resolver (16777216)</option>
                <option value="1048576">Set subregistry (1048576)</option>
                <option value="65536">Renew (65536)</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={!canCheck}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Checking Sepolia…" : "Verify permission on-chain"}
            </button>
          </form>
          {error && (
            <p role="alert" className="text-xs text-warning">
              {error}
            </p>
          )}
          {proof && evidence && (
            <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {proof.authorized ? (
                    <ShieldCheck className="size-5 text-emerald-500" />
                  ) : (
                    <ShieldX className="size-5 text-amber-500" />
                  )}
                  <span role="status" className="text-sm font-semibold">
                    ENSv2 role: {proof.authorized ? "AUTHORIZED" : "DENIED"}
                  </span>
                </span>
                <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  Block {proof.blockNumber}
                </span>
              </div>
              <p className="break-all text-muted-foreground">Registry: {proof.registry}</p>
              <p className="break-all text-muted-foreground">
                Resource: {proof.resource} · Required role: {proof.requiredRoles}
              </p>
              {proof.publisher && (
                <p className="break-all text-muted-foreground">
                  Name: {proof.publisher.name} · Registry owner: {proof.publisher.owner}
                </p>
              )}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="font-semibold text-amber-500">
                  Source-to-publisher binding: NOT VERIFIED
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Registry permissions do not prove ABI authorship or publication.
                </p>
              </div>
              {proof.warnings.map((warning, index) => (
                <p key={index} className="text-muted-foreground">
                  {warning}
                </p>
              ))}
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-primary underline"
              >
                <ExternalLink className="mr-1 inline size-3" aria-hidden="true" />
                Inspect registry on Etherscan
              </a>
              <div>
                <button
                  type="button"
                  onClick={() => void copyEvidence()}
                  className="rounded-lg border border-border px-3 py-2 hover:bg-secondary"
                >
                  <Copy className="mr-1 inline size-3" aria-hidden="true" />
                  Copy combined source + ENSv2 evidence
                </button>
                {copied && (
                  <span role="status" className="ml-2">
                    {copied}
                  </span>
                )}
              </div>
              <details>
                <summary className="cursor-pointer">Inspect raw evidence JSON</summary>
                <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-code p-2">
                  {JSON.stringify(evidence, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
