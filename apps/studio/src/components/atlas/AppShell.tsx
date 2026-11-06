import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Menu,
  Moon,
  Sun,
  Monitor,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import { NAV, NAV_GROUPS, type NavItem } from "@/lib/atlas/nav";
import { useSampleMode } from "@/lib/atlas/sample-mode";
import { usePreferences, type ThemePref } from "@/lib/atlas/preferences";
import { getApiBaseUrl, atlasClient } from "@/api/atlasClient";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

const COLLAPSE_KEY = "atlas.sidebar.collapsed";
type BackendState = "unconfigured" | "checking" | "connected" | "degraded" | "unavailable";

function useBackendState(): BackendState {
  const [state, setState] = useState<BackendState>(getApiBaseUrl() ? "checking" : "unconfigured");
  useEffect(() => {
    if (!getApiBaseUrl()) return;
    let mounted = true;
    void atlasClient.health().then((result) => {
      if (!mounted) return;
      setState(
        result.kind === "ok"
          ? result.data.status === "ok"
            ? "connected"
            : "degraded"
          : "unavailable",
      );
    });
    return () => {
      mounted = false;
    };
  }, []);
  return state;
}

function AtlasMark¶»§q«^