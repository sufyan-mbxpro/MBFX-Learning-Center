// The AI provider key's seal (ADR-098 — security.md #10's THIRD exception).
//
// The primitive lives in `@repo/secrets`; what stays here is this package's
// half of it, in `packages/email/src/secret.ts`'s shape: which env var seals AI
// credentials, and the error types callers catch by name. The providers screen
// shows a "set AI_SECRET_KEY" warning on `AiSecretKeyMissingError`, so the
// shared primitive's errors are translated at the boundary rather than leaking
// a type nobody here declared.
//
// Why a third seal rather than env: an AI key is the one credential an
// organisation rotates on a BILLING event — a leak, a spend spike, a provider
// switch mid-month — and a rotation that needs a redeploy will not happen at
// 2am when the spend alert fires. `AI_SECRET_KEY` itself stays in env, exactly
// as `EMAIL_SECRET_KEY` and `MARKET_SECRET_KEY` do.
import {
  SecretInvalidError,
  SecretKeyMissingError,
  generateSecretKey,
  hasSecretKey,
  openSecret as openSealed,
  sealSecret as sealPlain,
} from "@repo/secrets";

export const AI_SECRET_KEY_ENV = "AI_SECRET_KEY";

/** The key is absent or unusable — a configuration fault, not a bad value. */
export class AiSecretKeyMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiSecretKeyMissingError";
  }
}

/** The sealed value is malformed, truncated, tampered with, or not ours. */
export class AiSecretInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiSecretInvalidError";
  }
}

function translate(error: unknown): never {
  if (error instanceof SecretKeyMissingError) throw new AiSecretKeyMissingError(error.message);
  if (error instanceof SecretInvalidError) throw new AiSecretInvalidError(error.message);
  throw error;
}

/** Whether credentials can be read or written at all — the admin warning. */
export function hasAiSecretKey(): boolean {
  return hasSecretKey(AI_SECRET_KEY_ENV);
}

/** A fresh key, for `.env`. Base64 of 32 random bytes. */
export function generateAiSecretKey(): string {
  return generateSecretKey();
}

export function sealAiSecret(plain: string): string {
  try {
    return sealPlain(plain, AI_SECRET_KEY_ENV);
  } catch (error) {
    translate(error);
  }
}

export function openAiSecret(sealed: string): string {
  try {
    return openSealed(sealed, AI_SECRET_KEY_ENV);
  } catch (error) {
    translate(error);
  }
}
