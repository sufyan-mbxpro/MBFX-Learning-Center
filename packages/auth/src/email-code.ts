// Email verification by code (changes-61, ADR-184) — the decisions, with no
// database and no Better Auth in them, so each is a unit test.

/** How long a verification code lives. The email says the same number. */
export const VERIFY_CODE_MINUTES = 10;

/**
 * The email-otp plugin's endpoints we do NOT use. Each would be a second way
 * past the password form, its lockout and its captcha (sign-in, reset), or a
 * second change-email flow beside ADR-155's, or an oracle for guessing codes
 * without spending them (`check-verification-otp`).
 */
export const DISABLED_EMAIL_OTP_PATHS = [
  "/sign-in/email-otp",
  "/email-otp/check-verification-otp",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
] as const;

/**
 * Code or link. A verification for the address the account already has is a
 * sign-up (or a resend) and gets a code; one for a DIFFERENT address is a
 * change of email, whose new address has no account for a code to verify, so
 * it keeps the link. No stored row (a race with a delete) is treated as the
 * code path, which then finds no user and sends nothing.
 */
export function verificationKind(storedEmail: string | null, targetEmail: string): "code" | "link" {
  if (storedEmail === null) return "code";
  return storedEmail.trim().toLowerCase() === targetEmail.trim().toLowerCase() ? "code" : "link";
}

/**
 * A request to the plugin's send endpoint for anything but verifying an
 * address. Its `sign-in` and `forget-password` types would mail a code that
 * no open endpoint accepts.
 */
export function isRefusedOtpRequest(path: string | undefined, body: unknown): boolean {
  if (path !== "/email-otp/send-verification-otp") return false;
  const type = (body as { type?: unknown } | null | undefined)?.type;
  return type !== "email-verification";
}
