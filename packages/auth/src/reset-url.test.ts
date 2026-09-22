// ADR-079 #2 — the one rule that keeps ADR-052's line intact once a reset
// link exists. It is invisible in any type: both branches return a string.
import { describe, expect, it } from "vitest";
import { adminPortalBase, resetPasswordPath } from "./reset-url.ts";

const ORIGINS = { site: "https://mbx.example", admin: "https://admin.mbx.example" };

describe("resetPasswordPath", () => {
  it("sends staff to the staff screen at /keystone (ADR-146)", () => {
    expect(resetPasswordPath({ userType: "STAFF" }, "abc", ORIGINS)).toBe(
      "https://admin.mbx.example/keystone/reset-password?token=abc",
    );
  });

  it("never sends a learner anywhere near the portal", () => {
    const url = resetPasswordPath({ userType: "LEARNER" }, "abc", ORIGINS);
    expect(url).toBe("https://mbx.example/reset-password?token=abc");
    expect(url).not.toContain("/keystone");
  });

  it("treats an unknown or missing type as a learner", () => {
    // The safe default: a public link tells the recipient nothing about the
    // portal, while an admin link handed to a learner advertises it.
    for (const user of [{}, { userType: null }, { userType: "GUEST" }]) {
      expect(resetPasswordPath(user, "abc", ORIGINS)).not.toContain("/keystone");
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
      "https://admin.mbx.example/keystone/reset-password?token=abc",
    );
  });

  // REGRESSION (testing.md #2), found on the dev server in changes-21 F6: the
  // link in a real staff reset email was
  // `http://localhost:3000/admin/admin/reset-password`. This suite passed
  // throughout, because its fixture used a bare origin while the documented
  // value of NEXT_PUBLIC_ADMIN_URL already ends in `/admin`.
  describe("the admin base is normalised, whatever NEXT_PUBLIC_ADMIN_URL holds", () => {
    it.each([
      ["https://mbx.example/keystone", "the documented value, which already ends in /keystone"],
      ["https://mbx.example/keystone/", "the same with a trailing slash"],
      ["https://mbx.example/admin", "a value written before ADR-151, ending in the old prefix"],
      ["https://mbx.example", "the bare-origin fallback when the variable is unset"],
    ])("%s (%s) yields the /keystone screen on that origin", (admin) => {
      const url = resetPasswordPath({ userType: "STAFF" }, "abc", {
        site: "https://mbx.example",
        admin,
      });
      expect(url).toBe("https://mbx.example/keystone/reset-password?token=abc");
      expect(url).not.toContain("/keystone/keystone");
      expect(url).not.toContain("/admin");
    });

    it("never degrades a staff link into the LEARNER screen", () => {
      // The failure mode of the other possible fix: with the variable unset,
      // dropping the append would send staff to /reset-password.
      expect(adminPortalBase("https://mbx.example")).toBe("https://mbx.example/keystone");
    });
  });

  it("escapes the token rather than pasting it into the query", () => {
    expect(resetPasswordPath({}, "a b&c=d", ORIGINS)).toContain("token=a%20b%26c%3Dd");
  });
});
