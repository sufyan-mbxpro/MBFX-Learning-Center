import { describe, expect, it } from "vitest";
import { ADMIN_SESSION_TIMEOUTS, adminSessionTimeoutMs } from "@repo/contracts";
import { staffSlideThresholdMs } from "@repo/auth";
import {
  ACTIVITY_PING_MS,
  deadlineFrom,
  extendedPastWarning,
  idleWarningMs,
  warningDelayMs,
} from "./idle-timing.ts";

// ADR-128: the admin's idle watcher follows the server's expiry.
describe("idle timing", () => {
  const NOW = Date.UTC(2026, 8, 17, 12, 0, 0);
  const offered = ADMIN_SESSION_TIMEOUTS.map(adminSessionTimeoutMs).filter(
    (ms): ms is number => ms !== null,
  );

  it("warns for a minute, or a quarter of a short timeout", () => {
    expect(idleWarningMs(2 * 60_000)).toBe(30_000);
    expect(idleWarningMs(5 * 60_000)).toBe(60_000);
    expect(idleWarningMs(120 * 60_000)).toBe(60_000);
  });

  it("never opens the warning on someone who is working, for any offered duration", () => {
    // The worst case while active: the last ping was ACTIVITY_PING_MS ago and
    // the server declined to slide because the stored expiry was within its
    // threshold. What is left must still be outside the warning window.
    for (const timeoutMs of offered) {
      const worstRemaining = timeoutMs - staffSlideThresholdMs(timeoutMs) - ACTIVITY_PING_MS;
      expect(worstRemaining).toBeGreaterThan(idleWarningMs(timeoutMs));
    }
  });

  it("measures the deadline on the local clock from a relative answer", () => {
    expect(deadlineFrom({ remainingMs: 90_000, timeoutMs: 120_000 }, NOW)).toBe(NOW + 90_000);
    expect(deadlineFrom({ remainingMs: -5, timeoutMs: 120_000 }, NOW)).toBe(NOW);
  });

  it("schedules the warning ahead of the deadline, never in the past", () => {
    expect(warningDelayMs(NOW + 120_000, 120_000, NOW)).toBe(90_000);
    expect(warningDelayMs(NOW + 10_000, 120_000, NOW)).toBe(0);
  });

  it("follows a session another tab kept alive", () => {
    expect(extendedPastWarning({ remainingMs: 110_000, timeoutMs: 120_000 }, 120_000)).toBe(true);
    expect(extendedPastWarning({ remainingMs: 30_500, timeoutMs: 120_000 }, 120_000)).toBe(false);
  });
});
