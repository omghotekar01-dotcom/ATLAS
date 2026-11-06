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

function AtlasMark() {
  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-mono text-[13px] font-bold text-primary-foreground shadow-surface"
      aria-hidden="true"
    >
      A
    </span>
  );
}

function Navigation({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav aria-label="Primary" className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="mb-2 px-2.5 text-[11px] font-semibold tracking-wide text-subtle-foreground">
              {group.label}
            </p>
          )}
          {collapsed && <div className="mx-auto mb-2 h-px w-6 bg-border" />}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item: NavItem) => {
              const active =
                path === item.to || path.startsWith(item.to + "/");
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150",
                      active
                        ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-secondary hover:text-foreground",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <item.icon className="size-[17px] shrink-0" aria-hidden="true" />
                    {collapsed ? (
                      <span className="sr-only">{item.label}</span>
                    ) : (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ThemeControl() {
  const { prefs, setPref } = usePreferences();
  const Icon = prefs.theme === "dark" ? Moon : prefs.theme === "light" ? Sun : Monitor;
  return (
    <div className="flex items-center gap-1.5" title="Appearance">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <select
        aria-label="Theme preference"
        value={prefs.theme}
        onChange={(event) => setPref("theme", event.target.value as ThemePref)}
        className="h-9 max-w-[92px] rounded-lg border border-border bg-card px-1.5 text-xs text-foreground"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const backend = useBackendState();
  const { sample, setSample } = useSampleMode();
  const current = NAV.find((item) => item.to === path) ?? NAV[0];
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage optional */
    }
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  function toggleSidebar() {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        /* storage optional */
      }
      return !value;
    });
  }
  const backendText: Record<BackendState, string> = {
    unconfigured: "Backend not configured",
    checking: "Checking API…",
    connected: "API connected",
    degraded: "API degraded",
    unavailable: "API unavailable",
  };
  // Public landing uses a dedicated full-width layout.
  if (path === "/") return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
          collapsed ? "w-[68px]" : "w-[244px]",
        )}
        aria-label="Desktop navigation"
      >
        <div className={cn("flex h-14 items-center", collapsed ? "justify-center" : "px-4")}>
          <Link
            to="/studio"
            className="flex items-center gap-2.5"
            aria-label="ATLAS Developer Studio home"
          >
            <AtlasMark />
            {!collapsed && (
              <span className="leading-tight">
                <strong className="block text-[14px] tracking-wide">ATLAS</strong>
                <small className="block text-[11px] text-muted-foreground">Developer Studio</small>
              </span>
            )}
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <Navigation collapsed={collapsed} />
        </div>
        <div className="border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
            {!collapsed && "Collapse sidebar"}
          </button>
        </div>
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] overflow-y-auto bg-sidebar p-0">
          <SheetTitle className="sr-only">ATLAS Navigation</SheetTitle>
          <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
            <AtlasMark />
            <strong>ATLAS</strong>
          </div>
          <div className="px-3 py-4">
            <Navigation collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-nav sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-border px-3 sm:px-5">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <AtlasMark />
          </div>
          <nav
            aria-label="Breadcrumb"
            className="hidden min-w-0 items-center gap-1.5 text-[13px] sm:flex"
          >
            <span className="text-muted-foreground">ATLAS</span>
            <span className="text-subtle-foreground">/</span>
            <span className="truncate font-medium">{current?.label ?? "Studio"}</span>
          </nav>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
            className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] text-muted-foreground hover:border-border-strong hover:text-foreground sm:inline-flex sm:w-[220px]"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Search pages</span>
            <kbd className="rounded border border-border bg-secondary px-1 text-[11px]">Ctrl K</kbd>
          </button>
          <Link
            to="/status"
            title={backendText[backend]}
            className="hidden items-center gap-2 text-xs text-muted-foreground md:inline-flex"
          >
            <span
              className={cn(
                "size-2 rounded-full",
                backend === "connected"
                  ? "bg-success"
                  : backend === "degraded"
                    ? "bg-warning"
                    : backend === "unavailable"
                      ? "bg-destructive"
                      : "bg-muted-foreground",
              )}
            />
            <span>{backendText[backend]}</span>
          </Link>
          <ThemeControl />
          <Link
            to="/settings"
            className="hidden size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary sm:inline-flex"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </Link>
        </header>
        {sample && (
          <div className="border-b border-warning/30 bg-warning-soft px-3 py-2 text-center text-xs font-medium text-warning">
            Sample preview enabled — Explorer and Decoder fixtures are not live Arkiv data.
          </div>
        )}
        <main
          id="main"
          className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10"
        >
          {children}
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-4 text-xs text-subtle-foreground sm:px-8">
          <span>ATLAS Developer Studio</span>
          <span>Community data is unverified · Canonical data is source-provenanced</span>
        </footer>
      </div>
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Search pages and actions…" />
        <CommandList>
          <CommandEmpty>No matching pages.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {NAV.map((item) => (
              <CommandItem
                key={item.to}
                value={`${item.label} ${item.hint}`}
                onSelect={() => {
                  setPaletteOpen(false);
                  void navigate({ to: item.to });
                }}
              >
                <item.icon className="mr-2 size-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem
              value="toggle sample preview"
              onSelect={() => {
                setSample(!sample);
                setPaletteOpen(false);
              }}
            >
              {sample ? "Disable sample preview" : "Enable sample preview (not live)"}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
