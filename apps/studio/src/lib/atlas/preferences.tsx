import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePref = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";

export interface Preferences {
  theme: ThemePref;
  reduceMotion: boolean;
  density: Density;
  uppercaseHex: boolean;
  showTechnical: boolean;
  network: string;
}

const DEFAULTS: Preferences = {
  theme: "light",
  reduceMotion: false,
  density: "comfortable",
  uppercaseHex: false,
  showTechnical: true,
  network: "mainnet",
};

const KEY = "atlas.prefs.v1";

/** Inline script run before paint so the stored theme applies without a flash. */
export const themeBootScript = `(function(){try{var p=JSON.parse(localStorage.getItem('${KEY}')||'{}');var t=p.theme||'light';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var c=document.documentElement.classList;if(d)c.add('dark');if(p.reduceMotion)c.add('reduce-motion');}catch(e){}})();`;

interface Ctx {
  prefs: Preferences;
  resolvedTheme: "light" | "dark";
  setPref: <K extends keyof Preferences>(k: K, v: Preferences[K]) => void;
}

const PrefCtx = createContext<Ctx | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || "{}");
      setPrefs({ ...DEFAULTS, ...stored });
    } catch {
      /* ignore */
    }
    const mq = matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    const id = requestAnimationFrame(() => document.documentElement.classList.add("theme-ready"));
    return () => {
      mq.removeEventListener("change", on);
      cancelAnimationFrame(id);
    };
  }, []);

  const resolvedTheme = prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;

  useEffect(() => {
    const c = document.documentElement.classList;
    c.toggle("dark", resolvedTheme === "dark");
    c.toggle("reduce-motion", prefs.reduceMotion);
    c.toggle("compact", prefs.density === "compact");
  }, [resolvedTheme, prefs.reduceMotion, prefs.density]);

  const setPref = useCallback<Ctx["setPref"]>((k, v) => {
    setPrefs((p) => {
      const next = { ...p, [k]: v };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return <PrefCtx.Provider value={{ prefs, resolvedTheme, setPref }}>{children}</PrefCtx.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PrefCtx);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}
