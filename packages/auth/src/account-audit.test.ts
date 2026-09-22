import { describe, expect, it } from "vitest";
import { emailChangeFromToken, passwordChangedBy, twoFactorAuditAction } from "./account-audit.ts";

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

describe("emailChangeFromToken (ADR-155 #2)", () => {
  const token = (claims: Record<string, unknown>) =>
    `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;

  it("reads the old and new address from the final step of a change", () => {
    const query = {
      token: token({
        email: "old@example.com",
        updateTo: "new@example.com",
        requestType: "change-email-verification",
      }),
    };
    expect(emailChangeFromToken("/verify-email", query)).toEqual({
      from: "old@example.com",
      to: "new@example.com",
    });
  });

  it("ignores a plain verification, the confirmation step, and other paths", () => {
    expect(emailChangeFromToken("/verify-email", { token: token({ email: "a@b.co" }) })).toBeNull();
    expect(
      emailChangeFromToken("/verify-email", {
        token: token({
          email: "a@b.co",
          updateTo: "c@d.co",
          requestType: "change-email-confirmation",
        }),
      }),
    ).toBeNull();
    expect(
      emailChangeFromToken("/change-email", {
        token: token({ email: "a", updateTo: "b", requestType: "change-email-verification" }),
      }),
    ).toBeNull();
  });

  it("survives a missing or malformed token", () => {
    expect(emailChangeFromToken("/verify-email", undefined)).toBeNull();
    expect(emailChangeFromToken("/verify-email", { token: "not-a-jwt" })).toBeNull();
    expect(emailChangeFromToken("/verify-email", { token: "a.%%%.c" })).toBeNull();
  });
});
