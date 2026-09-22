// ADR-157 — staff two-factor: the wiring no unit test reaches.
//
// The rule (`staffTwoFactorPending`), the mutation refusal
// (`TwoFactorRequiredError`) and the admin reset (`resetUserTwoFactor`) are
// tested where they live. What is left is composition: the layout must ask
// BEFORE it renders the portal, the staff form must take the code step rather
// than refuse a challenge, and the two seeds must disagree in the stated
// direction. Each of these was the bug at some point (the staff form DID
// refuse every challenge until this change), and each is an absence a reader
// does not notice. Read as source, like `admin-dialog-conventions.test.ts`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("staff two-factor (ADR-157)", () => {
  it("the admin layout asks before it renders the portal, and swaps the shell for the enrolment screen", () => {
    const layout = read("app/(admin)/layout.tsx");
    const asked = layout.indexOf("isStaffTwoFactorPending(");
    expect(asked).toBeGreaterThan(-1);
    // After the STAFF re-check, which must still come first (security.md #3).
    expect(asked).toBeGreaterThan(layout.indexOf('notFound();'));
    expect(layout).toMatch(/twoFactorPending \?\s*\(\s*<TwoFactorRequiredScreen/);
  });

  it("the staff sign-in form takes a two-factor challenge as a step, not a failure", () => {
    const form = read("app/(admin-auth)/keystone/admin-sign-in-form.tsx");
    expect(form).toContain('result.status === "twoFactor"');
    expect(form).toContain("verifyTwoFactorSignIn(");
    // Room for a backup code, which a 6-digit field would cut short.
    expect(form).toContain("maxLength={TWO_FACTOR_CODE_MAX_LENGTH}");
  });

  it("the learner sign-in form leaves room for a backup code too", () => {
    const form = read("app/(public)/[locale]/sign-in/sign-in-form.tsx");
    expect(form).toContain("maxLength={TWO_FACTOR_CODE_MAX_LENGTH}");
    expect(form).not.toContain("maxLength={7}");
  });

  it("staff enrol from their profile", () => {
    expect(read("app/(admin)/keystone/profile/page.tsx")).toContain("<TwoFactorSection");
  });

  it("is off in the development seed and on in the live defaults", () => {
    const seed = read("../../packages/db/prisma/seed.ts");
    expect(seed).toMatch(/"security\.requireStaffTwoFactor",\s*false,\s*"BOOLEAN"/);
    const live = JSON.parse(read("../../packages/core/seed-live/defaults.json")) as {
      settings: Record<string, unknown>;
    };
    expect(live.settings["security.requireStaffTwoFactor"]).toBe(true);
  });
});
