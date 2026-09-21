import { describe, expect, it } from "vitest";
import { passwordChangedBy, twoFactorAuditAction } from "./account-audit.ts";

describe("twoFactorAuditAction (ADR-123 #5)", () => {
  it("audits the first confirmed code as an enable", () => {
    expect(twoFactorAuditAction("/two-factor/verify-totp", true)).toBe("users.twoFactorEnable");
  });

  it("audits a disable", () => {
    expect(twoFactorAuditAction("/two-factor/disable", false)).toBe("users.twoFactorDisable");
  });

  it("ignores every other write to the user row", () => {
    expect(twoFactorAuditAction("/update-user", true)).toBeNull();
    expect(twoFactorAuditAction(undefined, true)).toBeNull();
    // A value that does not match its endpoint's direction is not that change.
    expect(twoFactorAuditAction("/two-factor/verify-totp", false)).toBeNull();
    expect(twoFactorAuditAction("/two-factor/disable", true)).toBeNull();
  });
});

describe("passwordChangedBy (ADR-123 #5)", () => {
  const ok = { user: { id: "u1" } };

  it("returns the user for a successful HTTP change", () => {
    expect(passwordChangedBy({ path: "/change-password", request: {}, returned: ok })).toBe("u1");
  });

  it("ignores the staff profile's server-side API call, which audits itself", () => {
    expect(passwordChangedBy({ path: "/change-password", returned: ok })).toBeNull();
  });

  it("ignores a failure and every other path", () => {
    expect(
      passwordChangedBy({ path: "/change-password", request: {}, returned: { status: 400 } }),
    ).toBeNull();
    expect(passwordChangedBy({ path: "/sign-in/email", request: {}, returned: ok })).toBeNull();
  });
});
