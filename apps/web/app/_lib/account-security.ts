// Browser-side helpers for the learner profile page's security panel
// (ADR-123): change password, and turn two-factor on and off.
//
// Each POSTs to Better Auth's own handler for the reasons `credentials.ts`
// gives at its top, plus one more that is specific to these three: every one
// of them ROTATES the session — deletes the row the browser holds and sets a
// cookie for a new one. A server action calling `authInstance.api.*` writes
// the new row and never delivers its cookie, so the learner is signed out of
// the page they were changing their password on. Through the HTTP handler the
// cookie arrives with the response.
//
// Audit rows are written server-side by `@repo/auth`'s hooks
// (`account-audit.ts`), never from here: nothing a browser reports about
// itself is an audit record.

export type SecurityResult<T = undefined> =
  | ({ status: "ok" } & (T extends undefined ? unknown : { value: T }))
  | { status: "wrongPassword" }
  | { status: "invalidCode" }
  | { status: "tooMany" }
  | { status: "failed" };

type Failure = Exclude<SecurityResult, { status: "ok" }>;

async function post(path: string, body: unknown): Promise<Response | null> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

/**
 * The failure a Better Auth error body names. Codes measured against the
 * running handler rather than read off a constant — the discipline
 * `signUpWithPassword` records.
 */
async function failureOf(response: Response | null): Promise<Failure> {
  if (!response) return { status: "failed" };
  if (response.status === 429) return { status: "tooMany" };
  const body = (await response.json().catch(() => null)) as { code?: string } | null;
  if (body?.code === "INVALID_PASSWORD") return { status: "wrongPassword" };
  if (body?.code === "INVALID_CODE") return { status: "invalidCode" };
  if (body?.code === "ACCOUNT_TEMPORARILY_LOCKED") return { status: "tooMany" };
  return { status: "failed" };
}

/**
 * Change the signed-in learner's password. Other sessions are revoked — a
 * stolen session dies with the old password — and THIS one is replaced by the
 * cookie on the response.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<SecurityResult> {
  const response = await post("/api/auth/change-password", {
    currentPassword,
    newPassword,
    revokeOtherSessions: true,
  });
  return response?.ok ? { status: "ok" } : failureOf(response);
}

export interface TwoFactorEnrolment {
  /** `otpauth://totp/…` — what the QR code encodes. */
  totpURI: string;
  /** The base32 secret, for a reader typing it in instead of scanning. */
  secret: string;
  backupCodes: string[];
}

/** The `secret` parameter of an otpauth URI, or "" when it has none. */
export function secretFromTotpUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

/**
 * Step one of enabling: re-confirm the password and receive a secret. Nothing
 * is enforced yet — `twoFactorEnabled` stays false until `confirmTwoFactor`
 * proves the authenticator app holds the same secret, so abandoning here
 * leaves sign-in exactly as it was.
 *
 * `issuer` is the site's own name, so the authenticator app lists this account
 * under it rather than under the library's default.
 */
export async function enableTwoFactor(
  password: string,
  issuer: string,
): Promise<SecurityResult<TwoFactorEnrolment>> {
  const response = await post("/api/auth/two-factor/enable", { password, issuer });
  if (!response?.ok) return failureOf(response);
  const body = (await response.json().catch(() => null)) as {
    totpURI?: string;
    backupCodes?: string[];
  } | null;
  if (!body?.totpURI) return { status: "failed" };
  return {
    status: "ok",
    value: {
      totpURI: body.totpURI,
      secret: secretFromTotpUri(body.totpURI),
      backupCodes: body.backupCodes ?? [],
    },
  };
}

/** Step two: the first code from the app. On success two-factor is on. */
export async function confirmTwoFactor(code: string): Promise<SecurityResult> {
  const response = await post("/api/auth/two-factor/verify-totp", { code });
  return response?.ok ? { status: "ok" } : failureOf(response);
}

export async function disableTwoFactor(password: string): Promise<SecurityResult> {
  const response = await post("/api/auth/two-factor/disable", { password });
  return response?.ok ? { status: "ok" } : failureOf(response);
}
