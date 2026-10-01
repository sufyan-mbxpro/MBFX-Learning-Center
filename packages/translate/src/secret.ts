// The Google Cloud Translation key's seal (ADR-160 — security.md #10's FIFTH
// exception).
//
// The primitive lives in `@repo/secrets`; what stays here is which env var
// seals this package's credential. `TRANSLATE_SECRET_KEY` itself stays in env,
// exactly as `AI_SECRET_KEY` and `MARKET_SECRET_KEY` do. The errors are
// translated at the boundary into a `TranslateError` with the
// `seal_unavailable` reason, which is what the settings screen reports.
import { hasSecretKey, openSecret, sealSecret } from "@repo/secrets";

import { TranslateError } from "./errors.ts";

export const TRANSLATE_SECRET_KEY_ENV = "TRANSLATE_SECRET_KEY";

/** Whether a key can be sealed or opened at all — the settings warning. */
export function hasTranslateSecretKey(): boolean {
  return hasSecretKey(TRANSLATE_SECRET_KEY_ENV);
}

export function sealTranslateKey(plain: string): string {
  try {
    return sealSecret(plain, TRANSLATE_SECRET_KEY_ENV);
  } catch (error) {
    throw new TranslateError("seal_unavailable", (error as Error).message);
  }
}

export function openTranslateKey(sealed: string): string {
  try {
    return openSecret(sealed, TRANSLATE_SECRET_KEY_ENV);
  } catch (error) {
    throw new TranslateError("seal_unavailable", (error as Error).message);
  }
}
