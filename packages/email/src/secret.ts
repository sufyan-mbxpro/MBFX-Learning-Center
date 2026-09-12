// The SMTP password's seal (ADR-078 #3 — security.md #10's FIRST exception).
//
// The primitive moved to `@repo/secrets` in ADR-087 #6, when the market
// provider key became the second sealed secret and a second copy of an
// AES-256-GCM seal became the wrong thing to own. What stays here is this
// package's half of it: which env var seals SMTP credentials, and the error
// types callers already catch by name.
//
// `secret.test.ts` is unchanged by that move, and passing untouched is the
// proof the extraction is behaviour-preserving.
import {
  SecretInvalidError,
  SecretKeyMissingError,
  generateSecretKey,
  hasSecretKey,
  openSecret as openSealed,
  sealSecret as sealPlain,
} from "@repo/secrets";

export const EMAIL_SECRET_KEY_ENV = "EMAIL_SECRET_KEY";

/** The key is absent or unusable — a configuration fault, not a bad value. */
export class EmailSecretKeyMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailSecretKeyMissingError";
  }
}

/** The sealed value is malformed, truncated, tampered with, or not ours. */
export class EmailSecretInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailSecretInvalidError";
  }
}

/**
 * Re-throw a `@repo/secrets` failure as this package's own error type.
 *
 * Callers catch `EmailSecretKeyMissingError` by name — the admin screen shows
 * a "set EMAIL_SECRET_KEY" warning on it — so the shared primitive's errors
 * are translated at the boundary rather than leaking a type nobody here
 * declared.
 */
function translate(error: unknown): never {
  if (error instanceof SecretKeyMissingError) throw new EmailSecretKeyMissingError(error.message);
  if (error instanceof SecretInvalidError) throw new EmailSecretInvalidError(error.message);
  throw error;
}

/** Whether credentials can be read or written at all — the admin warning. */
export function hasEmailSecretKey(): boolean {
  return hasSecretKey(EMAIL_SECRET_KEY_ENV);
}

/** A fresh key, for `.env`. Base64 of 32 random bytes. */
export function generateEmailSecretKey(): string {
  return generateSecretKey();
}

export function sealSecret(plain: string): string {
  try {
    return sealPlain(plain, EMAIL_SECRET_KEY_ENV);
  } catch (error) {
    translate(error);
  }
}

export function openSecret(sealed: string): string {
  try {
    return openSealed(sealed, EMAIL_SECRET_KEY_ENV);
  } catch (error) {
    translate(error);
  }
}
