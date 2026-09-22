import { describe, expect, it } from "vitest";
import { staffTwoFactorPending } from "./two-factor.ts";

describe("staffTwoFactorPending (ADR-157)", () => {
  it("holds a staff member who has not enrolled, while it is required", () => {
    expect(staffTwoFactorPending({ userType: "STAFF", twoFactorEnabled: false }, true)).toBe(true);
    // The column is nullable; a row that predates the plugin is not enrolled.
    expect(staffTwoFactorPending({ userType: "STAFF", twoFactorEnabled: null }, true)).toBe(true);
  });

  it("lets an enrolled staff member through", () => {
    expect(staffTwoFactorPending({ userType: "STAFF", twoFactorEnabled: true }, true)).toBe(false);
  });

  it("holds nobody while it is not required", () => {
    expect(staffTwoFactorPending({ userType: "STAFF", twoFactorEnabled: false }, false)).toBe(
      false,
    );
  });

  it("never holds a learner, whose portal access is refused elsewhere", () => {
    expect(staffTwoFactorPending({ userType: "LEARNER", twoFactorEnabled: false }, true)).toBe(
      false,
    );
  });

  it("holds nobody for a missing user — the caller's own check refuses them", () => {
    expect(staffTwoFactorPending(null, true)).toBe(false);
  });
});
