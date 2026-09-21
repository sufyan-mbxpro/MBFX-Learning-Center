// "An account's email was just verified" — a seam, not a feature (ADR-124).
//
// The newsletter needs to hear about a verification: a subscription ticked at
// sign-up waits on exactly that proof. But the newsletter lives in
// `@repo/core`, and `@repo/auth` may never import `@repo/core` (ADR-078 — the
// session path must not drag rbac, settings, theme and i18n behind it). So auth
// publishes the event and the APP subscribes a core service to it, in the one
// module that mounts the handler the verification link reaches
// (`app/api/auth/[...all]/route.ts`).
//
// Keyed rather than a bare list, so a hot reload that re-runs the registering
// module replaces its listener instead of adding a second copy of it.

export interface VerifiedUser {
  id: string;
  email: string;
}

export type EmailVerifiedListener = (user: VerifiedUser) => Promise<unknown>;

const listeners = new Map<string, EmailVerifiedListener>();

/** Register (or replace) the listener stored under `key`. */
export function onEmailVerified(key: string, listener: EmailVerifiedListener): void {
  listeners.set(key, listener);
}

/**
 * Run every listener, each isolated from the others and from the caller.
 *
 * A listener that throws is swallowed: verification has already happened by the
 * time this runs, and a newsletter write that failed must not turn "your email
 * is verified" into an error page. The failure is logged, never rethrown.
 */
export async function notifyEmailVerified(user: VerifiedUser): Promise<void> {
  await Promise.all(
    [...listeners.entries()].map(async ([key, listener]) => {
      try {
        await listener(user);
      } catch (error) {
        console.error(`[auth] email-verified listener "${key}" failed`, error);
      }
    }),
  );
}

/** Test seam: forget every listener. */
export function clearEmailVerifiedListeners(): void {
  listeners.clear();
}
