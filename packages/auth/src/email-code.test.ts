import { describe, expect, it } from "vitest";
import { DISABLED_EMAIL_OTP_PATHS, isRefusedOtpRequest, verificationKind } from "./email-code.ts";

describe("verificationKind — code for a sign-up, link for a change of address (ADR-184)", () => {
  it("sends a code for the address the account already has", () => {
    expect(verificationKind("alex@example.com", "alex@example.com")).toBe("code");
  });

  it("ignores case and surrounding space when comparing", () => {
    expect(verificationKind("Alex@Example.com", " alex@example.com ")).toBe("code");
  });

  it("keeps the link for a NEW address, which has no account to verify", () => {
    expect(verificationKind("alex@example.com", "new@example.com")).toBe("link");
  });

  it("treats a missing row as the code path, which then sends nothing", () => {
    expect(verificationKind(null, "alex@example.com")).toBe("code");
  });
});

describe("isRefusedOtpRequest — the plugin verifies addresses and nothing else", () => {
  const path = "/email-otp/send-verification-otp";

  it("lets an email-verification request through", () => {
    expect(isRefusedOtpRequest(path, { email: "a@b.co", type: "email-verification" })).toBe(false);
  });

  it.each(["sign-in", "forget-password", "change-email", undefined])("refuses type %s", (type) => {
    expect(isRefusedOtpRequest(path, { email: "a@b.co", type })).toBe(true);
  });

  it("refuses a request with no body", () => {
    expect(isRefusedOtpRequest(path, undefined)).toBe(true);
  });

  it("does not look at any other path", () => {
    expect(isRefusedOtpRequest("/sign-in/email", { type: "sign-in" })).toBe(false);
  });
});

describe("DISABLED_EMAIL_OTP_PATHS", () => {
  it("closes every second door and leaves the two verification endpoints open", () => {
    expect(DISABLED_EMAIL_OTP_PATHS).toContain("/sign-in/email-otp");
    expect(DISABLED_EMAIL_OTP_PATHS).toContain("/email-otp/reset-password");
    expect(DISABLED_EMAIL_OTP_PATHS).toContain("/email-otp/change-email");
    expect(DISABLED_EMAIL_OTP_PATHS).not.toContain("/email-otp/send-verification-otp");
    expect(DISABLED_EMAIL_OTP_PATHS).not.toContain("/email-otp/verify-email");
  });
});
