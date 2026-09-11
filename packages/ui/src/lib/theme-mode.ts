// The mode contract shared by the pre-paint script and the React provider
// (ADR-064). Both halves have to agree on the storage key, the class names
// and the resolution rule, so they read them from here rather than from two
// copies. Pure — no React, no DOM at module scope — so the script builder can
// run on the server and the provider can import the same constants.
//
// ADR-008 / plan A5.4: the MODE is the user's. Branding is the admin's. This
// file never touches brand tokens.

const THEME_STORAGE_KEY = "theme";
const PREFERS_DARK_QUERY = "(prefers-color-scheme: dark)";

const RESOLVED_THEME_MODES = ["light", "dark"] as const;
const THEME_MODES = ["light", "dark", "system"] as const;

type ResolvedThemeMode = (typeof RESOLVED_THEME_MODES)[number];
type ThemeMode = (typeof THEME_MODES)[number];

const DEFAULT_THEME_MODE: ThemeMode = "system";

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}

/**
 * The pre-paint init script's body.
 *
 * Stringified via `Function.prototype.toString()` and therefore SELF-CONTAINED
 * ON PURPOSE: everything it needs arrives as an argument. A reference to a
 * module-scope binding here would survive `toString()` as a minified name that
 * does not exist in the browser, and the theme would only apply after
 * hydration — the flash this script exists to prevent.
 */
function applyStoredThemeMode(storageKey: string, defaultMode: string, modeClasses: string[]) {
  const root = document.documentElement;
  let mode = defaultMode;
  try {
    mode = localStorage.getItem(storageKey) || defaultMode;
  } catch {
    // Private mode / storage disabled: fall through on the default.
  }
  const resolved =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  root.classList.remove(...modeClasses);
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

/** The IIFE `<ThemeScript>` inlines. Deterministic — safe inside a cached page. */
function buildThemeInitScript(): string {
  const args = [THEME_STORAGE_KEY, DEFAULT_THEME_MODE, RESOLVED_THEME_MODES as unknown as string[]]
    .map((arg) => JSON.stringify(arg))
    .join(",");

  return `(${applyStoredThemeMode.toString()})(${args})`;
}

export {
  DEFAULT_THEME_MODE,
  PREFERS_DARK_QUERY,
  RESOLVED_THEME_MODES,
  THEME_MODES,
  THEME_STORAGE_KEY,
  buildThemeInitScript,
  isThemeMode,
};
export type { ResolvedThemeMode, ThemeMode };
