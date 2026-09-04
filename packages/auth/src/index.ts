// @repo/auth — Better Auth config, session helper, JWT for native clients
// (ADR-001). Replaces the Module 03 interim stub; the exported auth()
// call shape is unchanged, so @repo/rbac needs no changes.
import { headers } from "next/headers";
import { hash, verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import type { Auth, BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { twoFactor } from "better-auth/plugins/two-factor";
import { bearer } from "better-auth/plugins/bearer";
import { db } from "@repo/db";
import { redisSecondaryStorage } from "./redis-secondary-storage.ts";

// @node-rs/argon2 exports Algorithm as an ambient const enum, which
// verbatimModuleSyntax forbids referencing directly (can't verify the
// inlining is safe across the module boundary). 2 === Algorithm.Argon2id —
// already the library default; named as a constant so the choice stays
// explicit and survives a library default change.
const ARGON2ID = 2;

// ─────────────────────────────────────────────────────────────
// Lockout — security.md #13: exponential backoff, never a hard lock.
// Verified against a live spike (ADR-001-style, not guessed): a failed
// /sign-in/email attempt surfaces in hooks.after as
// `returned.body.code === "INVALID_EMAIL_OR_PASSWORD"`; a successful one has
// `returned.user` instead. Enforcement is a second hook
// (databaseHooks.session.create.before) because a *correct* password on a
// still-locked account reaches session creation — the failure path never
// gets there at all.
// ─────────────────────────────────────────────────────────────

const LOCKOUT_THRESHOLD = 5; // failed attempts before lockout starts
const LOCKOUT_BASE_SECONDS = 30;
const LOCKOUT_MAX_SECONDS = 15 * 60; // never a hard lock — always expires

function computeLockoutSeconds(failedLoginCount: number): number {
  const overflow = failedLoginCount - LOCKOUT_THRESHOLD;
  return Math.min(LOCKOUT_BASE_SECONDS * 2 ** overflow, LOCKOUT_MAX_SECONDS);
}

// ─────────────────────────────────────────────────────────────
// Email delivery — no provider is configured yet (not assigned to a module
// in plan.md). Logs the token/URL Better Auth actually generates so the
// verification/reset flow is real and testable locally; swap the body of
// this function for a real provider whenever one lands.
// ─────────────────────────────────────────────────────────────

function logEmail(kind: string, to: string, url: string) {
  console.log(`[auth email — ${kind}] to=${to} url=${url}`);
}

const adapter = prismaAdapter(db, { provider: "mysql" });

const authOptions: BetterAuthOptions = {
  database: adapter,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  secondaryStorage: redisSecondaryStorage,

  session: {
    // security.md #11: sessions must be database-backed and revocable.
    // Without this, configuring secondaryStorage moves sessions to Redis
    // ONLY — ADR-001 finding #1.
    storeSessionInDatabase: true,
    // Shorter lifetime for staff, per ADR-006 consequence #4's mandatory
    // compensating controls (same-origin learner/staff sessions).
    // Module 09/10 owns actually differentiating staff vs learner lifetime;
    // this is the site-wide default.
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieCache: {
      // Lets proxy.ts (ADR-006: gate, not boundary) read userType via
      // getCookieCache — a signed cookie, no DB round-trip — for the fast
      // optimistic STAFF check before any /admin/* route or layout runs.
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  emailAndPassword: {
    enabled: true,
    // Verification is required to comment/access premium, not to read
    // (plan.md) — so sign-in itself is never blocked on it; gating happens
    // at the application layer (FeatureVisibility / permission checks),
    // not here.
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 30 * 60, // 30 min, per plan.md
    password: {
      // Argon2id via @node-rs/argon2 overrides Better Auth's scrypt default.
      hash: (password) => hash(password, { algorithm: ARGON2ID }),
      verify: ({ hash: storedHash, password }) =>
        verify(storedHash, password, { algorithm: ARGON2ID }),
    },
    sendResetPassword: async ({ user, url }) => {
      logEmail("password-reset", user.email, url);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      logEmail("verify-email", user.email, url);
    },
    afterEmailVerification: async (user) => {
      await db.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },

  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
  },

  user: {
    additionalFields: {
      userType: { type: "string", defaultValue: "LEARNER", input: false },
      status: { type: "string", defaultValue: "PENDING_VERIFICATION", input: false },
      locale: { type: "string", defaultValue: "en" },
      timezone: { type: "string", defaultValue: "UTC" },
      themeMode: { type: "string", defaultValue: "SYSTEM" },
      firstName: { type: "string", required: false },
      lastName: { type: "string", required: false },
      phone: { type: "string", required: false },
      lastLoginAt: { type: "date", required: false, input: false },
      lastLoginIp: { type: "string", required: false, input: false },
      failedLoginCount: { type: "number", defaultValue: 0, input: false },
      lockedUntil: { type: "date", required: false, input: false },
      deletedAt: { type: "date", required: false, input: false },
    },
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { lockedUntil: true },
          });
          if (user?.lockedUntil && user.lockedUntil > new Date()) return false;
          return;
        },
      },
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/email") {
        const email = (ctx.body as { email?: string } | undefined)?.email;
        if (!email) return;
        const returned = ctx.context.returned as
          { body?: { code?: string }; user?: { id: string } } | undefined;

        if (returned?.body?.code === "INVALID_EMAIL_OR_PASSWORD") {
          const user = await db.user.findUnique({
            where: { email },
            select: { id: true, failedLoginCount: true },
          });
          if (!user) return;
          const failedLoginCount = user.failedLoginCount + 1;
          const lockedUntil =
            failedLoginCount >= LOCKOUT_THRESHOLD
              ? new Date(Date.now() + computeLockoutSeconds(failedLoginCount) * 1000)
              : null;
          await db.user.update({ where: { id: user.id }, data: { failedLoginCount, lockedUntil } });
        } else if (returned?.user) {
          await db.user.update({
            where: { id: returned.user.id },
            data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
          });
        }
      }
    }),
  },

  plugins: [admin(), twoFactor(), bearer()],
};

/**
 * The Better Auth instance — mount this in the route handler
 * (app/api/auth/[...all]/route.ts) and nowhere else. Everything that needs
 * "the current session" imports `auth` (the function below) instead; that's
 * the call shape @repo/rbac already depends on.
 *
 * Explicitly typed with the library's own portable `Auth`/`BetterAuthOptions`
 * names (not inferred) — betterAuth()'s inferred return type embeds an
 * internal Zod symbol TypeScript can't name across this module boundary
 * (verbatimModuleSyntax/isolatedModules), so a bare
 * `export const authInstance = betterAuth(...)` fails to typecheck.
 */
export const authInstance: Auth = betterAuth(authOptions);

// ─────────────────────────────────────────────────────────────
// Session helper — the exact call shape @repo/rbac already depends on:
// `const { auth } = await import("@repo/auth"); const session = await auth();`
// (Module 03's interim stub, plan.md's Module 04 implementation prompt).
// ─────────────────────────────────────────────────────────────

export interface Session {
  // The user object carries every additionalField at runtime (Better
  // Auth's own behavior); typed here beyond `id` because the admin layout's
  // STAFF re-check (ADR-006) needs userType, and every other consumer only
  // reads `.user.id` — a strictly additive extension of @repo/rbac's
  // original call shape, not a breaking one.
  user: { id: string; userType: "LEARNER" | "STAFF" };
}

/**
 * Admin-initiated password replacement (changes-01 / Module 10, guarded at
 * the call site by `users.password.reset`). Uses Better Auth's own context
 * so the hash goes through the SAME Argon2id path sign-in verifies against
 * — NOT the admin plugin's api.setUserPassword, which would demand Better
 * Auth's own `user.role === "admin"` (a field this repo's RBAC deliberately
 * doesn't use). Session revocation and auditing stay with the caller
 * (@repo/core) — this only replaces the credential.
 */
export async function setUserPassword(userId: string, newPassword: string): Promise<void> {
  const ctx = await authInstance.$context;
  const hashed = await ctx.password.hash(newPassword);
  await ctx.internalAdapter.updatePassword(userId, hashed);
}

/**
 * Self-service password change for the signed-in user — Better Auth's own
 * endpoint logic (current-password verification included), invoked
 * server-side with the request's headers. Revokes other sessions so a
 * stolen session dies with the old password.
 * Throws Better Auth's APIError on a wrong current password.
 */
export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await authInstance.api.changePassword({
    headers: await headers(),
    body: {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      revokeOtherSessions: true,
    },
  });
}

export async function auth(): Promise<Session | null> {
  // disableCookieCache is load-bearing, not an optimization toggle — found
  // the hard way, not from docs: with session.cookieCache enabled (needed
  // for proxy.ts's fast gate), getSession serves the signed cookie's
  // snapshot by default, server-side calls included. A user demoted from
  // STAFF, or a revoked session, would still pass every check that reads
  // this without the flag for up to cookieCache.maxAge — silently
  // defeating ADR-006's "the layout re-verifies against the database, the
  // proxy is only a gate" guarantee. Better Auth's own source documents
  // disableCookieCache for exactly this: "a revoked-but-cached session
  // cannot authorize a sensitive action." Every consumer of `auth()`
  // (this module's own session.create.before/hooks.after, @repo/rbac's
  // requirePermission, the admin layout) is a sensitive check by
  // definition, so this is not optional here — only proxy.ts's
  // getCookieCache (a deliberately fast, non-authoritative gate) is meant
  // to read the cache.
  const result = await authInstance.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  return result as Session | null;
}
