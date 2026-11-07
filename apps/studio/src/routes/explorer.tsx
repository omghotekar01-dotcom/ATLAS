import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { atlasClient } from "@/api/atlasClient";
import type { ApiResult, CommunityLookupResult, ExplorerResponse } from "@/api/types";
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
  const [community, setCommunity] = useState<ApiResult<CommunityLookupResult> | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [automaticFallback, setAutomaticFallback] = useState(false);
  const { sample } = useSampleMode();
  const cls = classifyQuery(q);
  const canSubmit = cls.kind === "selector" || cls.kind === "signature" || cls.kind === "text";

  useEffect(() => {
    setResult(null);
    setCommunity(null);
    setAutomaticFallback(false);
  }, [sample]);

  async function executeLookup(input: string) {
    const lookup = classifyQuery(input);
    if (lookup.kind !== "selector" && lookup.kind !== "signature" && lookup.kind !== "text") return;
    setResult(null);
    setCommunity(null);
    setAutomaticFallback(false);
    if (sample) {
      const d = sampleLookup(lookup.value);
      const hasCandidates = "candidates" in d ? d.candidates.length > 0 : d.items.length > 0;
      setResult(hasCandidates ? { kind: "ok", data: d, sample: true } : { kind: "empty" });
      return;
    }
    setLoading(true);
    try {
      const canonical =
        lookup.kind === "selector"
          ? await atlasClient.getFunctionBySelector(lookup.value)
          : await atlasClient.searchFunctions(lookup.value);
      setResult(canonical);
      if (lookup.kind === "selector" && canonical.kind === "empty") {
        setAutomaticFallback(true);
        setCommunityLoading(true);
        try {
          setCommunity(await atlasClient.lookupCommunity(lookup.value));
        } finally {
          setCommunityLoading(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    await executeLookup(q);
  }

  async function compareCommunity() {
    if (sample || cls.kind !== "selector" || communityLoading) return;
    setCommunityLoading(true);
    setCommunity(null);
    setAutomaticFallback(false);
    try {
      setCommunity(await atlasClient.lookupCommunity(cls.value));
    } finally {
      setCommunityLoading(false);
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
        description="Search imported Arkiv records. Missing selectors automatically fetch separately labeled public community suggestions."
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
                  setCommunity(null);
                  setAutomaticFallback(false);
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
            {(["0x9010d07c", "0xa9059cbb", "transfer(address,uint256)"] as const).map((ex) => (
              <button
                type="button"
                key={ex}
                onClick={() => {
                  setQ(ex);
                  void executeLookup(ex);
                }}
                className="rounded-md border border-border px-2 py-1 font-mono text-xs text-subtle hover:text-primary"
              >
                {ex}
              </button>
            ))}
          </div>
        </form>
        <div className="mt-4 border-t border-border/70 pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={sample || cls.kind !== "selector" || communityLoading}
            onClick={compareCommunity}
          >
            {communityLoading && <Loader2 className="size-4 animate-spin" />}
            {communityLoading ? "Checking public directory…" : "Compare with 4byte.directory"}
          </Button>
          <p className="mt-2 text-xs text-subtle">
            Optional community suggestions only — never canonical Arkiv data, verified ABI or safety
            proof.
          </p>
        </div>
      </Panel>

      <div className="mt-6 space-y-4" aria-live="polite">
        {result?.kind === "empty" && !sample && automaticFallback ? (
          <Banner tone="neutral" title="Not yet imported into Arkiv">
            The canonical registry returned no entity for this selector.{" "}
            {communityLoading
              ? "Checking 4byte.directory suggestions…"
              : "Public community suggestions are shown separately when available."}
            Community records do not become canonical Arkiv records.
          </Banner>
        ) : (
          result && result.kind !== "ok" && <ResultState result={result} />
        )}
        {community && community.kind !== "ok" && <ResultState result={community} />}
        {community?.kind === "ok" && (
          <Panel>
            <h2 className="text-base font-semibold">4byte.directory · unverified candidates</h2>
            <p className="mt-1 text-sm text-subtle">
              {automaticFallback ? "Automatic fallback from a missing Arkiv record. " : ""}
              Community registry, not Arkiv canonical mirror. These candidates may collide and are
              not source verified.
              {community.data.truncated ? " Results may be incomplete." : ""}
            </p>
            <p className="mt-2 text-xs text-warning">
              {community.data.candidates.length} unverified community candidates, not Arkiv imports.
            </p>
            <ul className="mt-3 space-y-2">
              {community.data.candidates.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-border/70 p-3 font-mono text-sm break-all"
                >
                  {entry.signature}
                  <span className="ml-2 text-xs text-subtle">Community ID {entry.id}</span>
                </li>
              ))}
            </ul>
            {community.data.warnings.map((warning) => (
              <p key={warning} className="mt-2 text-xs text-subtle">
                {warning}
              </p>
            ))}
          </Panel>
        )}
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
                allowPublisherEvidence={!result.sample}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}
