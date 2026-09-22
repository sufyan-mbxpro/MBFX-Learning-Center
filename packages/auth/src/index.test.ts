import { describe, expect, it } from "vitest";
import { ADMIN_SESSION_TIMEOUTS, adminSessionTimeoutMs } from "@repo/contracts";
import {
  authInstance,
  auth,
  clampStaffRefresh,
  nextStaffExpiry,
  sessionTimeoutSettingKey,
  staffSlideThresholdMs,
} from "./index.ts";

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

  // ── changes-49: one idle timeout per user type ──────────────
  it("picks the idle-timeout setting by userType, never by role", () => {
    expect(sessionTimeoutSettingKey("STAFF")).toBe("security.adminSessionTimeout");
    expect(sessionTimeoutSettingKey("LEARNER")).toBe("security.learnerSessionTimeout");
    expect(sessionTimeoutSettingKey(undefined)).toBeNull();
    expect(sessionTimeoutSettingKey("admin")).toBeNull();
  });

  it("brings rate limits to sign-in and sign-up, and trusts the header nginx sets", () => {
    const rules = authInstance.options.rateLimit?.customRules ?? {};
    expect(rules["/sign-in/email"]).toEqual({ window: 300, max: 10 });
    expect(rules["/sign-up/email"]).toEqual({ window: 3600, max: 5 });
    expect(authInstance.options.advanced?.ipAddress?.ipAddressHeaders?.[0]).toBe("x-real-ip");
  });

  // ── ADR-105: the staff idle timeout ─────────────────────────
  describe("nextStaffExpiry", () => {
    const NOW = Date.UTC(2026, 8, 15, 12, 0, 0);
    const FIFTEEN_MINUTES = 15 * 60_000;

    it("writes nothing when no timeout is configured", () => {
      // Including for a session a previous setting already shortened —
      // turning the timeout OFF stops shortening; it never extends.
      const soon = new Date(NOW + 60_000);
      expect(nextStaffExpiry(soon, null, NOW)).toBeNull();
    });

    it("shortens a session whose expiry is further out than the timeout", () => {
      // The 7-day default, on a staff member's first authenticated call.
      const sevenDays = new Date(NOW + 7 * 24 * 60 * 60_000);
      expect(nextStaffExpiry(sevenDays, FIFTEEN_MINUTES, NOW)).toEqual(
        new Date(NOW + FIFTEEN_MINUTES),
      );
    });

    it("shortens again when the setting is lowered under an existing session", () => {
      const onTheOldValue = new Date(NOW + 2 * 60 * 60_000);
      expect(nextStaffExpiry(onTheOldValue, FIFTEEN_MINUTES, NOW)).toEqual(
        new Date(NOW + FIFTEEN_MINUTES),
      );
    });

    it("slides a decayed expiry forward", () => {
      // Five minutes of use since the last write.
      const decayed = new Date(NOW + FIFTEEN_MINUTES - 5 * 60_000);
      expect(nextStaffExpiry(decayed, FIFTEEN_MINUTES, NOW)).toEqual(
        new Date(NOW + FIFTEEN_MINUTES),
      );
    });

    it("writes nothing while the stored expiry is within the slide threshold", () => {
      // The throttle: continuous use costs at most one UPDATE a minute.
      const justWritten = new Date(NOW + FIFTEEN_MINUTES - 59_000);
      expect(nextStaffExpiry(justWritten, FIFTEEN_MINUTES, NOW)).toBeNull();
      expect(nextStaffExpiry(new Date(NOW + FIFTEEN_MINUTES), FIFTEEN_MINUTES, NOW)).toBeNull();
    });

    it("slides a two-minute session after 30 seconds, not a full minute (ADR-128)", () => {
      const TWO_MINUTES = 2 * 60_000;
      expect(staffSlideThresholdMs(TWO_MINUTES)).toBe(30_000);
      expect(staffSlideThresholdMs(FIFTEEN_MINUTES)).toBe(60_000);
      expect(nextStaffExpiry(new Date(NOW + TWO_MINUTES - 29_000), TWO_MINUTES, NOW)).toBeNull();
      expect(nextStaffExpiry(new Date(NOW + TWO_MINUTES - 31_000), TWO_MINUTES, NOW)).toEqual(
        new Date(NOW + TWO_MINUTES),
      );
    });

    it("never returns an expiry in the past for any offered duration", () => {
      // A timeout that resolves to zero or less would sign a staff member out
      // the instant they signed in; the registry's own values are the guard.
      for (const value of ADMIN_SESSION_TIMEOUTS) {
        const ms = adminSessionTimeoutMs(value);
        if (ms === null) continue;
        const next = nextStaffExpiry(new Date(NOW + 7 * 24 * 60 * 60_000), ms, NOW);
        expect(next!.getTime()).toBeGreaterThan(NOW);
      }
    });
  });

  // changes-38: Better Auth's own refresh wrote now + 7 days over the timeout.
  describe("clampStaffRefresh", () => {
    const NOW = Date.UTC(2026, 8, 16, 12, 0, 0);
    const TWO_MINUTES = 2 * 60_000;
    const WEEK = new Date(NOW + 7 * 24 * 60 * 60_000);

    it("lets the refresh through when no timeout is configured", () => {
      expect(clampStaffRefresh(WEEK, null, NOW)).toBeNull();
    });

    it("pulls a week-long refresh back to now + timeout", () => {
      expect(clampStaffRefresh(WEEK, TWO_MINUTES, NOW)).toEqual(new Date(NOW + TWO_MINUTES));
    });

    it("leaves an expiry already inside the timeout alone", () => {
      expect(clampStaffRefresh(new Date(NOW + 60_000), TWO_MINUTES, NOW)).toBeNull();
    });
  });
});
