// Browser-side helpers shared by the two credential screens (ADR-052): the
// learner pair under (public)/[locale] and the staff one under
// (admin-auth). Shared app-level code with no admin-only dependency, so
// importing it from the public surface is inside architecture.md #5.
//
// Every call here goes to Better Auth's own HTTP handler under /api/auth.
// That is deliberate and not a detail to optimize away: rate limiting, the
// lockout hooks and the session cookies all live on those endpoints
// (ADR-001 finding #4), so a server action wrapping the same logic would
// quietly lose all three.
import { rememberSession } from "./session-hint.ts";

/**
 * What the credential POST returns — `userType` drives the surface check.
 *
 * `twoFactor` (ADR-123): the password was right, the account has two-factor
 * on, and Better Auth has NOT created a session — it set a short-lived
 * challenge cookie instead. The screen must ask for a code and call
 * `verifyTwoFactorSignIn`; navigating on would land a signed-out reader.
 */
export type SignInResult =
  | { status: "ok"; userType: "LEARNER" | "STAFF" | null }
  | { status: "twoFactor" }
  | { status: "failed" };

/**
 * `userType` is one of `@repo/auth`'s `additionalFields`, and Better Auth
 * returns the freshly-read user row on a successful sign-in — so this is
 * the current value, not the session snapshot that
 * packages/auth/src/auth.integration.test.ts documents as potentially
 * stale. `null` when the field is absent for any reason: the callers treat
 * that as "can't tell" and fall through to the real server-side boundary
 * rather than guessing.
 */
export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const response = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return { status: "failed" };

  const body = (await response.json().catch(() => null)) as {
    user?: { userType?: string };
    twoFactorRedirect?: boolean;
  } | null;
  if (body?.twoFactorRedirect === true) return { status: "twoFactor" };
  const userType = body?.user?.userType;
  return {
    status: "ok",
    userType: userType === "STAFF" || userType === "LEARNER" ? userType : null,
  };
}

export type TwoFactorSignInResult =
  | { status: "ok"; userType: "LEARNER" | "STAFF" | null }
  | { status: "invalidCode" }
  | { status: "expired" }
  | { status: "failed" };

/**
 * The second step of a two-factor sign-in: the authenticator code, checked
 * against the challenge cookie the credential POST set. Better Auth's own
 * endpoint, so its per-challenge attempt cap and per-account lockout apply
 * (ADR-001 #4).
 *
 * `expired` is the challenge itself gone (ten minutes, or too many wrong
 * codes): the reader has to start again from the password, which a wrong-code
 * message would not tell them.
 */
export async function verifyTwoFactorSignIn(code: string): Promise<TwoFactorSignInResult> {
  const response = await fetch("/api/auth/two-factor/verify-totp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  }).catch(() => null);
  if (!response) return { status: "failed" };

  const body = (await response.json().catch(() => null)) as {
    user?: { userType?: string };
    code?: string;
  } | null;
  if (response.ok) {
    const userType = body?.user?.userType;
    return {
      status: "ok",
      userType: userType === "STAFF" || userType === "LEARNER" ? userType : null,
    };
  }
  if (body?.code === "INVALID_CODE") return { status: "invalidCode" };
  if (
    body?.code === "INVALID_TWO_FACTOR_COOKIE" ||
    body?.code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE"
  ) {
    return { status: "expired" };
  }
  return { status: "failed" };
}

export type SignUpResult = { status: "ok" } | { status: "taken" } | { status: "failed" };

/**
 * Public self-registration. `userType` and `status` are `input: false` in
 * `@repo/auth`'s `additionalFields`, so the new row is a LEARNER pending
 * verification no matter what this body says — the mass-assignment defense
 * (security.md #6) is that config, not anything callable from here.
 */
export async function signUpWithPassword(input: {
  name: string;
  email: string;
  password: string;
  /**
   * Where Better Auth's verification callback sends the browser after it
   * flips `emailVerified` — a localized `/sign-in?verified=1` (ADR-079 #7).
   * Without it the callback lands on the library's default and the learner is
   * left on a blank confirmation with nothing to do next.
   */
  callbackURL?: string;
}): Promise<SignUpResult> {
  const response = await fetch("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.ok) return { status: "ok" };

  // Prefix match, not equality — measured against the running handler, not
  // read off a constant: Better Auth returns
  // `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` here, while its own exported
  // error code is `USER_ALREADY_EXISTS`. Equality on either one alone
  // silently degrades "that email is taken" into the generic failure, which
  // is the difference between a user fixing the problem and giving up.
  const body = (await response.json().catch(() => null)) as { code?: string } | null;
  return body?.code?.startsWith("USER_ALREADY_EXISTS") ? { status: "taken" } : { status: "failed" };
}

/**
 * Ends the current session. THE one sign-out request: every button, menu
 * item and timer calls this rather than writing its own `fetch`.
 *
 * The JSON content type and `{}` body are the fix, not ceremony. Better Auth
 * answers a bodyless POST to /sign-out with **415 Unsupported Media Type and
 * leaves the session valid** — which is what all four call sites sent, so the
 * sidebar button, the profile menu, the ADR-041 idle timeout and the
 * wrong-surface turn-away below all navigated away from a session that was
 * still alive (found in the changes-20 admin visual pass, reproduced against
 * the running handler: 415 → `get-session` still returned the session).
 *
 * Resolves `true` when the server confirmed it.
 */
export async function signOut(): Promise<boolean> {
  const response = await fetch("/api/auth/sign-out", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  // ADR-124 §3: forget the pre-paint "signed in" hint, so the page this
  // sign-out navigates to shows its subscribe bands at first paint.
  if (response.ok) rememberSession(false);
  return response.ok;
}

/**
 * Ends the session the credential POST just created — how each screen turns
 * away the other surface's account type. Failure is swallowed on purpose:
 * this is UX, and the caller's error message is still correct if it doesn't
 * land. Nothing about authorization depends on it (ADR-052 §3).
 */
export async function signOutSilently(): Promise<void> {
  await signOut().catch(() => false);
}

/**
 * Reads `?redirect=` from the LIVE URL rather than `useSearchParams()`,
 * which would block prerendering of the static page shell (Cache Components
 * wants a Suspense boundary around that hook; this needs neither, because
 * it only runs at submit time).
 *
 * Open-redirect guard: same-origin paths only — never a full URL, never a
 * protocol-relative "//evil.com" — and then `isAllowed` narrows it further
 * to the destinations THIS surface is willing to send someone to.
 */
export function resolveRedirect(fallback: string, isAllowed: (path: string) => boolean): string {
  const target = new URLSearchParams(window.location.search).get("redirect");
  // A backslash anywhere is refused too (changes-49): browsers read `/\evil`
  // as `//evil`, a protocol-relative URL to another host.
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    return fallback;
  }
  return isAllowed(target) ? target : fallback;
}

/** True for `/admin` and anything under it — the staff portal's own paths. */
export function isAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

// ─── Password recovery and verification (ADR-079) ────────────
//
// All three POST to Better Auth's own handlers for the reason at the top of
// this file: the per-IP `rateLimit.customRules` for these exact paths, the
// lockout hooks and `onPasswordReset` all live there (ADR-079 #5, #6). A
// server action wrapping the same logic would silently lose every one.

/**
 * Ask for a reset link. Resolves the SAME way whether or not the address
 * exists — Better Auth answers identically and even simulates the lookup, and
 * the screens say "if this email exists…" rather than confirming anything
 * (ADR-079 #4).
 *
 * There is no `redirectTo`: `sendResetPassword` builds the link itself from
 * `user.userType`, because the recipient's identity decides which surface the
 * link belongs to — never the screen that asked (ADR-079 #2).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await fetch("/api/auth/request-password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }).catch(() => undefined);
}

export type ResetPasswordResult =
  { status: "ok" } | { status: "invalidToken" } | { status: "tooShort" } | { status: "failed" };

/**
 * Set the new password.
 *
 * The three outcomes are distinguished because they need different screens: an
 * expired link needs a way to request another, a short password needs the
 * field corrected, and anything else is the generic failure. The codes are
 * measured against the running handler, not read off a constant — the same
 * discipline `signUpWithPassword` records above.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<ResetPasswordResult> {
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  if (response.ok) return { status: "ok" };

  const body = (await response.json().catch(() => null)) as { code?: string } | null;
  if (body?.code === "INVALID_TOKEN") return { status: "invalidToken" };
  if (body?.code === "PASSWORD_TOO_SHORT") return { status: "tooShort" };
  return { status: "failed" };
}

/**
 * Re-send the verification email (ADR-079 #7). Verification never blocks
 * sign-in, so this is a nudge the learner can act on, not a gate they are
 * stuck behind.
 *
 * `callbackURL` is where Better Auth's own verification callback sends the
 * browser once it has flipped `emailVerified` — a localized `/sign-in?verified=1`.
 */
export async function resendVerification(email: string, callbackURL: string): Promise<boolean> {
  const response = await fetch("/api/auth/send-verification-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, callbackURL }),
  }).catch(() => null);
  return response?.ok ?? false;
}
