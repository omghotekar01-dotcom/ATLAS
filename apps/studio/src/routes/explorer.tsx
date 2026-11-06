import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { atlasClient } from "@/api/atlasClient";
import type { ApiResult, ExplorerResponse } from "@/api/types";
import { classifyQuery } from "@/lib/atlas/hex";
import { sampleLookup } from "@/lib/atlas/fixtures";
import { useSampleMode } from "@/lib/atlas/sample-mode";
import {
  Banner,
  PageHeader,
  Panel,
  Pill,
  ResultState,
  SampleBadge,
  SampleSwitch,
} from "@/components/atlas/primitives";
import { CandidateCard } from "@/components/atlas/CandidateCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/explorer")({
  head: () => ({
    meta: [
      { title: "Signature Explorer — ATLAS" },
      {
        name: "description",
        content: "Look up 4-byte function selectors and signatures with full provenance.",
      },
      { property: "og:title", content: "Signature Explorer — ATLAS" },
      {
        property: "og:description",
        content: "Resolve 4-byte selectors to candidate function signatures with provenance.",
      },
    ],
  }),
  component: Explorer,
});

function Explorer() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult<ExplorerResponse> | null>(null);
  const { sample } = useSampleMode();
  const cls = classifyQuery(q);
  const canSubmit = cls.kind === "selector" || cls.kind === "signature" || cls.kind === "text";

  useEffect(() => {
    setResult(null);
  }, [sample]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (sample) {
      const d = sampleLookup(cls.value);
      const hasCandidates = "candidates" in d ? d.candidates.length > 0 : d.items.length > 0;
      setResult(hasCandidates ? { kind: "ok", data: d, sample: true } : { kind: "empty" });
      return;
    }
    setLoading(true);
    try {
      setResult(
        cls.kind === "selector"
          ? await atlasClient.getFunctionBySelector(cls.value)
          : await atlasClient.searchFunctions(cls.value),
      );
    } finally {
      setLoading(false);
    }
  }

  const hint =
    cls.kind === "selector" ? (
      <Pill tone="success" dot>
        Valid 4-byte selector
      </Pill>
    ) : cls.kind === "signature" ? (
      <Pill tone="success" dot>
        Function signature
      </Pill>
    ) : cls.kind === "partial-hex" ? (
      <Pill tone="warning" dot>
        {cls.message}
      </Pill>
    ) : cls.kind === "text" ? (
      <Pill dot>Name search</Pill>
    ) : null;

  const candidates = (() => {
    if (result?.kind !== "ok") return [];
    const data = result.data;
    return "candidates" in data
      ? data.candidates.map((candidate) => ({ candidate, selector: data.identifier }))
      : data.items.map((candidate) => ({ candidate, selector: candidate.selector }));
  })();
  const ambiguous =
    result?.kind === "ok" && "ambiguous" in result.data ? result.data.ambiguous : false;

  return (
    <>
      <PageHeader
        eyebrow="Search"
        title="Signature Explorer"
        description="Resolve a 4-byte selector to candidate signatures, or find the selector for a known signature."
      >
        <SampleSwitch />
      </PageHeader>
      <Panel>
        <form onSubmit={run} className="space-y-3">
          <label htmlFor="q" className="text-sm font-medium">
            Selector or signature
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <input
                id="q"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setResult(null);
                }}
                placeholder="0xa9059cbb  or  transfer(address,uint256)"
                spellCheck={false}
                autoComplete="off"
                aria-invalid={cls.kind === "partial-hex"}
                className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 font-mono text-sm outline-none placeholder:text-subtle focus:border-primary"
              />
            </div>
            <Button type="submit" disabled={!canSubmit || loading} className="h-11 rounded-xl px-5">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Search
            </Button>
          </div>
          <div className="flex min-h-6 flex-wrap gap-2">
            {hint}
            {(["0xa9059cbb", "transfer(address,uint256)", "0x095ea7b3"] as const).map((ex) => (
              <button
                type="button"
                key={ex}
                onClick={() => setQ(ex)}
                className="font-mono text-xs text-subtle hover:text-primary"
              >
                {ex}
              </button>
            ))}
          </div>
        </form>
      </Panel>

      <div className="mt-6 space-y-4" aria-live="polite">
        {result && result.kind !== "ok" && <ResultState result={result} />}
        {result?.kind === "ok" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">
                {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
              </h2>
              {result.sample && <SampleBadge />}
            </div>
            {ambiguous && (
              <Banner
                tone="warning"
                icon={<AlertTriangle className="size-4" />}
                title="Ambiguous selector"
              >
                Multiple signatures share this 4-byte selector. Verify against the contract's ABI or
                source before relying on a match.
              </Banner>
            )}
            {candidates.map(({ candidate, selector }, index) => (
              <CandidateCard
                key={`${candidate.provenance.recordHash}-${index}`}
                c={candidate}
                selector={selector}
                index={index}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}
