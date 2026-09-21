// The pre-paint "signed in" hint (ADR-124 §3).
//
// ─── The problem ──────────────────────────────────────────────────────────
//
// The newsletter subscribe bands are hidden for a signed-in reader. The public
// pages are cached (ADR-004) and read no session on the server (ADR-094), so
// the server HTML has to carry every band, and only the client can know who is
// reading. Waiting for `PublicSessionProvider`'s fetch would paint the band and
// then remove it — a block of the page collapsing ~200ms after load, on every
// page, for exactly the readers the owner asked to spare it.
//
// ─── The answer, and what it is not ───────────────────────────────────────
//
// The provider remembers its last answer in localStorage, and a pre-paint
// script (the ADR-064 theme-script technique) copies that into a
// `data-session` attribute on `<html>` before first paint. The bands carry
// `SIGNED_OUT_ONLY_CLASS`, which hides them under that attribute. When the
// session resolves, the provider corrects both the attribute and the stored
// hint, so a stale hint costs one appearance, never a wrong steady state.
//
// This is DISPLAY, never authorization (ADR-094): the hint says nothing the
// server believes, and a reader who clears it just sees a subscribe band.
//
// The worst case is a returning reader whose session expired: the band is
// hidden at first paint and appears once the provider resolves `anonymous`.
// Showing content late is the safe direction to be wrong in.

/** localStorage key. Namespaced so a future hint cannot collide with it. */
export const SESSION_HINT_KEY = "mbx:session";

/** The attribute value the class below keys on. */
export const SESSION_HINT_SIGNED_IN = "learner";

/**
 * The class a band carries to be hidden for a signed-in reader. One constant,
 * so the pre-paint script, the provider and every band agree on the name —
 * and a source guard can find every placement that uses it. Written out in
 * full here so Tailwind's scanner emits the rule.
 */
export const SIGNED_OUT_ONLY_CLASS = "in-data-[session=learner]:hidden";

/**
 * The pre-paint script's body. Self-contained on purpose — it is stringified,
 * so it may reference nothing outside its own arguments (theme-mode.ts records
 * the same constraint).
 */
function applySessionHint(storageKey: string, signedIn: string) {
  try {
    if (localStorage.getItem(storageKey) === signedIn) {
      document.documentElement.setAttribute("data-session", signedIn);
    }
  } catch {
    // Storage disabled: no hint, the bands show until the provider resolves.
  }
}

/** The IIFE the layout inlines. Deterministic, so it is safe in a cached page. */
export function buildSessionHintScript(): string {
  const args = [SESSION_HINT_KEY, SESSION_HINT_SIGNED_IN].map((a) => JSON.stringify(a)).join(",");
  return `(${applySessionHint.toString()})(${args})`;
}

/**
 * Record the resolved session: the attribute for this page, the stored hint for
 * the next one. Called by the provider when its read resolves, by the sign-in
 * and sign-up forms on success (so the page they navigate to is right at first
 * paint), and by `signOut()`.
 */
export function rememberSession(signedIn: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (signedIn) localStorage.setItem(SESSION_HINT_KEY, SESSION_HINT_SIGNED_IN);
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Storage disabled — the attribute below still covers this page.
  }
  if (signedIn) document.documentElement.setAttribute("data-session", SESSION_HINT_SIGNED_IN);
  else document.documentElement.removeAttribute("data-session");
}
