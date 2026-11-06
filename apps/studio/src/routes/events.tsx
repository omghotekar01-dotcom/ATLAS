import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { atlasClient } from "@/api/atlasClient";
import type { ApiResult, LogDecodeResult } from "@/api/types";
import { isHex } from "@/lib/atlas/hex";
import { PageHeader, Panel, Pill } from "@/components/atlas/primitives";
import { NotAvailable } from "@/components/atlas/NotAvailable";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Event Inspector — ATLAS" },
      {
        name: "description",
        content: "Decode EVM event logs against canonical Arkiv event signatures.",
      },
      { property: "og:title", content: "Event Inspector — ATLAS" },
      {
        property: "og:description",
        content: "Decode event topics and data with ATLAS.",
      },
    ],
  }),
  component: Events,
});

const field =
  "h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-[13px] outline-none placeholder:text-subtle focus:border-primary";

function Validity({ v, bytes }: { v: string; bytes?: number }) {
  if (!v.trim()) return null;
  return isHex(v, bytes) ? (
    <Pill tone="success">valid</Pill>
  ) : (
    <Pill tone="warning">{bytes ? `expects ${bytes} bytes hex` : "invalid hex"}</Pill>
  );
}

function Result({ result }: { result: ApiResult<LogDecodeResult> | null }) {
  if (!result) return null;
  if (result.kind === "unconfigured") {
    return (
      <NotAvailable
        title="Event decoding"
        requirements={[
          "Set VITE_ATLAS_API_URL to the ATLAS API",
          "Configure ARKIV_ACCESS_KEY and ATLAS_ARKIV_CREATOR_ADDRESS on the API",
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
        <Pill tone="warning">No canonical event signature</Pill>
        <p className="mt-2 text-sm text-muted-foreground">
          No event signature is mirrored for this topic0. ATLAS does not guess.
        </p>
      </Panel>
    );
  }

  const decoded = result.data;
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Decoded event</h2>
        <Pill tone={decoded.ambiguous ? "warning" : "success"}>
          {decoded.ambiguous ? "ambiguous" : "match"}
        </Pill>
      </div>
      <div className="mt-3 space-y-3">
        {decoded.decoded.map((attempt) => (
          <div key={attempt.signature} className="rounded-xl border border-border/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-sm">{attempt.signature}</code>
              <Pill tone={attempt.decodeStatus === "success" ? "success" : "error"}>
                {attempt.decodeStatus}
              </Pill>
            </div>
            {attempt.decodeStatus === "success" ? (
              <ul className="mt-2 space-y-1 text-sm">
                {attempt.arguments.map((argument) => (
                  <li key={argument.name} className="flex flex-wrap gap-2">
                    <span className="text-muted-foreground">
                      {argument.name} ({argument.type})
                    </span>
                    <code className="break-all">{JSON.stringify(argument.value)}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{attempt.error}</p>
            )}
            <p className="mt-2 break-all text-xs text-subtle">
              {attempt.provenance.datasetVersion}
            </p>
          </div>
        ))}
      </div>
      {decoded.warnings.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
          {decoded.warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Events() {
  const [topic0, setTopic0] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [data, setData] = useState("");
  const [result, setResult] = useState<ApiResult<LogDecodeResult> | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const allTopics = [topic0, ...topics].filter((topic) => topic.trim().length > 0);
  const validTopics = allTopics.length > 0 && allTopics.every((topic) => isHex(topic, 32));
  const validData = data.trim().length === 0 || isHex(data);

  async function decode() {
    setLocalError(null);
    if (!validTopics) {
      setLocalError("Every topic must be 32 bytes of hex.");
      return;
    }
    if (!validData) {
      setLocalError("Data must be even-length hex.");
      return;
    }

    setBusy(true);
    const response = await atlasClient.decodeLogs([
      { topics: allTopics, data: data.trim() || "0x" },
    ]);
    if (response.kind === "ok") {
      const first = response.data.results[0];
      setResult(first ? { kind: "ok", data: first } : { kind: "empty" });
    } else {
      setResult(response);
    }
    setBusy(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="Investigate"
        title="Event Inspector"
        description="Compose a log's topics and data; ATLAS decodes it against canonical event signatures."
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="space-y-5 lg:col-span-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="t0" className="text-sm font-medium">
                Topic 0 <span className="text-subtle">(event signature hash)</span>
              </label>
              <Validity v={topic0} bytes={32} />
            </div>
            <input
              id="t0"
              className={field}
              value={topic0}
              onChange={(e) => setTopic0(e.target.value)}
              placeholder="0xddf252ad…"
              spellCheck={false}
            />
          </div>
          {topics.map((t, i) => (
            <div key={i}>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor={`t${i + 1}`} className="text-sm font-medium">
                  Topic {i + 1}
                </label>
                <Validity v={t} bytes={32} />
              </div>
              <div className="flex gap-2">
                <input
                  id={`t${i + 1}`}
                  className={field}
                  value={t}
                  spellCheck={false}
                  placeholder="0x…"
                  onChange={(e) => setTopics(topics.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Remove topic ${i + 1}`}
                  onClick={() => setTopics(topics.filter((_, j) => j !== i))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={topics.length >= 3}
            onClick={() => setTopics([...topics, ""])}
          >
            <Plus className="size-4" /> Add topic
          </Button>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="data" className="text-sm font-medium">
                Data
              </label>
              <Validity v={data} />
            </div>
            <textarea
              id="data"
              rows={5}
              value={data}
              onChange={(e) => setData(e.target.value)}
              spellCheck={false}
              placeholder="0x…"
              className="w-full break-all rounded-lg border border-input bg-background p-3 font-mono text-[13px] outline-none placeholder:text-subtle focus:border-primary"
            />
          </div>
          {localError && <p className="text-sm text-error">{localError}</p>}
          <Button disabled={busy} className="rounded-xl" onClick={decode}>
            {busy ? "Decoding…" : "Decode event"}
          </Button>
        </Panel>
        <div className="space-y-4 lg:col-span-2">
          <Result result={result} />
        </div>
      </div>
    </>
  );
}
