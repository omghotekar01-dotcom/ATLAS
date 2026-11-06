import { useState } from "react";
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
  const [evidence, setEvidence] = useState<ReturnType<typeof makePublisherEvidence> | null>(
    null,
  );

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
    <section className="mt-4 border-t border-border pt-4">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="text-sm font-medium text-primary hover:underline"
      >
        {expanded ? "Hide ENSv2 publisher permission evidence" : "Check ENSv2 publisher permission"}
      </button>
      {expanded && (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            Compare this Arkiv signature record with a live ENSv2 registry permission.
            These are independent evidence sources, NOT proof that the ENS account owns,
            signed, or published this ABI.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => runExample(EXAMPLE_AUTHORIZED)}
              className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary disabled:opacity-50"
            >
              Live authorized root-role example
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => runExample(EXAMPLE_DENIED)}
              className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary disabled:opacity-50"
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
            <div className="space-y-2 rounded-lg border border-border p-3 text-xs">
              <p role="status" className="font-semibold">
                ENSv2 role: {proof.authorized ? "AUTHORIZED" : "DENIED"} · Sepolia block{" "}
                {proof.blockNumber}
              </p>
              <p className="break-all text-muted-foreground">
                Registry: {proof.registry}
              </p>
              <p className="break-all text-muted-foreground">
                Resource: {proof.resource} · Required role: {proof.requiredRoles}
              </p>
              {proof.publisher && (
                <p className="break-all text-muted-foreground">
                  Name: {proof.publisher.name} · Registry owner: {proof.publisher.owner}
                </p>
              )}
              <p className="font-medium text-warning">
                Source-to-publisher binding: NOT VERIFIED
              </p>
              {proof.warnings.map((warning, index) => (
                <p key={index} className="text-muted-foreground">{warning}</p>
              ))}
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-primary underline"
              >
                Inspect registry on Etherscan
              </a>
              <div>
                <button
                  type="button"
                  onClick={() => void copyEvidence()}
                  className="rounded-lg border border-border px-3 py-2 hover:bg-secondary"
                >
                  Copy combined source + ENSv2 evidence
                </button>
                {copied && <span role="status" className="ml-2">{copied}</span>}
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
