import {
  Activity,
  ArrowLeftRight,
  Binary,
  BookOpen,
  LayoutGrid,
  Plug,
  Radio,
  Search,
  Settings,
  TerminalSquare,
  type LucideIcon,
} from "lucide-react";

export type NavPath =
  | "/"
  | "/explorer"
  | "/decode"
  | "/events"
  | "/transactions"
  | "/developers"
  | "/docs"
  | "/integrations"
  | "/status"
  | "/settings";
export interface NavItem {
  to: NavPath;
  label: string;
  icon: LucideIcon;
  hint: string;
}
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { to: "/", label: "Overview", icon: LayoutGrid, hint: "Workspace and shortcuts" },
      {
        to: "/explorer",
        label: "Signature Explorer",
        icon: Search,
        hint: "Resolve signatures and compare 4byte",
      },
      { to: "/decode", label: "Calldata Decoder", icon: Binary, hint: "Decode EVM calldata" },
      { to: "/events", label: "Event Inspector", icon: Radio, hint: "Inspect on-chain event logs" },
      {
        to: "/transactions",
        label: "Transaction Lab",
        icon: ArrowLeftRight,
        hint: "Investigate transactions with RPC",
      },
    ],
  },
  {
    label: "Developer",
    items: [
      {
        to: "/developers",
        label: "CLI & SDK",
        icon: TerminalSquare,
        hint: "Commands and code examples",
      },
      { to: "/docs", label: "Documentation", icon: BookOpen, hint: "Endpoints and trust model" },
    ],
  },
  {
    label: "System",
    items: [
      {
        to: "/integrations",
        label: "Integrations",
        icon: Plug,
        hint: "Verified versus planned connections",
      },
      { to: "/status", label: "Service Status", icon: Activity, hint: "Live health checks" },
      { to: "/settings", label: "Settings", icon: Settings, hint: "Theme and preferences" },
    ],
  },
];
export const NAV = NAV_GROUPS.flatMap((group) => group.items);
