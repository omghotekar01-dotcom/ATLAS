import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Code2, Copy, Terminal, ShieldCheck } from "lucide-react";
import { PageHeader, Panel } from "@/components/atlas/primitives";
import { getApiBaseUrl } from "@/api/atlasClient";

export const Route = createFileRoute("/developers")({ component: Developers });
const examples = [
  { title: "Check API and Arkiv", command: "node packages/cli/dist/bin.js doctor" },
  {
    title: "Canonical Arkiv lookup",
    command: "node packages/cli/dist/bin.js lookup 0x9010d07c --json",
  },
  {
    title: "Unverified 4byte comparison",
    command: "node packages/cli/dist/bin.js 4byte 0xa9059cbb --json",
  },
  {
    title: "Decode a transaction",
    command: "node packages/cli/dist/bin.js tx <transaction-hash> --chain 1",
  },
];
function Developers() {
  const [copyMessage, setCopyMessage] = useState("");
  const api = getApiBaseUrl();
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage("Copied to clipboard");
    } catch {
      setCopyMessage("Clipboard permission denied; select and copy the command manually.");
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Developer tools"
        title="CLI & SDK"
        description="Use ATLAS from your terminal, application, or REST client. Every canonical claim is backed by the Arkiv mirror; optional community suggestions stay clearly unverified."
      />
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel>
          <div className="mb-4 flex items-center gap-2">
            <Terminal className="size-5 text-primary" />
            <h2 className="text-base font-semibold">CLI quickstart</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            From the monorepo root, build once and use the installed CLI. No wallet is required for
            read-only lookups.
          </p>
          <div className="space-y-3">
            {examples.map((item) => (
              <div key={item.title} className="rounded-lg border border-border bg-code p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">{item.title}</p>
                  <button
                    type="button"
                    aria-label={`Copy ${item.title}`}
                    onClick={() => {
                      void copy(item.command);
                    }}
                    className="rounded p-1.5 hover:bg-secondary"
                  >
                    <Copy className="size-4" />
                  </button>
                </div>
                <code className="block overflow-x-auto whitespace-nowrap font-mono text-xs text-code-foreground">
                  {item.command}
                </code>
              </div>
            ))}
          </div>
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            {copyMessage}
          </p>
        </Panel>
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-success" />
              <h2 className="text-base font-semibold">Trust boundaries</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The <strong>lookup</strong> command queries canonical source-provenanced records.{" "}
              <strong>4byte</strong> reads optional community guesses. Never treat a selector match
              as contract identity, a verified ABI, or a safety guarantee.
            </p>
            <Link
              to="/explorer"
              className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
            >
              Open Signature Explorer
            </Link>
          </Panel>
          <Panel>
            <h2 className="text-base font-semibold">API connection</h2>
            <p className="mt-2 text-sm text-muted-foreground">Configured base URL:</p>
            <code className="mt-2 block break-all rounded-md bg-code p-2 font-mono text-xs">
              {api ?? "Not configured — set VITE_ATLAS_API_URL"}
            </code>
            <Link to="/status" className="mt-3 inline-flex text-sm text-primary hover:underline">
              Verify service health
            </Link>
          </Panel>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center gap-2">
            <Code2 className="size-5 text-primary" />
            <h2 className="text-base font-semibold">TypeScript SDK</h2>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-border bg-code p-4 font-mono text-xs leading-6">{`import { AtlasClient } from "@atlas/sdk";\n\nconst client = new AtlasClient({\n  baseUrl: "${api ?? "http://127.0.0.1:3000"}",\n});\nconst result = await client.lookupFunction("0x9010d07c");`}</pre>
          <p className="mt-3 text-xs text-muted-foreground">
            The SDK contract and constructor options are documented in{" "}
            <code>packages/sdk/README.md</code>.
          </p>
        </Panel>
        <Panel>
          <h2 className="text-base font-semibold">REST routes</h2>
          <div className="mt-3 space-y-2 font-mono text-xs">
            <p className="rounded-md bg-code p-2">GET /health</p>
            <p className="rounded-md bg-code p-2">GET /v1/functions/:selector</p>
            <p className="rounded-md bg-code p-2">GET /v1/community/4byte/:selector</p>
            <p className="rounded-md bg-code p-2">POST /v1/decode/calldata</p>
            <p className="rounded-md bg-code p-2">POST /v1/transactions/analyze</p>
          </div>
          <Link to="/docs" className="mt-3 inline-flex text-sm text-primary hover:underline">
            View full documentation
          </Link>
        </Panel>
      </div>
    </>
  );
}
