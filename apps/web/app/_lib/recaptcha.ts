// Google reCAPTCHA v3 in the browser (ADR-156): load Google's script, and mint
// a token for one action at submit time. The server half is `@repo/auth`'s
// `captcha.ts`. Shared app-level code with no admin-only dependency, so the
// staff sign-in (admin-auth), the learner forms, the support form and the
// settings tab's key check all use this one file (architecture.md #5).
//
// There is no checkbox and nothing to render: v3 scores the visit, and
// Google's own badge is the notice. The script is loaded by the first form
// that mounts (`useRecaptcha`), not by the root layout, so a page with no
// guarded form never contacts Google.
//
// The site key is DATA (Settings → General → reCAPTCHA). The page reads it
// on the server and hands it to the form, which registers it here. `null`
// means the check is off, and the server agrees: both read the same row.
import { useEffect } from "react";
import type { CaptchaAction } from "@repo/contracts";

interface Grecaptcha {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const SCRIPT_ORIGIN = "https://www.google.com/recaptcha/api.js";
const SCRIPT_ID = "recaptcha-v3";

/** The key the mounted form registered. Read at submit by `getCaptchaToken`. */
let activeSiteKey: string | null = null;
/** The key the script on the page was loaded for, and its load. */
let loaded: { siteKey: string; api: Promise<Grecaptcha> } | null = null;

/** Registers the page's site key without a component (tests, and the hook below). */
export function setRecaptchaSiteKey(siteKey: string | null): void {
  activeSiteKey = siteKey?.trim() || null;
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

function loadScript(siteKey: string): Promise<Grecaptcha> {
  if (loaded?.siteKey === siteKey) return loaded.api;
  // Already on the page for this key (a test, or a script we did not track).
  if (!loaded && window.grecaptcha) return whenReady();
  // A different key (the settings tab checking a key it has not saved yet):
  // v3 executes only for the key its script was rendered with, so start over.
  if (loaded) {
    document.getElementById(SCRIPT_ID)?.remove();
    delete window.grecaptcha;
  }
  const api = new Promise<Grecaptcha>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `${SCRIPT_ORIGIN}?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.onload = () => void whenReady().then(resolve, reject);
    script.onerror = () => reject(new Error("reCAPTCHA did not load"));
    document.head.appendChild(script);
  });
  const entry = { siteKey, api };
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

/**
 * Registers the page's site key and starts Google's script loading as soon
 * as a guarded form mounts, so a token is ready at submit. `null` = off.
 */
export function useRecaptcha(siteKey: string | null): void {
  useEffect(() => {
    setRecaptchaSiteKey(siteKey);
    if (siteKey) void loadScript(siteKey).catch(() => undefined);
  }, [siteKey]);
}

/**
 * `token: null` means the check is off: send the request without one.
 * `ok: false` means it is on and no token could be minted (Google's script was
 * blocked or never answered). The caller shows the captcha message instead of
 * posting a request the server would only refuse.
 */
export type CaptchaTokenResult = { ok: true; token: string | null } | { ok: false };

/**
 * Mints a token. Tokens are single-use and expire in two minutes, so call this
 * AT submit. `siteKey` defaults to the registered one; the settings tab passes
 * the key it is about to save.
 */
export async function getCaptchaToken(
  action: CaptchaAction,
  siteKey: string | null = activeSiteKey,
): Promise<CaptchaTokenResult> {
  if (!siteKey) return { ok: true, token: null };
  try {
    const api = await loadScript(siteKey);
    const token = await api.execute(siteKey, { action });
    return token ? { ok: true, token } : { ok: false };
  } catch {
    return { ok: false };
  }
}
