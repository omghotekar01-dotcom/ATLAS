import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { CopyButton, PageHeader } from "@/components/atlas/primitives";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Developer Hub — ATLAS" },
      {
        name: "description",
        content:
          "ATLAS documentation: selectors, REST API contracts, Studio API client, CLI and Arkiv provenance.",
      },
      { property: "og:title", content: "Developer Hub — ATLAS" },
      {
        property: "og:description",
        content: "REST API, SDK, CLI and provenance architecture for ATLAS.",
      },
    ],
  }),
  component: Docs,
});

function Code({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="font-mono text-[11px] text-subtle">{lang}</span>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-muted-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const SECTIONS = [
  {
    id: "overview",
    title: "Overview",
    body: (
      <>
        <p>
          ATLAS resolves EVM function selectors to human-readable signatures, decodes calldata, and
          attaches provenance to every record so you know where a match came from.
        </p>
        <p className="mt-3">
          One OpenZeppelin function record is currently verified on Arkiv Rabdi. Empty search
          results are real empty results; an unavailable upstream is reported separately. Optional
          sample preview data is never presented as live registry data.
        </p>
      </>
    ),
  },
  {
    id: "selectors",
    title: "Selectors vs Signatures",
    body: (
      <>
        <p>
          A <strong>signature</strong> is the canonical function prototype, e.g.{" "}
          <code className="font-mono text-primary">transfer(address,uint256)</code>. Its{" "}
          <strong>selector</strong> is the first 4 bytes of the keccak-256 hash:{" "}
          <code className="font-mono text-primary">0xa9059cbb</code>.
        </p>
        <p className="mt-3">
          Because only 4 bytes are kept, distinct signatures can collide. ATLAS returns every
          candidate and flags ambiguity rather than guessing.
        </p>
      </>
    ),
  },
  {
    id: "rest",
    title: "REST API",
    body: (
      <>
        <p>
          Base URL is configured via <code className="font-mono">VITE_ATLAS_API_URL</code>.
        </p>
        <Code
          lang="http"
          code={`GET  /health
GET  /v1/functions/:selector
GET  /v1/functions/search?q=&limit=&cursor=
GET  /v1/events/:topic0
POST /v1/decode/calldata
POST /v1/decode/logs
POST /v1/transactions/analyze`}
        />
        <Code
          lang="json"
          code={`{
  "identifier": "0x9010d07c",
  "kind": "function",
  "ambiguous": false,
  "candidates": [{
    "signature": "getRoleMember(bytes32,uint256)",
    "source": "OpenZeppelin/openzeppelin-contracts",
    "sourceId": "…",
    "entityKey": "…",
    "provenance": {
      "datasetVersion": "openzeppelin-contracts@efaa6f78ab1d-2026-11-06",
      "importedAt": "2026-11-06T08:26:36.469Z",
      "recordHash": "0x006ec394910203bf6b314b2ac4a0135526ec97c300425ee49b50847603c96689"
    }
  }],
  "registry": "arkiv-rabdi",
  "warnings": []
}`}
        />
      </>
    ),
  },
  {
    id: "sdk",
    title: "Studio API client",
    body: (
      <Code
        lang="ts"
        code={`// This is an internal Studio client, not the public @atlas/sdk package.
import { atlasClient } from "./api/atlasClient";

const res = await atlasClient.getFunctionBySelector("0xa9059cbb");
switch (res.kind) {
  case "ok":           console.log(res.data.candidates); break;
  case "empty":        console.log("no match"); break;
  case "unconfigured": console.log("set VITE_ATLAS_API_URL"); break;
  default:             console.error(res);
}`}
      />
    ),
  },
  {
    id: "cli",
    title: "CLI guide",
    body: (
      <>
        <p>The local CLI supports lookup, search, decode, event, logs, tx and health commands.</p>
        <Code
          lang="bash"
          code={`atlas lookup 0xa9059cbb
atlas search "transfer(address,uint256)"
atlas decode 0xa9059cbb000000…`}
        />
      </>
    ),
  },
  {
    id: "provenance",
    title: "Provenance & Arkiv",
    body: (
      <>
        <p>
          Every candidate carries a provenance record: the upstream <em>source</em> and its{" "}
          <em>source ID</em>, the <em>dataset version</em> it was imported in, an{" "}
          <em>import timestamp</em>, a <em>record hash</em> of the normalized entry, and the Arkiv{" "}
          <em>entity key</em> under which it is stored.
        </p>
        <Code
          lang="text"
          code={`upstream source ─▶ importer ─▶ normalize + hash ─▶ Arkiv entity
                                               │
                                     ATLAS API ◀┘ ─▶ Studio / SDK / CLI`}
        />
      </>
    ),
  },
];

function Docs() {
  const [active, setActive] = useState<string>("overview");
  return (
    <>
      <PageHeader
        eyebrow="Integrate"
        title="Developer Hub"
        description="Concepts, contracts and tooling for building on ATLAS."
      />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Docs" className="min-w-0 md:sticky md:top-24 md:self-start">
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={() => setActive(s.id)}
                  className={cn(
                    "block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground",
                    active === s.id && "bg-elevated text-foreground",
                  )}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <article className="min-w-0 space-y-12 text-[15px] leading-relaxed text-muted-foreground">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="mb-3 text-xl font-semibold text-foreground">{s.title}</h2>
              {s.body}
            </section>
          ))}
        </article>
      </div>
    </>
  );
}
