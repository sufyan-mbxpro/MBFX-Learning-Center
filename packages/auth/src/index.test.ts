import { describe, expect, it } from "vitest";
import { authInstance, auth } from "./index.ts";

describe("@repo/auth", () => {
  it("constructs a Better Auth instance with the expected API surface", () => {
    // authInstance construction alone (no request context needed) is
    // enough to catch a config-shape mistake — a bad plugin/adapter/schema
    // combination throws here, before any request ever reaches it.
    expect(authInstance.api.signUpEmail).toBeTypeOf("function");
    expect(authInstance.api.signInEmail).toBeTypeOf("function");
    expect(authInstance.api.getSession).toBeTypeOf("function");
    expect(authInstance.api.revokeSession).toBeTypeOf("function");
  });

  it("exports auth() as the call shape @repo/rbac depends on", () => {
    // Can't actually call it here — it calls next/headers()'s headers(),
    // which requires a real Next.js request/render context and throws
    // under plain Vitest (ADR-004's same shape for cacheTag()/cache()).
    // packages/auth/src/auth.integration.test.ts exercises the exact
    // mechanism auth() uses (authInstance.api.getSession with
    // disableCookieCache) against a real database instead.
    expect(auth).toBeTypeOf("function");
  });

  it("resolves the reset-password token lifetime to 30 minutes, not Better Auth's 1-hour default (plan.md)", () => {
    expect(authInstance.options.emailAndPassword?.resetPasswordTokenExpiresIn).toBe(30 * 60);
  });
});
