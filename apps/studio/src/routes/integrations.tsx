import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Database, RadioTower, ShieldAlert, RefreshCw } from "lucide-react";
import { PageHeader, Panel, Pill } from "@/components/atlas/primitives";
import { atlasClient, getApiBaseUrl } from "@/api/atlasClient";
import { EnsV2PermissionPanel } from "@/components/atlas/EnsV2PermissionPanel";
import { anonymousBlockNumber, type AnonymousBlockProof } from "@/lib/atlas/anon-rpc";

type Health = Awaited<ReturnType<typeof atlasClient.health>>;
type Artifact = Awaited<ReturnType<typeof atlasClient.getSwarmArtifact>>;
export const Route = createFileRoute("/integrations")({ component: Integrations });
const sponsorStates = [
  ["Arkiv", "arkiv"],
  ["Swarm", "swarm"],
  ["ENSv2", "ensv2"],
  ["0G Private Computer", "zeroG"],
  ["Ethereum Foundation Anon-RPC", "anonRpc"],
] as const;
function Integrations() {
  const [status, setStatus] = useState<Awaited<
    ReturnType<typeof atlasClient.integrationStatus>
  > | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [anonBootstrap, setAnonBootstrap] = useState("");
  const [anonTarget, setAnonTarget] = useState("");
  const [anonProof, setAnonProof] = useState<AnonymousBlockProof | null>(null);
  const [anonError, setAnonError] = useState("");
  const [anonLoading, setAnonLoading] = useState(false);
  async function checkAnon() {
    setAnonLoading(true);
    setAnonProof(null);
    setAnonError("");
    try {
      setAnonProof(await anonymousBlockNumber(anonBootstrap, anonTarget));
    } catch (error) {
      setAnonError(error instanceof Error ? error.message : "Nym worker request failed.");
    } finally {
      setAnonLoading(false);
    }
  }
  const [swarmReference, setSwarmReference] = useState("");
  const [swarmResult, setSwarmResult] = useState<Artifact | null>(null);
  const [swarmLoading, setSwarmLoading] = useState(false);
  async function readSwarm() {
    setSwarmLoading(true);
    setSwarmResult(null);
    try {
      setSwarmResult(await atlasClient.getSwarmArtifact(swarmReference.trim()));
    } finally {
      setSwarmLoading(false);
    }
  }
  function refresh() {
    setLoading(true);
    void Promise.all([atlasClient.health(), atlasClient.integrationStatus()])
      .then(([healthResult, statusResult]) => {
        setHealth(healthResult);
        setStatus(statusResult);
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    refresh();
  }, []);
  const connected = health?.kind === "ok";
  const arkiv = connected ? health.data.arkiv?.connected : undefined;
  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Integrations"
        description="Live evidence first. Only connections reported by the current API are marked operational; future sponsor ideas are labelled as unverified."
      >
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm hover:bg-secondary"
        >
          <RefreshCw className="size-4" />
          {loading ? "Checking…" : "Refresh health"}
        </button>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <div className="flex items-center gap-3">
            <Activity className="size-5 text-primary" />
            <h2 className="text-base font-semibold">ATLAS API</h2>
            <span className="ml-auto">
              <Pill
                tone={
                  connected ? "success" : health?.kind === "unconfigured" ? "neutral" : "warning"
                }
              >
                {connected ? health.data.status : (health?.kind ?? "Checking")}
              </Pill>
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Actual configured endpoint:</p>
          <code className="mt-2 block break-all rounded-lg bg-code p-3 text-xs">
            {getApiBaseUrl() ?? "Not configured"}
          </code>
          <p className="mt-3 text-sm text-muted-foreground">
            {connected
              ? `API version: ${health.data.version}`
              : "API health is not confirmed. No sponsor claims are inferred."}
          </p>
          <Link to="/status" className="mt-3 inline-flex text-sm text-primary hover:underline">
            Open service status
          </Link>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3">
            <Database className="size-5 text-primary" />
            <h2 className="text-base font-semibold">Arkiv canonical registry</h2>
            <span className="ml-auto">
              <Pill tone={arkiv === true ? "success" : arkiv === false ? "warning" : "neutral"}>
                {arkiv === true ? "Connected" : arkiv === false ? "Disconnected" : "Not confirmed"}
              </Pill>
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Canonical signature reads are verified against the trusted source/creator and pinned
            provenance. One OpenZeppelin function has a published Rabdi read-back proof; this does
            not establish complete catalogue coverage.
          </p>
          <Link to="/explorer" className="mt-3 inline-flex text-sm text-primary hover:underline">
            Check a known selector
          </Link>
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <EnsV2PermissionPanel />
        <Panel>
          <h2 className="text-base font-semibold">Ethereum Foundation Anon-RPC · Nym</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Experimental, browser-only hash-pinned Nym worker. Bootstrap reads are direct. No
            fallback on worker failure. Enter public HTTPS RPC URLs only (no API keys or wallet
            secrets).
          </p>
          <form
            className="mt-3 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void checkAnon();
            }}
          >
            <label htmlFor="anon-bootstrap" className="block text-xs">
              Public Ethereum mainnet bootstrap RPC
            </label>
            <input
              id="anon-bootstrap"
              value={anonBootstrap}
              onChange={(event) => setAnonBootstrap(event.target.value)}
              placeholder="https://…"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs"
            />
            <label htmlFor="anon-target" className="block text-xs">
              Public target RPC URL through Nym
            </label>
            <input
              id="anon-target"
              value={anonTarget}
              onChange={(event) => setAnonTarget(event.target.value)}
              placeholder="https://…"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs"
            />
            <button
              type="submit"
              disabled={anonLoading || !anonBootstrap.trim() || !anonTarget.trim()}
              className="h-10 rounded-lg bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
            >
              {anonLoading ? "Starting Nym worker…" : "Read block through Nym"}
            </button>
          </form>
          {anonProof && (
            <p role="status" className="mt-3 text-xs">
              Nym worker returned Ethereum block {anonProof.blockNumber}. {anonProof.warning}
            </p>
          )}
          {anonError && (
            <p role="alert" className="mt-3 text-xs text-warning">
              Anon-RPC unavailable: {anonError}. Direct fallback was not attempted.
            </p>
          )}
        </Panel>
      </div>
      <Panel className="mt-4">
        <h2 className="text-base font-semibold">Swarm public artifact reader</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Download real bytes from the API server's configured Bee endpoint. No upload, postage
          purchase or Arkiv-link verification occurs here.
        </p>
        <form
          className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void readSwarm();
          }}
        >
          <label htmlFor="swarm-reference" className="sr-only">
            Swarm artifact reference
          </label>
          <input
            id="swarm-reference"
            value={swarmReference}
            onChange={(event) => setSwarmReference(event.target.value)}
            placeholder="64-hex Swarm reference"
            autoComplete="off"
            spellCheck={false}
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-xs"
          />
          <button
            type="submit"
            disabled={swarmLoading || !swarmReference.trim()}
            className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {swarmLoading ? "Reading…" : "Read actual Swarm artifact"}
          </button>
        </form>
        {swarmResult && (
          <div
            className="mt-3 break-words rounded-lg border border-border p-3 text-xs"
            role="status"
          >
            {swarmResult.kind === "ok" ? (
              <>
                <p>
                  Read {swarmResult.data.bytes} real bytes ({swarmResult.data.contentType})
                </p>
                <p className="mt-2 break-all font-mono">SHA-256: {swarmResult.data.sha256}</p>
                <p className="mt-2 text-muted-foreground">
                  This reference is not automatically an Arkiv-linked or trusted artifact.
                </p>
              </>
            ) : (
              <p>
                {swarmResult.kind === "http-error"
                  ? swarmResult.message
                  : swarmResult.kind === "network-error"
                    ? swarmResult.message
                    : "Swarm API is unconfigured or returned no result."}
              </p>
            )}
          </div>
        )}
      </Panel>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel>
          <div className="flex items-center gap-2">
            <RadioTower className="size-5 text-primary" />
            <h2 className="text-base font-semibold">4byte.directory</h2>
            <Pill>Read-only community</Pill>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Optional remote suggestions, not an Arkiv mirror or verified ABI. Availability depends
            on the live upstream request.
          </p>
          <Link to="/explorer" className="mt-3 inline-flex text-sm text-primary hover:underline">
            Compare selectors
          </Link>
        </Panel>
        <Panel>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-warning" />
            <h2 className="text-base font-semibold">Sponsor probe status</h2>
          </div>
          <ul className="mt-3 space-y-3">
            {sponsorStates.map(([name, key]) => (
              <li
                key={key}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3 last:border-0"
              >
                <div>
                  <strong className="text-sm">{name}</strong>
                </div>
                <Pill>{status?.kind === "ok" ? status.data[key] : "Status unavailable"}</Pill>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
