import { useState, type ReactNode } from "react";
import { Check, Copy, AlertTriangle, CircleSlash, Info, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSampleMode } from "@/lib/atlas/sample-mode";
import type { ApiResult } from "@/api/types";
import { toast } from "sonner";

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={done ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          toast.error("Clipboard unavailable", {
            description: "Allow clipboard access or copy the text manually.",
          });
        }
      }}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-elevated/60 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-elevated",
        done && "text-success hover:text-success",
        className,
      )}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
    </header>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn("min-w-0 rounded-2xl border border-border bg-card p-5 md:p-6", className)}
    >
      {children}
    </section>
  );
}

type Tone = "neutral" | "accent" | "success" | "warning" | "error";
const toneCls: Record<Tone, string> = {
  neutral: "border-border bg-elevated/60 text-muted-foreground",
  accent: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
};
export function Pill({
  tone = "neutral",
  children,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneCls[tone],
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: Tone;
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div role="status" className={cn("flex gap-3 rounded-xl border p-4 text-sm", toneCls[tone])}>
      <span className="mt-0.5 shrink-0">{icon ?? <Info className="size-4" />}</span>
      <div>
        <p className="font-medium">{title}</p>
        {children && <div className="mt-1 text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

export function SampleBadge() {
  return (
    <Pill tone="warning" dot>
      Sample data — not live
    </Pill>
  );
}

export function SampleSwitch() {
  const { sample, setSample } = useSampleMode();
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
      <span>
        Sample preview:{" "}
        <strong className={sample ? "text-warning" : "text-foreground"}>
          {sample ? "ON" : "OFF"}
        </strong>
      </span>
      <button
        type="button"
        role="switch"
        aria-label="Sample preview"
        aria-checked={sample}
        onClick={() => setSample(!sample)}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          sample ? "bg-warning" : "bg-elevated border border-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-foreground transition-transform",
            sample ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

/** Renders the non-success states of an ApiResult honestly. */
export function ResultState({ result }: { result: ApiResult<unknown> }) {
  switch (result.kind) {
    case "unconfigured":
      return (
        <Banner
          tone="neutral"
          icon={<CircleSlash className="size-4" />}
          title="Backend unconfigured"
        >
          No request was sent. Set{" "}
          <code className="font-mono text-foreground">VITE_ATLAS_API_URL</code> to connect the ATLAS
          API, or enable the sample preview to inspect the UI.
        </Banner>
      );
    case "network-error":
      return (
        <Banner tone="error" icon={<WifiOff className="size-4" />} title="Network error">
          The API could not be reached. Check the configured URL and network connection.
        </Banner>
      );
    case "http-error":
      return (
        <Banner
          tone="error"
          icon={<AlertTriangle className="size-4" />}
          title={`API returned ${result.status}`}
        >
          {result.code ? `${result.code}: ` : ""}
          {result.message}
        </Banner>
      );
    case "empty":
      return (
        <Banner tone="neutral" title="No matches">
          The query returned no candidates.
        </Banner>
      );
    default:
      return null;
  }
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[13px] break-all", className)}>{children}</span>;
}
