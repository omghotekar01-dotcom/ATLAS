import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Braces, CircleSlash, Search } from "lucide-react";
import { getApiBaseUrl } from "@/api/atlasClient";
import { NAV } from "@/lib/atlas/nav";
import { Panel, Pill, SampleSwitch } from "@/components/atlas/primitives";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Workspace — ATLAS Studio" },
      {
        name: "description",
        content:
          "Launchpad for searching function signatures and decoding EVM calldata with ATLAS.",
      },
      { property: "og:title", content: "ATLAS Studio — Workspace" },
      {
        property: "og:description",
        content:
          "Search. Decode. Investigate. Integrate. A developer tool for EVM contract interactions.",
      },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const configured = !!getApiBaseUrl();
  return (
    <div className="space-y-10">
      <section className="max-w-3xl">
        <Pill tone="accent">Arkiv Rabdi · live registry</Pill>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl">
          Understand every
          <br />
          contract interaction.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          <span className="text-foreground">Search. Decode. Investigate. Integrate.</span> ATLAS
          resolves 4-byte selectors, decodes calldata, and records provenance for every match.
        </p>
      </section>

      <Panel className="border-primary/20">
        <h2 className="text-sm font-semibold">Live registry coverage</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          One OpenZeppelin function record has been verified on Arkiv Rabdi so far. Try{" "}
          <Link to="/explorer" className="font-mono text-primary hover:text-primary-hover">
            0x9010d07c
          </Link>{" "}
          for <code className="font-mono">getRoleMember(bytes32,uint256)</code>. Other queries may
          return no matches; sample preview is separate and opt-in.
        </p>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            to: "/explorer" as const,
            icon: Search,
            title: "Signature Explorer",
            body: "Look up a selector like 0xa9059cbb or a signature like transfer(address,uint256).",
            hint: "0xa9059cbb",
          },
          {
            to: "/decode" as const,
            icon: Braces,
            title: "Calldata Decoder",
            body: "Paste raw calldata to extract the selector, byte length and parameter words.",
            hint: "0xa9059cbb000…",
          },
        ].map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-elevated/50"
          >
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <c.icon className="size-5" />
              </span>
              <ArrowUpRight className="size-5 text-subtle transition-colors group-hover:text-primary" />
            </div>
            <h2 className="mt-5 text-xl font-semibold">{c.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            <p className="mt-4 font-mono text-xs text-subtle">{c.hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h2 className="text-sm font-semibold">Where ATLAS fits</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Search", "Resolve selectors to candidate signatures from multiple sources."],
              ["Decode", "Turn opaque calldata into named, typed parameters."],
              [
                "Investigate",
                "Inspect transaction facts and logs against configured RPC and registry sources.",
              ],
              [
                "Integrate",
                "Use the implemented REST API, TypeScript SDK or CLI in your own stack.",
              ],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-border bg-background/40 p-4">
                <span className="font-mono text-xs text-primary">0{i + 1}</span>
                <p className="mt-1 font-medium">{t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel>
          <h2 className="text-sm font-semibold">System health</h2>
          <div className="mt-4 flex items-center gap-3">
            <CircleSlash className="size-5 text-subtle" />
            <div>
              <p className="font-medium">
                {configured ? "API URL configured" : "Backend unconfigured"}
              </p>
              <p className="text-xs text-muted-foreground">
                {configured
                  ? "Check Status to test connectivity."
                  : "VITE_ATLAS_API_URL is not set."}
              </p>
            </div>
          </div>
          <Link
            to="/status"
            className="mt-4 inline-block text-sm text-primary hover:text-primary-hover"
          >
            Open diagnostics →
          </Link>
          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-3 text-xs text-muted-foreground">
              Preview the UI with clearly-labeled fixtures. Off by default.
            </p>
            <SampleSwitch />
          </div>
        </Panel>
      </div>

      <div className="flex flex-wrap gap-2">
        {NAV.slice(3).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <n.icon className="size-3.5" /> {n.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
