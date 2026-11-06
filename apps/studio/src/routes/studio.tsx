import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Braces, CircleSlash, Search } from "lucide-react";
import { getApiBaseUrl } from "@/api/atlasClient";
import { NAV } from "@/lib/atlas/nav";
import { Panel, Pill, SampleSwitch } from "@/components/atlas/primitives";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Workspace â€” ATLAS Studio" },
      {
        name: "description",
        content:
          "Launchpad for searching function signatures and decoding EVM calldata with ATLAS.",
      },
      { property: "og:title", content: "ATLAS Studio â€” Workspace" },
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
        <Pill tone="accent">Arkiv Rabdi Â· live registry</Pill>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl">
          Understand every
          <br />
          contract interaction.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          <span className="text-foreground">Search. Decode. Investigate. Integrate.</span> ATLAS
          resolves 4-byte selectors, decodes calldata, and records provenance for every match¶»§q«^