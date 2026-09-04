// Real-MariaDB + real-Redis integration tests (testing.md: mocking Prisma
// hides FK and constraint bugs — don't; this module's whole job is exactly
// the kind of stateful, security-sensitive behavior a mock would hide).
// Exercises Better Auth's actual API surface end-to-end, the same way the
// ADR-001 spike did, against a fresh Testcontainers MariaDB per file and the
// real local Redis container for secondaryStorage.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { authInstance as AuthInstance } from "./index.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let authInstance: typeof AuthInstance;

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_test")
    .withUsername("test")
    .withUserPassword("test")
    .start();

  // @testcontainers/mariadb returns a `mariadb://` scheme; Prisma's `mysql`
  // datasource provider (and @prisma/adapter-mariadb) only recognize `mysql://`.
  const url = container.getConnectionUri().replace(/^mariadb:/, "mysql:");

  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = url;
  ({ authInstance } = await import("./index.ts"));
}, 120_000);

afterAll(async () => {
  await container?.stop();
});

const PASSWORD = "correct horse battery staple 42";

function freshEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

/**
 * A `Response` can carry multiple `Set-Cookie` headers (session_token AND
 * session_data are set separately) — `Headers.get("set-cookie")` returns
 * only one of them. Found the hard way: a test built a `Cookie` header from
 * `.get("set-cookie")` alone and got flaky, inexplicable cache-staleness
 * results because it was silently missing one of the two auth cookies.
 * `getSetCookie()` is the correct multi-value accessor.
 */
function cookieHeaderFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/**
 * Better Auth's `Auth` type here is intentionally the untyped-options
 * default (see index.ts's comment on `authInstance`'s annotation — naming
 * the precise `Auth<typeof authOptions>` hits a TS/Zod portability error),
 * so `.user` on API responses doesn't statically carry our additionalFields.
 * Verified present at runtime by the Module 04 live smoke test; asserted
 * here via this cast rather than widening the whole module's types.
 */
type WithAdditionalFields<T> = T & {
  status: "PENDING_VERIFICATION" | "ACTIVE" | "INACTIVE" | "SUSPENDED";
  userType: "LEARNER" | "STAFF";
};

/**
 * Extracts the URL our logEmail() dev stand-in printed, and its token.
 * Better Auth doesn't use one URL shape for every flow: email verification
 * puts the token in a `?token=` query param, but password reset embeds it
 * as a path segment (`/reset-password/:token`) — found from the actual
 * logged URL, not assumed from the verification flow's shape.
 */
function extractTokenFromLoggedUrl(logSpy: ReturnType<typeof vi.spyOn>): string {
  const call = logSpy.mock.calls.find((c: unknown[]) => String(c[0]).includes("url=http"));
  if (!call) throw new Error("no email URL was logged");
  const url = new URL(String(call[0]).split("url=")[1]!.trim());
  const token = url.searchParams.get("token") ?? url.pathname.split("/").pop();
  if (!token) throw new Error(`logged URL had no token: ${url}`);
  return token;
}

describe("sign-up → verification token round-trip → status flips ACTIVE", () => {
  it("starts PENDING_VERIFICATION, then ACTIVE after verifyEmail with the emailed token", async () => {
    const email = freshEmail("verify");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const signUp = await authInstance.api.signUpEmail({
      body: { email, password: PASSWORD, name: "Verify Test" },
    });
    expect((signUp.user as WithAdditionalFields<typeof signUp.user>).status).toBe(
      "PENDING_VERIFICATION",
    );

    const token = extractTokenFromLoggedUrl(logSpy);
    logSpy.mockRestore();

    await authInstance.api.verifyEmail({ query: { token } });

    // verifyEmail doesn't itself authenticate us; check via a fresh sign-in instead.
    const signIn = await authInstance.api.signInEmail({ body: { email, password: PASSWORD } });
    expect((signIn.user as WithAdditionalFields<typeof signIn.user>).status).toBe("ACTIVE");
    expect(signIn.user.emailVerified).toBe(true);
  });

  it("sign-in is never blocked by an unverified email — plan.md: required to comment/access premium, not to read", async () => {
    const email = freshEmail("unverified");
    await authInstance.api.signUpEmail({ body: { email, password: PASSWORD, name: "Unverified" } });

    const signIn = await authInstance.api.signInEmail({ body: { email, password: PASSWORD } });
    expect(signIn.user.emailVerified).toBe(false);
    expect(signIn.token).toBeTruthy();
  });
});

describe("lockout: security.md #13 — exponential backoff, never a hard lock", () => {
  it("increments failedLoginCount on wrong-password attempts and resets it on a successful sign-in", async () => {
    const email = freshEmail("lockout-reset");
    await authInstance.api.signUpEmail({
      body: { email, password: PASSWORD, name: "Lockout Reset" },
    });

    for (let i = 0; i < 3; i++) {
      await authInstance.api.signInEmail({ body: { email, password: "wrong" } }).catch(() => {});
    }

    const { db } = await import("@repo/db");
    const afterFailures = await db.user.findUniqueOrThrow({ where: { email } });
    expect(afterFailures.failedLoginCount).toBe(3);

    await authInstance.api.signInEmail({ body: { email, password: PASSWORD } });
    const afterSuccess = await db.user.findUniqueOrThrow({ where: { email } });
    expect(afterSuccess.failedLoginCount).toBe(0);
    expect(afterSuccess.lockedUntil).toBeNull();
  });

  it("locks the account after the threshold, blocking even the CORRECT password until it expires — and the lockout always has an expiry", async () => {
    const email = freshEmail("lockout-block");
    await authInstance.api.signUpEmail({
      body: { email, password: PASSWORD, name: "Lockout Block" },
    });

    for (let i = 0; i < 5; i++) {
      await authInstance.api.signInEmail({ body: { email, password: "wrong" } }).catch(() => {});
    }

    const { db } = await import("@repo/db");
    const locked = await db.user.findUniqueOrThrow({ where: { email } });
    expect(locked.failedLoginCount).toBe(5);
    expect(locked.lockedUntil).not.toBeNull();
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    // "never a hard lock" — the expiry itself is the proof, not just its presence.
    expect(locked.lockedUntil!.getTime()).toBeLessThan(Date.now() + 16 * 60 * 1000);

    await expect(
      authInstance.api.signInEmail({ body: { email, password: PASSWORD } }),
    ).rejects.toThrow();
  });
});

describe("password reset: single-use, 30-minute expiry (plan.md)", () => {
  it("a reset token works once, then is rejected on a second use", async () => {
    const email = freshEmail("reset");
    await authInstance.api.signUpEmail({ body: { email, password: PASSWORD, name: "Reset Test" } });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await authInstance.api.requestPasswordReset({ body: { email } });
    const token = extractTokenFromLoggedUrl(logSpy);
    logSpy.mockRestore();

    await authInstance.api.resetPassword({
      body: { token, newPassword: "a whole new passphrase 99" },
    });

    // New password works.
    const signIn = await authInstance.api.signInEmail({
      body: { email, password: "a whole new passphrase 99" },
    });
    expect(signIn.token).toBeTruthy();

    // The same token cannot be reused.
    await expect(
      authInstance.api.resetPassword({
        body: { token, newPassword: "yet another passphrase 123" },
      }),
    ).rejects.toThrow();
    // The 30-minute (not Better Auth's 1-hour default) expiry itself is
    // covered in index.test.ts — a pure option-shape check, no DB needed.
  });
});

describe("session revocation — the plan's headline requirement: next request 401/null immediately", () => {
  it("auth() returns null right after sign-out, with no stale window", async () => {
    const email = freshEmail("revoke");
    const signUp = await authInstance.api.signUpEmail({
      body: { email, password: PASSWORD, name: "Revoke Test" },
      asResponse: true,
    });
    const headers = new Headers({ cookie: cookieHeaderFrom(signUp) });

    const before = await authInstance.api.getSession({
      headers,
      query: { disableCookieCache: true },
    });
    expect(before?.user.email).toBe(email);

    await authInstance.api.revokeSession({
      headers,
      body: { token: before!.session.token },
    });

    const after = await authInstance.api.getSession({
      headers,
      query: { disableCookieCache: true },
    });
    expect(after).toBeNull();

    const { db } = await import("@repo/db");
    const row = await db.session.findUnique({ where: { token: before!.session.token } });
    expect(row).toBeNull();
  });
});

describe("a session's attached user snapshot can outlive a direct database change — @repo/rbac's loadSubject is the mitigation, not getSession", () => {
  it("getSession can still return a stale userType for an otherwise-valid session, even with disableCookieCache", async () => {
    // A real, verified finding, not a documented guarantee: with Redis
    // secondaryStorage configured (ADR-001), a still-valid session's
    // attached user data can lag a direct database write —
    // `disableCookieCache` bypasses the *cookie* snapshot (proven by the
    // revocation test above using it correctly), but not this. Recorded
    // here as the reason apps/web's admin layout re-check does NOT trust
    // session.user.userType — see the next test and the layout's own
    // comment.
    const email = freshEmail("staff-promote");
    const signUp = await authInstance.api.signUpEmail({
      body: { email, password: PASSWORD, name: "Staff Promote" },
      asResponse: true,
    });
    const headers = new Headers({ cookie: cookieHeaderFrom(signUp) });

    const { db } = await import("@repo/db");
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.userType).toBe("LEARNER");

    await db.user.update({ where: { id: user.id }, data: { userType: "STAFF" } });

    const session = await authInstance.api.getSession({
      headers,
      query: { disableCookieCache: true },
    });
    const sessionUser = session?.user as
      WithAdditionalFields<NonNullable<typeof session>["user"]> | undefined;
    // Documents the limitation currently observed — if a future Better
    // Auth version starts returning "STAFF" here too, that's good news;
    // update this assertion and drop the loadSubject workaround below.
    expect(sessionUser?.userType).toBe("LEARNER");

    // The actual authoritative check, same shape as @repo/rbac's
    // loadSubject (which apps/web/app/(admin)/layout.tsx's StaffGate uses
    // instead of session.user.userType): trust only the session's user
    // *id*, then re-query fresh. (Not imported from @repo/rbac directly —
    // rbac already depends on auth for the auth() shape, so auth importing
    // rbac back would be a package cycle; @repo/db, which this proves
    // against, is already a real dependency here.)
    const fresh = await db.user.findUniqueOrThrow({ where: { id: session!.user.id } });
    expect(fresh.userType).toBe("STAFF");
  });
});
