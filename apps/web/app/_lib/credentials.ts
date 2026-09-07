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

/** What the credential POST returns — `userType` drives the surface check. */
export type SignInResult =
  { status: "ok"; userType: "LEARNER" | "STAFF" | null } | { status: "failed" };

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

  const body = (await response.json().catch(() => null)) as { user?: { userType?: string } } | null;
  const userType = body?.user?.userType;
  return {
    status: "ok",
    userType: userType === "STAFF" || userType === "LEARNER" ? userType : null,
  };
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
 * Ends the session the credential POST just created — how each screen turns
 * away the other surface's account type. Failure is swallowed on purpose:
 * this is UX, and the caller's error message is still correct if it doesn't
 * land. Nothing about authorization depends on it (ADR-052 §3).
 */
export async function signOutSilently(): Promise<void> {
  await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => {});
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
  if (!target || !target.startsWith("/") || target.startsWith("//")) return fallback;
  return isAllowed(target) ? target : fallback;
}

/** True for `/admin` and anything under it — the staff portal's own paths. */
export function isAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}
