// The one sanctioned database secret (ADR-078 #3 — security.md #10's single
// exception).
//
// The SMTP password is sealed with AES-256-GCM under EMAIL_SECRET_KEY, which
// stays in the environment like every other secret. What the database holds is
// useless without that key; the seal is authenticated, so a tampered row fails
// to open rather than decrypting to garbage; and the `v1:` prefix is what
// makes key rotation a version bump instead of a migration.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

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

function readKey(): Buffer {
  const raw = process.env[EMAIL_SECRET_KEY_ENV];
  if (!raw) {
    throw new EmailSecretKeyMissingError(
      `${EMAIL_SECRET_KEY_ENV} is not set. SMTP credentials cannot be read or written without it.`,
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    // Deliberately no padding or derivation fallback: a short key would
    // silently weaken every seal written after it.
    throw new EmailSecretKeyMissingError(
      `${EMAIL_SECRET_KEY_ENV} must be ${KEY_BYTES} bytes, base64-encoded (decoded ${key.length}).`,
    );
  }
  return key;
}

/** Whether credentials can be read or written at all — the admin warning. */
export function hasEmailSecretKey(): boolean {
  try {
    readKey();
    return true;
  } catch {
    return false;
  }
}

/** A fresh key, for `.env`. Base64 of 32 random bytes. */
export function generateEmailSecretKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

export function sealSecret(plain: string): string {
  const key = readKey();
  // A fresh IV per seal: reusing one under the same key is what breaks GCM.
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function openSecret(sealed: string): string {
  const key = readKey();
  const parts = sealed.split(":");
  const [version, iv, tag, ciphertext] = parts;
  // `ciphertext` may legitimately be "": sealing an empty value is a round
  // trip like any other, so only the STRUCTURE is checked here.
  if (parts.length !== 4 || version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new EmailSecretInvalidError(
      `Sealed value is not in ${VERSION}:<iv>:<tag>:<ciphertext> form.`,
    );
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // One message for every failure mode: a wrong key and a tampered row are
    // the same event to a caller, and distinguishing them tells an attacker
    // which half they got right.
    throw new EmailSecretInvalidError(
      `The sealed value does not open with this ${EMAIL_SECRET_KEY_ENV} — the key changed, or the row was tampered with.`,
    );
  }
}
