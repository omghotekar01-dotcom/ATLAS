import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Database, RadioTower, ShieldAlert, RefreshCw } from "lucide-react";
import { PageHeader, Panel, Pill } from "@/components/atlas/primitives";
import { atlasClient, getApiBaseUrl } from "@/api/atlasClient";

type Health = Awaited<ReturnType<typeof atlasClient.health>>;
export const Route = createFileRoute("/integrations")({ component: Integrations });
const planned = [
  { name: "Swarm", detail: "Sponsor integration: not verified in the ATLAS backend." },
  { name: "0x", detail: "Aggregation integration: not verified in the ATLAS backend." },
  { name: "0G", detail: "Storage and compute integration: not verified in the ATLAS backend." },
];
function Integrations() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  function refresh() {
    setLoading(true);
    void atlasClient
      .health()
      .then((value) => setHealth(value))
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
            <h2 className="text-base font-semibold">Proposed sponsor connections</h2>
          </div>
          <ul className="mt-3 space-y-3">
            {planned.map((item) => (
              <li
                key={item.name}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3 last:border-0"
              >
                <div>
                  <strong className="text-sm">{item.name}</strong>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <Pill>Not verified</Pill>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
