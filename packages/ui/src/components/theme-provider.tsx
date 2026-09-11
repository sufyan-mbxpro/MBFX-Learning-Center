"use client";

// User-controlled light/dark mode (ADR-008 / plan A5.4): the user picks the
// mode, admins control branding, never the reverse. Pairs with globals.css's
// `@custom-variant dark (&:where(.dark, .dark *))`, so the contract with CSS is
// the class on <html>. Shared by both surfaces — the admin shell mounts it too,
// because sonner's Toaster reads useTheme().
//
// ADR-064: this replaced next-themes, whose provider rendered the pre-paint
// script from inside the client tree. The script now lives in <ThemeScript>, a
// server component; NOTHING HERE MAY RENDER A <script>. See theme-script.tsx.
import * as React from "react";

import {
  DEFAULT_THEME_MODE,
  PREFERS_DARK_QUERY,
  RESOLVED_THEME_MODES,
  THEME_STORAGE_KEY,
  isThemeMode,
  type ResolvedThemeMode,
  type ThemeMode,
} from "@repo/ui/lib/theme-mode";

type ThemeContextValue = {
  /** What the user chose, "system" included. */
  theme: ThemeMode;
  /** What that resolves to right now — the class on <html>. */
  resolvedTheme: ResolvedThemeMode;
  systemTheme: ResolvedThemeMode;
  setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readStoredThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Same initial value on the server and on the client: the stored mode is read
  // in an effect, never during render, so hydration cannot diverge. Nothing
  // flashes, because <ThemeScript> already stamped the real mode on <html>
  // before first paint — this state is only catching up to the DOM.
  const [theme, setThemeState] = React.useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [systemTheme, setSystemTheme] = React.useState<ResolvedThemeMode>("light");

  React.useEffect(() => {
    setThemeState(readStoredThemeMode());
  }, []);

  React.useEffect(() => {
    const query = window.matchMedia(PREFERS_DARK_QUERY);
    const sync = () => setSystemTheme(query.matches ? "dark" : "light");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Another tab of the same site changed the mode.
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      setThemeState(isThemeMode(event.newValue) ? event.newValue : DEFAULT_THEME_MODE);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const resolvedTheme: ResolvedThemeMode = theme === "system" ? systemTheme : theme;

  // Keep <html> true after first paint — when the user toggles, or when the OS
  // preference changes under "system".
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(...RESOLVED_THEME_MODES);
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = React.useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Private mode / storage disabled: the choice holds for this page only.
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, systemTheme, setTheme }),
    [theme, resolvedTheme, systemTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// A stub outside a provider rather than a throw: a component that only reads
// the mode for a cosmetic detail must stay renderable in isolation (unit tests,
// Storybook-style harnesses). setTheme is a no-op there, by design.
const THEME_FALLBACK: ThemeContextValue = {
  theme: DEFAULT_THEME_MODE,
  resolvedTheme: "light",
  systemTheme: "light",
  setTheme: () => {},
};

function useTheme(): ThemeContextValue {
  return React.useContext(ThemeContext) ?? THEME_FALLBACK;
}

export { ThemeProvider, useTheme };
export type { ResolvedThemeMode, ThemeMode };
