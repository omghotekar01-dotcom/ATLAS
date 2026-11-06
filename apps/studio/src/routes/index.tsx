import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clipboard,
  Code2,
  ExternalLink,
  GitBranch,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { atlasClient } from "@/api/atlasClient";
import { usePreferences, type ThemePref } from "@/lib/atlas/preferences";
import "./landing.css";

const CLI_COMMAND =
  "npx --yes --package=@omghotekar/atlas-cli@0.1.0 atlas --timeout 45000 lookup 0x9010d07c --json";
const API_LOOKUP = "/v1/functions/0x9010d07c";

const interfaces = [
  {
    number: "01",
    label: "STUDIO",
    headline: "Explore visually.",
    copy: "Search selectors, decode calldata, investigate transactions, and inspect source provenance in one workspace.",
    action: "Launch Studio",
    to: "/studio" as const,
  },
  {
    number: "02",
    label: "CLI",
    headline: "Stay in your terminal.",
    copy: "Run signature lookups and developer diagnostics directly from your command line.",
    action: "Try the CLI",
    to: "/developers" as const,
  },
  {
    number: "03",
    label: "REST API",
    headline: "Build on the API.",
    copy: "Query Ethereum contract intelligence through typed, validated REST endpoints.",
    action: "View API documentation",
    to: "/docs" as const,
  },
  {
    number: "04",
    label: "TYPESCRIPT SDK",
    headline: "Integrate in code.",
    copy: "Use a typed TypeScript client with validated resul¶»§q«^