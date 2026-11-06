import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clipboard,
  Loader2,
  Play,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { atlasClient } from "@/api/atlasClient";

const REF = "ac56bcf0360fe3d011060a8011b2ea1e3d71b7408c354075e05fa69f487ae386";
const SHA = "0x67ec935b13fac924b07c7e98013c88f62ad7118f77361e6b93cb6cdeded949e4";
const GRANTED = "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3";
const DENIED = "0xAd797f58aFD3265C00504382171eC0818262D3ca";
type ProofKey = "arkiv" | "swarm" | "granted" | "denied";
type ProofState = {
  status: "idle" | "running" | "verified" | "failed";
  message: string;
  data?: unknown;
};
const ITEMS: {
  key: ProofKey;
  number: string;
  sponsor: string;
  title: string;
  explanation: string;
  url: string;
}[] = [
  {
    key: "arkiv",
    number: "01",
    sponsor: "ARKIV Â· RABDI",
    title: "Resolve a selector",
    explanation: "Read a canonical function signature, source and Arkiv entity.",
    url: "/v1/functions/0x9010d07c",
  },
  {
    key: "swarm",
    number: "02",
    sponsor: "SWARM Â· DATA INTEGRITY",
    title: "Verify the stored root",
    explanation: "Read the archived signature manifest and compare its SHA-256.",
    url: "/v1/artifacts/" + REF,
  },
  {
    key: "granted",
    number: "03",
    sponsor: "ENSV2 Â· SEPOLIA",
    title: "Check granted permission",
    explanation: "Live EAC r¶»§q«^