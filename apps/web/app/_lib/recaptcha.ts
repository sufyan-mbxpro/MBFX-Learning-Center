// Google reCAPTCHA in the browser (ADR-156, ADR-158): load Google's script,
// and produce a token at submit time. The server half is `@repo/auth`'s
// `captcha.ts`. Shared app-level code with no admin-only dependency, so the
// staff sign-in (admin-auth), the learner forms, the support form and the
// settings tab's key check all use this one file (architecture.md #5).
//
// Two types, chosen in Settings → General → reCAPTCHA:
//
//   - SCORE (v3): nothing to render. v3 scores the visit, Google's own badge
//     is the notice, and a token is minted for one action at submit.
//   - CHECKBOX (v2): "I'm not a robot" inside the form, drawn by
//     `RecaptchaCheckbox`, which registers its widget here. The token is the
//     widget's answer, read at submit and then reset, because an answer is
//     single-use (ADR-158 #5).
//
// The script is loaded by the first form that mounts, not by the root layout,
// so a page with no guarded form never contacts Google.
//
// The key and type are DATA. The page reads them on the server and hands them
// to the form, which registers them here. `null` means the check is off, and
// the server agrees: both read the same row.
import { useEffect } from "react";
import type { CaptchaAction, CaptchaClientConfig } from "@repo/contracts";

interface Grecaptcha {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
  render(container: HTMLElement, options: { sitekey: string; theme?: "light" | "dark" }): number;
  getResponse(widgetId?: number): string;
  reset(widgetId?: number): void;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const SCRIPT_ORIGIN = "https://www.google.com/recaptcha/api.js";
const SCRIPT_ID = "recaptcha-script";
/** The v2 script is loaded once for any key: widgets name their key at render. */
export const RECAPTCHA_EXPLICIT = "explicit";

/** What the mounted form registered. Read at submit by `getCaptchaToken`. */
let active: CaptchaClientConfig | null = null;
/** What the script on the page was loaded for (a v3 site key, or EXPLICIT), and its load. */
let loaded: { render: string; api: Promise<Grecaptcha> } | null = null;
/** The checkbox on the page, when there is one. */
let checkbox: { widgetId: number; siteKey: string } | null = null;

/** Registers the page's config without a component (tests, and the hook below). */
export function setRecaptchaConfig(config: CaptchaClientConfig | null): void {
  const siteKey = config?.siteKey.trim();
  active = config && siteKey ? { siteKey, mode: config.mode } : null;
}

/** A v3 site key, the shape ADR-156 registered. Kept for the tests that use it. */
export function setRecaptchaSiteKey(siteKey: string | null): void {
  setRecaptchaConfig(siteKey ? { siteKey, mode: "SCORE" } : null);
}

function whenReady(): Promise<Grecaptcha> {
  return new Promise<Grecaptcha>((resolve, reject) => {
    const api = window.grecaptcha;
    if (!api) {
      reject(new Error("reCAPTCHA did not load"));
      return;
    }
    api.ready(() => resolve(api));
  });
}

/** `render` is a v3 site key, or EXPLICIT for the v2 checkbox. */
export function loadRecaptchaScript(render: string): Promise<Grecaptcha> {
  if (loaded?.render === render) return loaded.api;
  // Already on the page (a test, or a script we did not track).
  if (!loaded && window.grecaptcha) return whenReady();
  // Loaded for something else (the settings tab trying a key or type it has
  // not saved yet): a v3 script executes only for the key it was rendered
  // with, so start over.
  if (loaded) {
    document.getElementById(SCRIPT_ID)?.remove();
    delete window.grecaptcha;
    checkbox = null;
  }
  const api = new Promise<Grecaptcha>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `${SCRIPT_ORIGIN}?render=${encodeURIComponent(render)}`;
    script.async = true;
    script.onload = () => void whenReady().then(resolve, reject);
    script.onerror = () => reject(new Error("reCAPTCHA did not load"));
    document.head.appendChild(script);
  });
  const entry = { render, api };
  loaded = entry;
  // A failed load (a blocker, a flaky network) must not stick: the next submit
  // tries again rather than failing forever on a cached rejection.
  api.catch(() => {
    if (loaded === entry) {
      loaded = null;
      document.getElementById(SCRIPT_ID)?.remove();
    }
  });
  return api;
}

/** Called by `RecaptchaCheckbox` once Google has drawn it, and with `null` on unmount. */
export function registerRecaptchaCheckbox(widget: { widgetId: number; siteKey: string } | null) {
  checkbox = widget;
}

/**
 * Pure: was this page reached by a CLIENT-SIDE navigation, so the document's
 * CSP is some other page's? The proxy names Google only on the guarded pages
 * (ADR-156 #9), and a browser keeps the policy of the document it LOADED: a
 * soft navigation from `/` to `/sign-in` still runs under `/`'s policy, which
 * blocks Google's script. `documentUrl` is the navigation entry's URL.
 */
export function reachedBySoftNavigation(documentUrl: string | undefined, href: string): boolean {
  if (!documentUrl) return false;
  try {
    return new URL(documentUrl).pathname !== new URL(href).pathname;
  } catch {
    return false;
  }
}

const RELOAD_MARK = "recaptcha-reload";

/**
 * Reloads a guarded page once when it was reached by a soft navigation, so
 * the page's own CSP applies. Runs at mount, before anyone has typed. The
 * sessionStorage mark caps it at one reload per path, so a policy that still
 * blocks Google after a real load cannot become a reload loop.
 */
export function reloadIfForeignPolicy(): boolean {
  const entry = performance.getEntriesByType("navigation")[0];
  try {
    if (!reachedBySoftNavigation(entry?.name, window.location.href)) {
      // A real load of this page: its own policy applies. Clear the mark so a
      // LATER soft navigation here in the same tab reloads again.
      sessionStorage.removeItem(RELOAD_MARK);
      return false;
    }
    if (sessionStorage.getItem(RELOAD_MARK) === window.location.pathname) return false;
    sessionStorage.setItem(RELOAD_MARK, window.location.pathname);
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * Registers the page's config as soon as a guarded form mounts. In SCORE mode
 * it also starts Google's script, so a token is ready at submit; in CHECKBOX
 * mode `RecaptchaCheckbox` loads it. `null` = off.
 */
export function useRecaptcha(config: CaptchaClientConfig | null): void {
  const siteKey = config?.siteKey ?? null;
  const mode = config?.mode ?? null;
  useEffect(() => {
    setRecaptchaConfig(siteKey && mode ? { siteKey, mode } : null);
    if (!siteKey || reloadIfForeignPolicy()) return;
    if (mode === "SCORE") void loadRecaptchaScript(siteKey).catch(() => undefined);
  }, [siteKey, mode]);
}

/**
 * `false` only when the checkbox is on the page and has not been ticked (or
 * its answer expired). The forms ask this before submitting, so an unticked
 * box gets its own message rather than a round trip (ADR-158 #4).
 */
export function captchaAnswered(): boolean {
  if (active?.mode !== "CHECKBOX") return true;
  if (!checkbox || !window.grecaptcha) return false;
  try {
    return window.grecaptcha.getResponse(checkbox.widgetId) !== "";
  } catch {
    return false;
  }
}

/**
 * `token: null` means the check is off: send the request without one.
 * `ok: false` means it is on and no token could be produced: Google's script
 * was blocked or never answered, or (`unchecked`) the box was not ticked. The
 * caller shows the captcha message instead of posting a request the server
 * would only refuse.
 */
export type CaptchaTokenResult =
  { ok: true; token: string | null } | { ok: false; unchecked?: boolean };

/**
 * Produces a token. Tokens are single-use and expire in two minutes, so call
 * this AT submit. `config` defaults to the registered one; the settings tab
 * passes the key and type it is about to save.
 */
export async function getCaptchaToken(
  action: CaptchaAction,
  config: CaptchaClientConfig | null = active,
): Promise<CaptchaTokenResult> {
  if (!config?.siteKey) return { ok: true, token: null };
  if (config.mode === "CHECKBOX") return readCheckbox(config.siteKey);
  try {
    const api = await loadRecaptchaScript(config.siteKey);
    const token = await api.execute(config.siteKey, { action });
    return token ? { ok: true, token } : { ok: false };
  } catch {
    return { ok: false };
  }
}

function readCheckbox(siteKey: string): CaptchaTokenResult {
  const api = window.grecaptcha;
  if (!checkbox || checkbox.siteKey !== siteKey || !api) return { ok: false };
  try {
    const token = api.getResponse(checkbox.widgetId);
    if (!token) return { ok: false, unchecked: true };
    // Single-use: the next submit (after a wrong password, say) needs a new tick.
    api.reset(checkbox.widgetId);
    return { ok: true, token };
  } catch {
    return { ok: false };
  }
}
