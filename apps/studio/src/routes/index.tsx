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
import { anonymousBlockNumber, type AnonymousBlockProof } from "@/lib/atlas/anon-rpc";
import { usePreferences, type ThemePref } from "@/lib/atlas/preferences";
import "./landing.css";

const CLI_COMMAND = "npx -y @omghotekar/atlas-cli lookup 0x9010d07c";
const API_LOOKUP = "/v1/functions/0x9010d07c";
const SWARM_ROOT = "ac56bcf0360fe3d011060a8011b2ea1e3d71b7408c354075e05fa69f487ae386";
const SWARM_SHA = "0x67ec935b13fac924b07c7e98013c88f62ad7118f77361e6b93cb6cdeded949e4";
const ENS_ALLOW = "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3";
const ENS_DENY = "0xAd797f58aFD3265C00504382171eC0818262D3ca";
const LIVE_DEMO_CALLDATA = "0x9010d07c" + "0".repeat(128);
const EF_PUBLIC_RPC = "https://ethereum-rpc.publicnode.com";
type ZeroGShowcase = {
  mode: "illustrative" | "live";
  signature: string;
  summary: string;
  model?: string;
  requestId?: string | null;
  arguments: readonly string[];
};
type LiveProof = { status: "ready" | "verified" | "failed"; detail: string };

const interfaces = [
  {
    number: "01",
    label: "STUDIO",
    headline: "Explore visually.",
    copy: "Search selectors, decode calldata, investigate transactions, and inspect source prov¶»§q«^