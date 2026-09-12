// ADR-087 #6. Every assertion here is a property the two sealed-secret rows
// depend on: that what a database row holds is useless without the env key,
// that a tampered row fails loudly, and that there is never a fallback to
// plaintext.
//
// The parameterised env var is the new part. The same primitive now seals two
// different secrets under two different keys, so the test that matters most is
// the one proving a value sealed under one key does NOT open under the other.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  SecretInvalidError,
  SecretKeyMissingError,
  generateSecretKey,
  hasSecretKey,
  openSecret,
  sealSecret,
} from "./index.ts";

const EMAIL_ENV = "EMAIL_SECRET_KEY";
const MARKET_ENV = "MARKET_SECRET_KEY";
const KEY = "3q2+796tvu/erb7v3q2+796tvu/erb7v3q2+796tvu8=";
const OTHER_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

beforeEach(() => {
  process.env[EMAIL_ENV] = KEY;
  process.env[MARKET_ENV] = OTHER_KEY;
});

afterEach(() => {
  delete process.env[EMAIL_ENV];
  delete process.env[MARKET_ENV];
});

describe("sealSecret / openSecret", () => {
  it("round-trips a value", () => {
    const sealed = sealSecret("hunter2", EMAIL_ENV);
    expect(openSecret(sealed, EMAIL_ENV)).toBe("hunter2");
  });

  it("round-trips an empty value", () => {
    // Sealing "" is a round trip like any other; only the STRUCTURE of the
    // sealed form is validated, so an empty ciphertext must survive it.
    const sealed = sealSecret("", EMAIL_ENV);
    expect(openSecret(sealed, EMAIL_ENV)).toBe("");
  });

  it("round-trips a value with multibyte characters and colons in it", () => {
    // Colons are the sealed form's own separator, so a plaintext full of them
    // is the case a naive split would corrupt.
    const plain = "pä:ss:wörd:🔐";
    expect(openSecret(sealSecret(plain, EMAIL_ENV), EMAIL_ENV)).toBe(plain);
  });

  it("never contains the plaintext", () => {
    expect(sealSecret("hunter2", EMAIL_ENV)).not.toContain("hunter2");
  });

  it("produces a different ciphertext each time — a fresh IV per seal", () => {
    // Reusing an IV under one key is what breaks GCM.
    expect(sealSecret("hunter2", EMAIL_ENV)).not.toBe(sealSecret("hunter2", EMAIL_ENV));
  });

  it("stamps the version prefix that makes rotation a version bump", () => {
    expect(sealSecret("hunter2", EMAIL_ENV).startsWith("v1:")).toBe(true);
  });
});

describe("the two keys are genuinely separate", () => {
  it("does not open an email-sealed value with the market key", () => {
    // The whole point of parameterising rather than sharing one key: an
    // attacker holding one env var gets one secret, not both.
    const sealed = sealSecret("smtp-password", EMAIL_ENV);
    expect(() => openSecret(sealed, MARKET_ENV)).toThrow(SecretInvalidError);
  });

  it("does not open a market-sealed value with the email key", () => {
    const sealed = sealSecret("av-api-key", MARKET_ENV);
    expect(() => openSecret(sealed, EMAIL_ENV)).toThrow(SecretInvalidError);
  });

  it("names the env var it was reading in the error", () => {
    const sealed = sealSecret("x", EMAIL_ENV);
    try {
      openSecret(sealed, MARKET_ENV);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SecretInvalidError);
      expect((error as SecretInvalidError).envVar).toBe(MARKET_ENV);
      expect((error as SecretInvalidError).message).toContain(MARKET_ENV);
    }
  });
});

describe("tampering and malformed input", () => {
  it("refuses a value whose ciphertext was altered", () => {
    // Authenticated encryption: a tampered row fails loudly instead of
    // decrypting to garbage that reaches a driver as a password.
    const sealed = sealSecret("hunter2", EMAIL_ENV);
    const parts = sealed.split(":");
    const bytes = Buffer.from(parts[3]!, "base64");
    bytes[0] = bytes[0]! ^ 0xff;
    parts[3] = bytes.toString("base64");
    expect(() => openSecret(parts.join(":"), EMAIL_ENV)).toThrow(SecretInvalidError);
  });

  it("refuses a value whose auth tag was altered", () => {
    const sealed = sealSecret("hunter2", EMAIL_ENV);
    const parts = sealed.split(":");
    const tag = Buffer.from(parts[2]!, "base64");
    tag[0] = tag[0]! ^ 0xff;
    parts[2] = tag.toString("base64");
    expect(() => openSecret(parts.join(":"), EMAIL_ENV)).toThrow(SecretInvalidError);
  });

  it.each([
    ["not sealed at all", "plaintext"],
    ["the wrong number of parts", "v1:abc:def"],
    ["an unknown version", "v2:abc:def:ghi"],
    ["an empty iv", "v1::def:ghi"],
  ])("refuses %s", (_label, value) => {
    expect(() => openSecret(value, EMAIL_ENV)).toThrow(SecretInvalidError);
  });

  it("says the same thing for a wrong key as for a tampered row", () => {
    // Distinguishing them tells an attacker which half they got right.
    const sealed = sealSecret("hunter2", EMAIL_ENV);
    let wrongKeyMessage = "";
    try {
      openSecret(sealed, MARKET_ENV);
    } catch (error) {
      wrongKeyMessage = (error as Error).message;
    }
    const parts = sealed.split(":");
    const bytes = Buffer.from(parts[3]!, "base64");
    bytes[0] = bytes[0]! ^ 0xff;
    parts[3] = bytes.toString("base64");
    let tamperedMessage = "";
    try {
      openSecret(parts.join(":"), MARKET_ENV);
    } catch (error) {
      tamperedMessage = (error as Error).message;
    }
    expect(wrongKeyMessage).toBe(tamperedMessage);
  });
});

describe("the key itself", () => {
  it("refuses to seal when the key is absent — never falls back to plaintext", () => {
    delete process.env[EMAIL_ENV];
    expect(() => sealSecret("hunter2", EMAIL_ENV)).toThrow(SecretKeyMissingError);
    expect(() => openSecret("v1:a:b:c", EMAIL_ENV)).toThrow(SecretKeyMissingError);
  });

  it("refuses a key of the wrong length rather than padding it", () => {
    // A short key silently weakens every seal written after it.
    process.env[EMAIL_ENV] = Buffer.from("too short").toString("base64");
    expect(() => sealSecret("hunter2", EMAIL_ENV)).toThrow(SecretKeyMissingError);
  });

  it("names the env var and the expected length in the error", () => {
    process.env[EMAIL_ENV] = "c2hvcnQ=";
    try {
      sealSecret("x", EMAIL_ENV);
      expect.unreachable();
    } catch (error) {
      expect((error as SecretKeyMissingError).envVar).toBe(EMAIL_ENV);
      expect((error as Error).message).toContain("32 bytes");
    }
  });

  it("reports whether a usable key is present, per env var", () => {
    expect(hasSecretKey(EMAIL_ENV)).toBe(true);
    delete process.env[EMAIL_ENV];
    expect(hasSecretKey(EMAIL_ENV)).toBe(false);
    // The other key is untouched: absence is per-var, not global.
    expect(hasSecretKey(MARKET_ENV)).toBe(true);
  });

  it("generates a key the seal accepts", () => {
    const generated = generateSecretKey();
    expect(Buffer.from(generated, "base64")).toHaveLength(32);
    process.env[EMAIL_ENV] = generated;
    expect(openSecret(sealSecret("hunter2", EMAIL_ENV), EMAIL_ENV)).toBe("hunter2");
  });
});
