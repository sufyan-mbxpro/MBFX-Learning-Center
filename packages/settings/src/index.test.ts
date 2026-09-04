// Pure-function unit tests — no DB, no next/cache. The DB-backed reads,
// writes, and cache-tag behavior are covered by settings.integration.test.ts
// (testing.md: real MariaDB via Testcontainers, not mocked Prisma).
import { describe, expect, it } from "vitest";
import { SETTINGS_SCHEMAS, SETTING_GROUPS, type SettingKey } from "@repo/contracts";
import { evaluateVisibility, isFlagVisible, type FeatureFlagState } from "./index.ts";

describe("SETTING_GROUPS registry completeness", () => {
  it("has exactly one group entry per schema key — a key seeded without an entry here is a real gap (SKILL.md)", () => {
    const schemaKeys = Object.keys(SETTINGS_SCHEMAS).sort();
    const groupKeys = Object.keys(SETTING_GROUPS).sort();
    expect(groupKeys).toEqual(schemaKeys);
  });
});

describe("evaluateVisibility — flag matrix truth table", () => {
  const staff = { userType: "STAFF" as const };
  const learner = { userType: "LEARNER" as const };

  it.each([
    ["PUBLIC", null, true],
    ["PUBLIC", learner, true],
    ["PUBLIC", staff, true],
    ["AUTHENTICATED", null, false],
    ["AUTHENTICATED", learner, true],
    ["AUTHENTICATED", staff, true],
    // ADR-012: PREMIUM has no entitlement model yet — conservative default
    // is staff-only, never granted to a plain learner session.
    ["PREMIUM", null, false],
    ["PREMIUM", learner, false],
    ["PREMIUM", staff, true],
    ["ADMIN", null, false],
    ["ADMIN", learner, false],
    ["ADMIN", staff, true],
  ] as const)("visibility=%s, subject=%s → %s", (visibility, subject, expected) => {
    expect(evaluateVisibility(visibility, subject)).toBe(expected);
  });
});

describe("isFlagVisible — enabled × visibility × subject", () => {
  const staff = { userType: "STAFF" as const };
  const publicFlag: FeatureFlagState = { key: "x", isEnabled: true, visibility: "PUBLIC" };
  const disabledPublicFlag: FeatureFlagState = { key: "x", isEnabled: false, visibility: "PUBLIC" };

  it("a disabled flag is never visible, regardless of visibility or subject", () => {
    expect(isFlagVisible(disabledPublicFlag, staff)).toBe(false);
    expect(isFlagVisible(disabledPublicFlag, null)).toBe(false);
  });

  it("an enabled PUBLIC flag is visible to everyone", () => {
    expect(isFlagVisible(publicFlag, null)).toBe(true);
    expect(isFlagVisible(publicFlag, staff)).toBe(true);
  });
});

describe("settings.ts registry — validates against declared type", () => {
  it("rejects a number where a BOOLEAN setting is declared (the literal case SKILL.md names)", () => {
    const key: SettingKey = "header.sticky";
    expect(() => SETTINGS_SCHEMAS[key].parse(42)).toThrow();
  });

  it("rejects a malformed email for site.contactEmail", () => {
    expect(() => SETTINGS_SCHEMAS["site.contactEmail"].parse("not-an-email")).toThrow();
  });

  it("accepts the exact shape seeded for header.cta", () => {
    const value = { enabled: false, label: "Get Started", url: "/sign-up" };
    expect(SETTINGS_SCHEMAS["header.cta"].parse(value)).toEqual(value);
  });
});
