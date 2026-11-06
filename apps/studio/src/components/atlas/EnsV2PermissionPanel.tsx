import { useState } from "react";
import { Panel } from "@/components/atlas/primitives";
import { atlasClient } from "@/api/atlasClient";
import type { EnsV2RoleResult } from "@atlas/schemas";
import type { ApiResult } from "@/api/types";

type ScopeMode = "root" | "name" | "resource";
type PermissionPreset = "1" | "16777216" | "1048576" | "65536" | "custom";
type EnsRoleResult = ApiResult<EnsV2RoleResult>;

const UINT256_MAX = (1n << 256n) - 1n;
const ROLE_PRESETS = [
  ["ROLE_REGISTRAR (1)", "1"],
  ["ROLE_SET_RESOLVER (16777216)", "16777216"],
  ["ROLE_SET_SUBREGISTRY (1048576)", "1048576"],
  ["ROLE_RENEW (65536)", "65536"],
] as const;
const EXAMPLES = {
  authorized: {
    account: "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3",
    role: "1",
  },
  denied: {
    account: "0xAd797f58aFD3265C00504382171eC0818262D3ca",
    role: "1",
  },
} as const;

function isDecimalUint256(value: string): boolean {
  if (!/^(0|[1-9][0-9]*)$/.test(value) || value.length > 78) return false;
  return BigInt(value) <= UINT256_MAX;
}

function explorerAddress(chainId: number, address: string): string {
  const host = chainId === 11155111 ? "sepolia.etherscan.io" : "etherscan.io";
  return `https://${host}/address/${address}`;
}

function resultError(result: Exclude<EnsRoleResult, { kind: "ok" }>): string {
  switch (result.kind) {
    case "unconfigured":
      return "ENSv2 permission checks are not configured for this Studio.";
    case "network-error":
      return `Network error: ${result.message}`;
    case "http-error":
      if (result.status === 429 || result.code === "RATE_LIMITED") {
        return `Rate limited: ${result.message}`;
      }
      return result.message;
    case "empty":
      return "The ENSv2 API returned no permission result.";
  }
}

export function EnsV2PermissionPanel() {
  const [account, setAccount] = useState("");
  const [scope, setScope] = useState<ScopeMode>("root");
  const [name, setName] = useState("");
  const [resource, setResource] = useState("");
  const [preset, setPreset] = useState<PermissionPreset>("1");
  const [customRole, setCustomRole] = useState("");
  const [result, setResult] = useState<EnsRoleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [unexpectedError, setUnexpectedError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const normalizedAccount = account.trim();
  const accountValid = /^0x[0-9a-fA-F]{40}$/.test(normalizedAccount);
  const nameValid =
    scope !== "name" ||
    (name.trim().length <= 255 &&
      name.trim().endsWith(".eth") &&
      name.trim().split(".").length <= 4 &&
      name
        .trim()
        .split(".")
        .every((label) => label.length > 0));
  const role = preset === "custom" ? customRole.trim() : preset;
  const roleValid = isDecimalUint256(role) && role !== "0";
  const resourceValue = scope === "root" ? "0" : resource.trim();
  const resourceValid = scope !== "resource" || isDecimalUint256(resourceValue);
  const canSubmit = accountValid && nameValid && roleValid && resourceValid && !loading;

  function updateInput(update: () => void) {
    update();
    setResult(null);
    setUnexpectedError("");
    setCopyMessage("");
  }

  async function checkRole(input: {
    account: string;
    role: string;
    name?: string;
    resource?: string;
  }) {
    setLoading(true);
    setResult(null);
    setUnexpectedError("");
    setCopyMessage("");
    try {
      setResult(await atlasClient.checkEnsV2Role(input));
    } catch {
      setUnexpectedError("The permission request failed unexpectedly. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    void checkRole({
      account: normalizedAccount,
      role,
      ...(scope === "name" ? { name: name.trim() } : { resource: resourceValue }),
    });
  }

  function runExample(example: (typeof EXAMPLES)[keyof typeof EXAMPLES]) {
    setAccount(example.account);
    setScope("root");
    setName("");
    setResource("");
    setPreset(example.role);
    setCustomRole("");
    void checkRole({ account: example.account, role: example.role, resource: "0" });
  }

  async function copyResult() {
    if (result?.kind !== "ok") return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
      setCopyMessage("JSON copied.");
    } catch {
      setCopyMessage("Clipboard access is unavailable. Select and copy the JSON below.");
    }
  }

  const proof = result?.kind === "ok" ? result.data : null;
  const error = result && result.kind !== "ok" ? resultError(result) : unexpectedError;

  return (
    <Panel>
      <h2 className="text-base font-semibold">ENSv2 · EAC permissions</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Read-only evidence from the configured ENSv2 registry. A root registrar role does not prove
        ABI ownership or name ownership.
      </p>

      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label="Real on-chain request examples"
      >
        <button
          type="button"
          onClick={() => runExample(EXAMPLES.authorized)}
          disabled={loading}
          className="min-h-10 rounded-lg border border-border bg-background px-3 text-left text-xs hover:bg-secondary disabled:opacity-50"
        >
          Run authorized root-role example · real on-chain request
        </button>
        <button
          type="button"
          onClick={() => runExample(EXAMPLES.denied)}
          disabled={loading}
          className="min-h-10 rounded-lg border border-border bg-background px-3 text-left text-xs hover:bg-secondary disabled:opacity-50"
        >
          Run denied root-role example · real on-chain request
        </button>
      </div>

      <form className="mt-4 space-y-3" onSubmit={submit} noValidate>
        <div>
          <label htmlFor="ensv2-account" className="block text-xs font-medium">
            Account address
          </label>
          <input
            id="ensv2-account"
            value={account}
            onChange={(event) => updateInput(() => setAccount(event.target.value))}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={account.length > 0 && !accountValid}
            aria-describedby="ensv2-account-hint"
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs"
          />
          <p id="ensv2-account-hint" className="mt-1 text-xs text-muted-foreground">
            Enter a 20-byte hexadecimal address.
          </p>
        </div>

        <div>
          <label htmlFor="ensv2-role" className="block text-xs font-medium">
            Permission role
          </label>
          <select
            id="ensv2-role"
            value={preset}
            onChange={(event) =>
              updateInput(() => setPreset(event.target.value as PermissionPreset))
            }
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          >
            {ROLE_PRESETS.map(([label, value]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="custom">Custom decimal uint256</option>
          </select>
          {preset === "custom" && (
            <div className="mt-2">
              <label htmlFor="ensv2-custom-role" className="block text-xs">
                Custom role bitmap (decimal uint256)
              </label>
              <input
                id="ensv2-custom-role"
                inputMode="numeric"
                value={customRole}
                onChange={(event) => updateInput(() => setCustomRole(event.target.value))}
                aria-invalid={customRole.length > 0 && !roleValid}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs"
              />
            </div>
          )}
        </div>

        <fieldset>
          <legend className="text-xs font-medium">Permission scope</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            {(
              [
                ["root", "Root resource (0)"],
                ["name", "ENS name"],
                ["resource", "Advanced resource"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="inline-flex min-h-8 items-center gap-2">
                <input
                  type="radio"
                  name="ensv2-scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => updateInput(() => setScope(value))}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {scope === "name" && (
          <div>
            <label htmlFor="ensv2-name" className="block text-xs font-medium">
              ENS name
            </label>
            <input
              id="ensv2-name"
              value={name}
              onChange={(event) => updateInput(() => setName(event.target.value))}
              placeholder="name.eth"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={name.length > 0 && !nameValid}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3"
            />
            {!nameValid && (
              <p className="mt-1 text-xs text-warning">
                Enter a .eth name with at most two sublevels.
              </p>
            )}
          </div>
        )}

        {scope === "resource" && (
          <div>
            <label htmlFor="ensv2-resource" className="block text-xs font-medium">
              Resource ID (decimal uint256)
            </label>
            <input
              id="ensv2-resource"
              inputMode="numeric"
              value={resource}
              onChange={(event) => updateInput(() => setResource(event.target.value))}
              aria-invalid={resource.length > 0 && !resourceValid}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Reading on-chain roles…" : "Check registry permission"}
        </button>
      </form>

      {loading && (
        <p role="status" aria-live="polite" className="mt-3 text-sm">
          Reading the configured registry at a pinned block…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 break-words text-sm text-warning">
          {error}
        </p>
      )}
      {proof && (
        <section
          aria-labelledby="ensv2-result-title"
          className="mt-4 rounded-xl border border-border bg-background p-4"
        >
          <h3 id="ensv2-result-title" className="text-lg font-semibold">
            {proof.authorized ? "Authorized" : "Denied"}
          </h3>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Chain ID</dt>
              <dd>{proof.chainId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Queried block</dt>
              <dd>{proof.blockNumber}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Account</dt>
              <dd className="break-all font-mono">
                <a
                  href={explorerAddress(proof.chainId, proof.account)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  {proof.account}
                </a>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Registry</dt>
              <dd className="break-all font-mono">
                <a
                  href={explorerAddress(proof.chainId, proof.registry)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  {proof.registry}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Resource</dt>
              <dd className="break-all font-mono">{proof.resource}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role bitmap</dt>
              <dd className="break-all font-mono">{proof.roleBitmap}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Required role</dt>
              <dd className="break-all font-mono">{proof.requiredRoles}</dd>
            </div>
            {proof.publisher && (
              <>
                <div>
                  <dt className="text-muted-foreground">Publisher name</dt>
                  <dd>{proof.publisher.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Publisher owner</dt>
                  <dd className="break-all font-mono">{proof.publisher.owner}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Resolver</dt>
                  <dd className="break-all font-mono">{proof.publisher.resolver ?? "None"}</dd>
                </div>
              </>
            )}
          </dl>

          {proof.warnings.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold">Registry warnings</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {proof.warnings.map((warning, index) => (
                  <li key={`${index}-${warning}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void copyResult()}
              className="min-h-9 rounded-lg border border-border px-3 text-xs hover:bg-secondary"
            >
              Copy JSON result
            </button>
            <a
              href={explorerAddress(proof.chainId, proof.registry)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline"
            >
              Open registry in {proof.chainId === 11155111 ? "Sepolia Etherscan" : "Etherscan"}
            </a>
            {copyMessage && (
              <span role="status" className="text-xs">
                {copyMessage}
              </span>
            )}
          </div>
          <label htmlFor="ensv2-result-json" className="mt-3 block text-xs font-medium">
            JSON response
          </label>
          <textarea
            id="ensv2-result-json"
            readOnly
            value={JSON.stringify(proof, null, 2)}
            rows={8}
            className="mt-1 w-full resize-y rounded-lg border border-border bg-code p-3 font-mono text-xs"
          />
        </section>
      )}
    </Panel>
  );
}
