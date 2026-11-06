import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Command as CmdIcon, Menu } from "lucide-react";
import { NAV } from "@/lib/atlas/nav";
import { useSampleMode } from "@/lib/atlas/sample-mode";
import { getApiBaseUrl } from "@/api/atlasClient";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-md">
      <span className="grid size-7 place-items-center rounded-lg bg-primary font-mono text-xs font-bold text-primary-foreground">
        A
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-[0.2em]">ATLAS</span>
        <span className="hidden text-[10px] text-subtle lg:block">
          Search. Decode. Investigate. Integrate.
        </span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { sample, setSample } = useSampleMode();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const configured = !!getApiBaseUrl();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:px-6">
          <Wordmark />
          <nav
            aria-label="Primary"
            className="mx-auto hidden items-center gap-0.5 rounded-full border border-border bg-background/50 p-1 md:flex"
          >
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-full px-3 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground",
                  isActive(n.to) && "bg-elevated text-foreground shadow-sm",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 py-1 text-xs text-subtle hover:text-foreground sm:flex"
              aria-label="Open command palette"
            >
              <CmdIcon className="size-3.5" /> <kbd className="font-mono">K</kbd>
            </button>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger
                className="rounded-lg border border-border p-1.5 md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-nav">
                <SheetHeader>
                  <SheetTitle className="tracking-[0.2em]">ATLAS</SheetTitle>
                </SheetHeader>
                <nav className="mt-2 flex flex-col gap-1 px-2" aria-label="Mobile">
                  {NAV.map((n) => (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={() => setSheetOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground",
                        isActive(n.to) && "bg-elevated text-foreground",
                      )}
                    >
                      <n.icon className="size-4" /> {n.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        {sample && (
          <div className="border-t border-warning/30 bg-warning/10 py-1 text-center text-xs font-medium text-warning">
            Sample preview is on. Explorer and Decoder results are fixtures, not live Arkiv data.
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-subtle md:px-6">
          <span>ATLAS Studio</span>
          <span className="flex items-center gap-1.5">
            <span
              className={cn("size-1.5 rounded-full", configured ? "bg-primary" : "bg-subtle")}
            />
            {configured ? "API URL configured" : "Backend unconfigured"}
          </span>
        </div>
      </footer>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Jump to a tool or action…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {NAV.map((n) => (
              <CommandItem
                key={n.to}
                value={`${n.label} ${n.hint}`}
                onSelect={() => {
                  setCmdOpen(false);
                  navigate({ to: n.to });
                }}
              >
                <n.icon className="size-4" />
                <span>{n.label}</span>
                <span className="ml-auto text-xs text-subtle">{n.hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem
              value="toggle sample preview"
              onSelect={() => {
                setSample(!sample);
                setCmdOpen(false);
              }}
            >
              {sample ? "Turn off sample preview" : "Turn on sample preview (not live)"}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
