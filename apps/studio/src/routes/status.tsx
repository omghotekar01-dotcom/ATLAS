import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle, Loader2, RefreshCw } from "lucide-react";
import { atlasClient, getApiBaseUrl } from "@/api/atlasClient";
import type { ApiResult, HealthResponse } from "@/api/types";
import { Mono, PageHeader, Panel, Pill } from "@/components/atlas/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Service Status — ATLAS" },
      {
        name: "description",
        content: "Live diagnostics for the ATLAS API connection and integration checklist.",
      },
      { property: "og:title", content: "Service Status — ATLAS" },
      {
        property: "og:description",
        content: "Honest diagnostics for the ATLAS API, Arkiv and RPC integrations.",
      },
    ],
  }),
  component: Status,
});

function Status() {
  const base = getApiBaseUrl();
  const [res, setRes] = useState<ApiResult<HealthResponse> | null>(null);
  const [checking, setChecking] = useState(false);
  const [at, setAt] = useState<Date | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setRes(await atlasClient.health());
    setAt(new Date());
    setChecking(false);
  }, []);
  useEffect(() => {
    void check();
  }, [check]);

  const api = !res ? (
    <Pill>Checking…</Pill>
  ) : res.kind === "unconfigured" ? (
    <Pill>Not configured</Pill>
  ) : res.kind === "ok" ? (
    <Pill tone={res.data.status === "ok" ? "success" : "warning"} dot>
      {res.data.status === "ok" ? "Online" : "Degraded"}
    </Pill>
  ) : (
    <Pill tone="error" dot>
      Offline
    </Pill>
  );

  const arkiv =
    res?.kind === "ok" && res.data.arkiv ? (
      res.data.arkiv.connected ? (
        <Pill tone="success" dot>
          Connected
        </Pill>
      ) : (
        <Pill tone="error" dot>
          Disconnected
        </Pill>
      )
    ) : (
      <Pill>Unknown</Pill>
    );

  const checklist: [string, boolean][] = [
    ["Set VITE_ATLAS_API_URL", !!base],
    ["GET /health responds", res?.kind === "ok"],
    ["Arkiv upstream connected", res?.kind === "ok" && !!res.data.arkiv?.connected],
    ["Function lookup and search routes implemented", true],
    ["Calldata and event-log decoding routes implemented", true],
    ["Transaction analysis route implemented", true],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Status"
        title="Service Status"
        description="Live connectivity checks are separate from implementation status. A degraded health response means Arkiv is unavailable or not configured."
      >
        <Button variant="outline" onClick={check} disabled={checking}>
          {checking ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}{" "}
          Re-check
        </Button>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <p className="text-xs text-subtle">ATLAS API</p>
          <div className="mt-3">{api}</div>
          <p className="mt-3 text-xs text-muted-foreground">
            {res && res.kind !== "ok" && res.kind !== "unconfigured" && "message" in res
              ? res.message
              : res?.kind === "ok"
                ? `v${res.data.version}`
                : "—"}
          </p>
        </Panel>
        <Panel>
          <p className="text-xs text-subtle">Arkiv</p>
          <div className="mt-3">{arkiv}</div>
          <p className="mt-3 text-xs text-muted-foreground">Reported by /health</p>
        </Panel>
        <Panel>
          <p className="text-xs text-subtle">RPC tracing</p>
          <div className="mt-3">
            <Pill>Not integrated</Pill>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Planned</p>
        </Panel>
      </div>
      <Panel className="mt-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-subtle">VITE_ATLAS_API_URL</dt>
            <dd className="mt-1">
              {base ? <Mono>{base}</Mono> : <span className="text-muted-foreground">Not set</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Last checked</dt>
            <dd className="mt-1 text-muted-foreground">{at ? at.toLocaleTimeString() : "—"}</dd>
          </div>
        </dl>
      </Panel>
      <Panel className="mt-4">
        <h2 className="text-sm font-semibold">Integration checklist</h2>
        <ul className="mt-4 space-y-2.5">
          {checklist.map(([t, ok]) => (
            <li key={t} className="flex items-center gap-3 text-sm">
              {ok ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <Circle className="size-4 text-subtle" />
              )}
              <span className={ok ? "" : "text-muted-foreground"}>{t}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
