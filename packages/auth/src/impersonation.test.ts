// ADR-142 §3 — "Login as user". The rules that make impersonation safe are
// small and easy to lose in a refactor, so each is pinned here where it lives.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authInstance } from "./index.ts";
import { canBeImpersonated, IMPERSONATION_SESSION_SECONDS } from "./impersonation.ts";

const source = (file: string) => readFileSync(resolve(__dirname, file), "utf8");

describe("canBeImpersonated", () => {
  const live = { userType: "LEARNER", deletedAt: null, status: "ACTIVE" };

  it("allows a live learner", () => {
    expect(canBeImpersonated(live)).toBe(true);
    expect(canBeImpersonated({ ...live, status: "PENDING_VERIFICATION" })).toBe(true);
  });

  it("never allows a STAFF account — that is escalation, not support", () => {
    expect(canBeImpersonated({ ...live, userType: "STAFF" })).toBe(false);
  });

  it("refuses a suspended or soft-deleted learner", () => {
    expect(canBeImpersonated({ ...live, status: "SUSPENDED" })).toBe(false);
    expect(canBeImpersonated({ ...live, deletedAt: new Date() })).toBe(false);
  });
});

describe("the impersonation doors", () => {
  const plugin = source("impersonation.ts");

  it("start has no HTTP route: SERVER_ONLY, so only the permission-checked action reaches it", () => {
    const start = plugin.slice(
      plugin.indexOf('"/staff-impersonation/start"'),
      plugin.indexOf('"/staff-impersonation/stop"'),
    );
    expect(start).toContain("metadata: { SERVER_ONLY: true }");
    expect(start).toContain("!canBeImpersonated(target)");
    expect(start).toContain('userType !== "STAFF"');
  });

  it("stop deletes the learner session and writes the stop audit row", () => {
    const stop = plugin.slice(plugin.indexOf('"/staff-impersonation/stop"'));
    expect(stop).toContain("deleteSession(current.session.token)");
    expect(stop).toContain('action: "users.impersonateStop"');
  });

  it("the admin plugin's own unaudited pair is switched off", () => {
    // The list grew with ADR-184's email-otp doors; these two must stay in it.
    const list = /disabledPaths: \[([\s\S]*?)\]/.exec(source("index.ts"))?.[1] ?? "";
    expect(list).toContain('"/admin/impersonate-user"');
    expect(list).toContain('"/admin/stop-impersonating"');
    expect(list).toContain("...DISABLED_EMAIL_OTP_PATHS");
  });

  it("an impersonation session lasts one hour", () => {
    expect(IMPERSONATION_SESSION_SECONDS).toBe(3600);
  });

  it("the plugin is registered on the instance", () => {
    expect(
      (authInstance.api as unknown as Record<string, unknown>).startStaffImpersonation,
    ).toBeTypeOf("function");
  });
});
