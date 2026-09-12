// @repo/secrets — the one AES-256-GCM seal both sealed-secret owners use
// (ADR-087 #6).
//
// security.md #10 says secrets live in environment variables. There are
// exactly two exceptions, and both are here rather than in either package
// that has one:
//
//   - ADR-078: the SMTP password, under EMAIL_SECRET_KEY;
//   - ADR-087: the market data provider key, under MARKET_SECRET_KEY.
//
// This package has NO dependencies. It sits at the bottom of the graph for the
// reason `@repo/email` sits below its senders (architecture.md #8): two
// packages need it, so neither may own it. Duplicating a crypto primitive was
// the other option, and two copies of a seal drift in the copy nobody reads.
//
// What a database row holds is useless without the env key; the seal is
// authenticated, so a tampered row fails to open rather than decrypting to
// garbage; and the `v1:` prefix is what makes key rotation a version bump
// instead of a migration.
import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

/** The key is absent or unusable — a configuration fault, not a bad value. */
export class SecretKeyMissingError extends Error {
  /** Which env var was being read, so the message can name it. */
  readonly envVar: string;

  constructor(envVar: string, message: string) {
    super(message);
    this.name = "SecretKeyMissingError";
    this.envVar = envVar;
  }
}

/** The sealed value is malformed, truncated, tampered with, or not ours. */
export class SecretInvalidError extends Error {
  readonly envVar: string;

  constructor(envVar: string, message: string) {
    super(message);
    this.name = "SecretInvalidError";
    this.envVar = envVar;
  }
}

function readKey(envVar: string): Buffer {
  const raw = process.env[envVar];
  if (!raw) {
    throw new SecretKeyMissingError(
      envVar,
      `${envVar} is not set. Sealed credentials cannot be read or written without it.`,
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    // Deliberately no padding or derivation fallback: a short key would
    // silently weaken every seal written after it.
    throw new SecretKeyMissingError(
      envVar,
      `${envVar} must be ${KEY_BYTES} bytes, base64-encoded (decoded ${key.length}).`,
    );
  }
  return key;
}

/** Whether credentials can be read or written at all — the admin warning. */
export function hasSecretKey(envVar: string): boolean {
  try {
    readKey(envVar);
    return true;
  } catch {
    return false;
  }
}

/** A fresh key, for `.env`. Base64 of 32 random bytes. */
export function generateSecretKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

/** Seal `plain` under the key in `envVar`. */
export function sealSecret(plain: string, envVar: string): string {
  const key = readKey(envVar);
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

/** Open a value sealed under the key in `envVar`. */
export function openSecret(sealed: string, envVar: string): string {
  const key = readKey(envVar);
  const parts = sealed.split(":");
  const [version, iv, tag, ciphertext] = parts;
  // `ciphertext` may legitimately be "": sealing an empty value is a round
  // trip like any other, so only the STRUCTURE is checked here.
  if (parts.length !== 4 || version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new SecretInvalidError(
      envVar,
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
    throw new SecretInvalidError(
      envVar,
      `The sealed value does not open with this ${envVar} — the key changed, or the row was tampered with.`,
    );
  }
}
