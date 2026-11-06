import { Activity, BookOpen, Braces, LayoutGrid, Radio, Search, Workflow } from "lucide-react";

export const NAV = [
  { to: "/", label: "Workspace", icon: LayoutGrid, hint: "Launchpad & health" },
  { to: "/explorer", label: "Explorer", icon: Search, hint: "Look up selectors & signatures" },
  { to: "/decode", label: "Decoder", icon: Braces, hint: "Decode raw calldata" },
  { to: "/events", label: "Events", icon: Radio, hint: "Inspect event logs" },
  { to: "/transactions", label: "Transactions", icon: Workflow, hint: "Trace transactions" },
  { to: "/docs", label: "Docs", icon: BookOpen, hint: "API, SDK & CLI" },
  { to: "/status", label: "Status", icon: Activity, hint: "Service diagnostics" },
] as const;

export type NavPath = (typeof NAV)[number]["to"];
