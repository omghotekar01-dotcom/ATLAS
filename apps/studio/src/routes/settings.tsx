import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun, Monitor, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { PageHeader, Panel, SampleSwitch } from "@/components/atlas/primitives";
import { usePreferences, type ThemePref } from "@/lib/atlas/preferences";
import { getApiBaseUrl } from "@/api/atlasClient";

export const Route = createFileRoute("/settings")({ component: Settings });
function Settings() {
  const { prefs, resolvedTheme, setPref } = usePreferences();
  const choices = [
    { key: "light", title: "Light", icon: Sun },
    { key: "dark", title: "Dark", icon: Moon },
    { key: "system", title: "System", icon: Monitor },
  ] as const;
  return (
    <>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Tune the Developer Studio without changing the Arkiv registry, chain configuration, or backend secrets."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-primary" />
            <h2 className="text-base font-semibold">Appearance</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {choices.map((choice) => (
              <button
                key={choice.key}
                type="button"
                onClick={() => setPref("theme", choice.key as ThemePref)}
                aria-pressed={prefs.theme === choice.key}
                className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${prefs.theme === choice.key ? "border-primary bg-selected text-selected-foreground" : "border-border bg-card hover:bg-secondary"}`}
              >
                <choice.icon className="size-5" />
                {choice.title}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Resolved display: {resolvedTheme}</p>
          <label className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4 text-sm">
            <span>Reduced animation</span>
            <input
              type="checkbox"
              checked={prefs.reduceMotion}
              onChange={(event) => setPref("reduceMotion", event.target.checked)}
              className="size-4 accent-primary"
            />
          </label>
          <label className="mt-4 flex items-center justify-between gap-4 text-sm">
            <span>Compact density</span>
            <input
              type="checkbox"
              checked={prefs.density === "compact"}
              onChange={(event) =>
                setPref("density", event.target.checked ? "compact" : "comfortable")
              }
              className="size-4 accent-primary"
            />
          </label>
        </Panel>
        <Panel>
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="text-base font-semibold">Data and provenance</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Canonical signature answers require verified Arkiv records with source metadata.
            Community 4byte matches are intentionally separate and cannot prove contract identity or
            safety.
          </p>
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-medium">Sample preview</h3>
            <SampleSwitch />
            <p className="mt-2 text-xs text-muted-foreground">
              Fixtures are clearly labelled, never mixed with live lookup results.
            </p>
          </div>
        </Panel>
        <Panel>
          <h2 className="text-base font-semibold">Privacy and safety</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Theme, motion and display density are saved in your browser. The Studio never needs your
            wallet private key for these views. Canonical and community lookup data remain visually
            separated.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Network selection and transaction signing are deliberately not controlled by display
            settings.
          </p>
        </Panel>
        <Panel>
          <h2 className="text-base font-semibold">Backend configuration</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            The API URL is supplied at build time; editing this screen does not change it.
          </p>
          <code className="mt-3 block break-all rounded-lg border border-border bg-code p-3 font-mono text-xs">
            {getApiBaseUrl() ?? "Set VITE_ATLAS_API_URL before starting Studio"}
          </code>
          <p className="mt-4 text-xs text-muted-foreground">
            No secret keys, wallet credentials, or blockchain writes are configured here.
          </p>
        </Panel>
      </div>
    </>
  );
}
