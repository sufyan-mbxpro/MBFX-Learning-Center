// ADR-079 #2 — the one rule that keeps ADR-052's line intact once a reset
// link exists. It is invisible in any type: both branches return a string.
import { describe, expect, it } from "vitest";
import { resetPasswordPath } from "./reset-url.ts";

const ORIGINS = { site: "https://mbx.example", admin: "https://admin.mbx.example" };

describe("resetPasswordPath", () => {
  it("sends staff to the admin screen", () => {
    expect(resetPasswordPath({ userType: "STAFF" }, "abc", ORIGINS)).toBe(
      "https://admin.mbx.example/admin/reset-password?token=abc",
    );
  });

  it("never sends a learner anywhere near /admin", () => {
    const url = resetPasswordPath({ userType: "LEARNER" }, "abc", ORIGINS);
    expect(url).toBe("https://mbx.example/reset-password?token=abc");
    expect(url).not.toContain("/admin");
  });

  it("treats an unknown or missing type as a learner", () => {
    // The safe default: a public link tells the recipient nothing about the
    // portal, while an admin link handed to a learner advertises it.
    for (const user of [{}, { userType: null }, { userType: "GUEST" }]) {
      expect(resetPasswordPath(user, "abc", ORIGINS)).not.toContain("/admin");
    }
  });

  it("prefixes a non-default locale and leaves the default bare", () => {
    expect(resetPasswordPath({ locale: "ar" }, "abc", ORIGINS)).toBe(
      "https://mbx.example/ar/reset-password?token=abc",
    );
    expect(resetPasswordPath({ locale: "en" }, "abc", ORIGINS)).toBe(
      "https://mbx.example/reset-password?token=abc",
    );
  });

  it("ignores the locale for staff, whose portal is English (ADR-043 #2)", () => {
    expect(resetPasswordPath({ userType: "STAFF", locale: "ar" }, "abc", ORIGINS)).toBe(
      "https://admin.mbx.example/admin/reset-password?token=abc",
    );
  });

  it("escapes the token rather than pasting it into the query", () => {
    expect(resetPasswordPath({}, "a b&c=d", ORIGINS)).toContain("token=a%20b%26c%3Dd");
  });
});
