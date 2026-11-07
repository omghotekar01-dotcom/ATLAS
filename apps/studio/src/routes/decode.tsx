import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import { atlasClient } from "@/api/atlasClient";
import type { ApiResult, DecodeCalldataResponse } from "@/api/types";
import { analyzeCalldata } from "@/lib/atlas/hex";
import { sampleDecode } from "@/lib/atlas/fixtures";
import { useSampleMode } from "@/lib/atlas/sample-mode";
import {
  Banner,
  CopyButton,
  Mono,
  PageHeader,
  Panel,
  Pill,
  ResultState,
  SampleBadge,
  SampleSwitch,
} from "@/components/atlas/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/decode")({
  head: () => ({
    meta: [
      { title: "Calldata Decoder — ATLAS" },
      {
        name: "description",
        content: "Decode raw EVM calldata into selectors and structured parameters.",
      },
      { property: "og:title", content: "Calldata Decoder — ATLAS" },
      {
        property: "og:description",
        content: "Paste calldata, extract the selector and inspect typed parameters.",
      },
    ],
  }),
  component: Decoder,
});

const EXAMPLE =
  "0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000000000000000000000000000000de0b6b3a7640000";

const ARKIV_EXAMPLE = "0x9010d07c" + "0".repeat(128);

type Explanation = Awaited<ReturnType<typeof atlasClient.explainCalldata>>;

function Decoder() {
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult<DecodeCalldataResponse> | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [illustration, setIllustration] = useState(false);
  const { sample, setSample } = useSampleMode();
  const a = analyzeCalldata(raw);

  useEffect(() => {
    setResult(null);
    setExplanation(null);
    setIllustration(false);
  }, [sample]);

  async function explain() {
    if (
      !a.ok ||
      sample ||
      result?.kind !== "ok" ||
      result.data.decoded.every((attempt) => attempt.decodeStatus !== "success")
    )
      return;
    setExplainLoading(true);
    setExplanation(null);
    setIllustration(false);
    try {
      setExplanation(await atlasClient.explainCalldata(a.normalized));
    } finally {
      setExplainLoading(false);
    }
  }

  async function run() {
    if (!a.ok) return;
    setExplanation(null);
    setIllustration(false);
    if (sample) {
      const d = sampleDecode(a.selector, a.words);
      setResult(d.decoded.length ? { kind: "ok", data: d, sample: true } : { kind: "empty" });
      return;
    }
    setLoading(true);
    try {
      setResult(await atlasClient.decodeCalldata(a.normalized));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Decode"
        title="Calldata Decoder"
        description="Paste transaction input data. Structure is analysed locally; decoding against known signatures uses the ATLAS API."
      >
        <SampleSwitch />
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="cd" className="text-sm font-medium">
              Calldata
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setRaw(ARKIV_EXAMPLE);
                  setSample(false);
                  setResult(null);
                  setExplanation(null);
                  setIllustration(false);
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Load live Arkiv example
              </button>
              <button
                type="button"
                onClick={() => {
                  setRaw(EXAMPLE);
                  setResult(null);
                  setExplanation(null);
                  setIllustration(false);
                }}
                className="text-xs text-subtle hover:text-primary"
              >
                ERC20 example (not imported)
              </button>
            </div>
          </div>
          <textarea
            id="cd"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setResult(null);
              setExplanation(null);
              setIllustration(false);
            }}
            rows={8}
            spellCheck={false}
            placeholder="0x…"
            aria-invalid={!a.ok && !("empty" in a && a.empty)}
            className="w-full resize-y break-all rounded-xl border border-input bg-background p-3 font-mono text-[13px] leading-relaxed outline-none placeholder:text-subtle focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {a.ok ? (
              <Pill tone="success" dot>
                Valid hex · {a.byteLength} bytes
              </Pill>
            ) : (
              <Pill tone={"empty" in a && a.empty ? "neutral" : "warning"} dot>
                {a.reason}
              </Pill>
            )}
            <Button onClick={run} disabled={!a.ok || loading} className="rounded-xl">
              {loading && <Loader2 className="size-4 animate-spin" />} Decode
            </Button>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <h2 className="text-sm font-semibold">Local structure</h2>
          <p className="text-xs text-subtle">Computed in your browser — no network.</p>
          {a.ok ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Selector</dt>
                <dd className="flex items-center gap-2">
                  <Mono className="text-primary">{a.selector}</Mono>
                  <CopyButton value={a.selector} label="" />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total bytes</dt>
                <dd className="font-mono">{a.byteLength}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">32-byte words</dt>
                <dd className="font-mono">{a.words.length}</dd>
              </div>
              {a.trailing && (
                <div className="text-xs text-warning">
                  {a.trailing.length / 2} trailing bytes not aligned to 32-byte words
                </div>
              )}
              <div className="max-h-64 space-y-1 overflow-auto pt-2">
                {a.words.map((w, i) => (
                  <div key={i} className="flex gap-2 text-[11px]">
                    <span className="w-6 shrink-0 font-mono text-subtle">{i}</span>
                    <Mono className="text-[11px] text-muted-foreground">{w}</Mono>
                  </div>
                ))}
              </div>
            </dl>
          ) : (
            <p className="mt-6 text-sm text-subtle">Waiting for valid calldata.</p>
          )}
        </Panel>
      </div>

      <Panel className="mt-5 border-primary/20">
        <h2 className="text-base font-semibold">0G Private Computer · Evidence explainer</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Start with the live Arkiv example above and press Decode. Compare a local illustrative
          explanation with a real private 0G model request. Real inference requires the server-side
          0G key, supported model, credits and a provider request ID.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setRaw(ARKIV_EXAMPLE);
              setSample(false);
              setResult(null);
              setExplanation(null);
              setIllustration(false);
            }}
          >
            1. Load live Arkiv example
          </Button>
          <Button
            variant="outline"
            type="button"
            disabled={
              sample ||
              result?.kind !== "ok" ||
              !result.data.decoded.some((item) => item.decodeStatus === "success")
            }
            onClick={() => {
              setIllustration(true);
              setExplanation(null);
            }}
          >
            2. Preview local illustration
          </Button>
          <Button
            type="button"
            disabled={
              sample ||
              result?.kind !== "ok" ||
              !result.data.decoded.some((item) => item.decodeStatus === "success") ||
              explainLoading
            }
            onClick={() => void explain()}
          >
            {explainLoading ? "Calling 0G…" : "3. Request REAL 0G inference"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-warning">
          Local illustration never calls 0G and never produces a provider request ID. It is a
          product demonstration, not sponsor qualification evidence.
        </p>
      </Panel>

      <div className="mt-6 space-y-4" aria-live="polite">
        {illustration && result?.kind === "ok" && (
          <Panel className="border-warning/30">
            <Pill tone="warning">LOCAL ILLUSTRATION · NOT 0G INFERENCE</Pill>
            <h2 className="mt-3 font-semibold">Evidence-grounded explanation preview</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The canonical ABI signature{" "}
              {result.data.decoded.find((item) => item.decodeStatus === "success")?.signature ??
                "unknown"}
              describes the function input fields. This deterministic decode cannot establish the
              return value, transaction success, authorization or contract safety. The signature's
              source provenance belongs to the Arkiv record; checking its source is separate from
              predicting behavior.
            </p>
            <p className="mt-2 text-xs text-warning">
              Provider: none · Request ID: none · AI requests sent: 0
            </p>
          </Panel>
        )}
        {explanation && explanation.kind !== "ok" && <ResultState result={explanation} />}
        {explanation?.kind === "ok" && (
          <Panel>
            <h2 className="font-semibold">0G AI interpretation — not verified evidence</h2>
            <p className="mt-2 break-words text-sm text-foreground">
              {explanation.data.explanation}
            </p>
            <p className="mt-3 break-all text-xs text-muted-foreground">
              Model: {explanation.data.model} · Provider ID:{" "}
              {explanation.data.requestId ?? "not supplied"}
            </p>
            <p className="mt-2 text-xs text-warning">
              Only the canonical decode above is deterministic. AI is not contract identity or
              safety proof.
            </p>
          </Panel>
        )}
        {result && result.kind !== "ok" && <ResultState result={result} />}
        {result?.kind === "ok" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">
                  {result.data.decoded.length} decode outcome
                  {result.data.decoded.length === 1 ? "" : "s"}
                </h2>
                {result.sample && <SampleBadge />}
              </div>
              <div className="flex items-center gap-2">
                {!sample &&
                  result.data.decoded.some((attempt) => attempt.decodeStatus === "success") && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={explain}
                      disabled={explainLoading}
                    >
                      {explainLoading ? "Requesting 0G…" : "Explain with 0G (opt-in)"}
                    </Button>
                  )}
                <CopyButton value={JSON.stringify(result.data, null, 2)} label="Copy JSON" />
              </div>
            </div>
            {result.data.ambiguous && (
              <Banner
                tone="warning"
                icon={<AlertTriangle className="size-4" />}
                title="Multiple candidate selectors"
              >
                This calldata matches more than one known signature. Each interpretation is shown
                below.
              </Banner>
            )}
            {result.data.warnings.map((warning) => (
              <Banner key={warning} tone="warning" title="Decoder warning">
                {warning}
              </Banner>
            ))}
            {result.data.decoded.map((attempt, i) => {
              const text =
                attempt.decodeStatus === "success"
                  ? `${attempt.signature}\n` +
                    attempt.arguments
                      .map(
                        (argument) =>
                          `${argument.name} (${argument.type}): ${String(argument.value)}`,
                      )
                      .join("\n")
                  : `${attempt.signature}\nDecode failed: ${attempt.error}`;
              return (
                <Panel key={`${attempt.provenance.recordHash}-${i}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Pill>#{i + 1}</Pill>
                      <Mono className="ml-2 text-[15px]">{attempt.signature}</Mono>
                    </div>
                    <CopyButton value={text} label="Copy decoded" />
                  </div>
                  {attempt.decodeStatus === "failed" ? (
                    <p className="mt-4 text-sm text-warning">{attempt.error}</p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-subtle">
                            <th className="pb-2 pr-4 font-normal">Name</th>
                            <th className="pb-2 pr-4 font-normal">Type</th>
                            <th className="pb-2 font-normal">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attempt.arguments.map((argument, index) => (
                            <tr
                              key={`${argument.name}-${index}`}
                              className="border-t border-border align-top"
                            >
                              <td className="py-2 pr-4 font-mono text-[13px]">{argument.name}</td>
                              <td className="py-2 pr-4 font-mono text-[13px] text-primary">
                                {argument.type}
                              </td>
                              <td className="py-2">
                                <Mono className="text-muted-foreground">
                                  {String(argument.value)}
                                </Mono>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
