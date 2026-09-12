// ADR-078 #3. Every assertion here is a property the database row depends on:
// that what it holds is useless without the env key, that a tampered row
// fails loudly, and that there is never a fallback to plaintext.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EMAIL_SECRET_KEY_ENV,
  EmailSecretInvalidError,
  EmailSecretKeyMissingError,
  generateEmailSecretKey,
  hasEmailSecretKey,
  openSecret,
  sealSecret,
} from "./secret.ts";

const KEY = "3q2+796tvu/erb7v3q2+796tvu/erb7v3q2+796tvu8=";
const OTHER_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

beforeEach(() => {
  process.env[EMAIL_SECRET_KEY_ENV] = KEY;
});

afterEach(() => {
  delete process.env[EMAIL_SECRET_KEY_ENV];
});

describe("sealSecret / openSecret", () => {
  it("round-trips a password", () => {
    expect(openSecret(sealSecret("hunter2"))).toBe("hunter2");
  });

  it("round-trips non-ASCII and empty values", () => {
    expect(openSecret(sealSecret("pa55wörd — 🔐"))).toBe("pa55wörd — 🔐");
    expect(openSecret(sealSecret(""))).toBe("");
  });

  it("never produces the same ciphertext twice", () => {
    // A reused IV under one key is what breaks GCM.
    expect(sealSecret("hunter2")).not.toBe(sealSecret("hunter2"));
  });

  it("stores nothing that looks like the plaintext", () => {
    expect(sealSecret("hunter2")).not.toContain("hunter2");
  });

  it("labels the seal with its version, so rotation is a version bump", () => {
    expect(sealSecret("hunter2").startsWith("v1:")).toBe(true);
    expect(sealSecret("hunter2").split(":")).toHaveLength(4);
  });
});

describe("a seal that should not open", () => {
  it("refuses a tampered ciphertext", () => {
    const parts = sealSecret("hunter2").split(":");
    const ciphertext = Buffer.from(parts[3]!, "base64");
    ciphertext[0] = ciphertext[0]! ^ 0xff;
    parts[3] = ciphertext.toString("base64");
    expect(() => openSecret(parts.join(":"))).toThrow(EmailSecretInvalidError);
  });

  it("refuses a tampered auth tag", () => {
    const parts = sealSecret("hunter2").split(":");
    parts[2] = Buffer.alloc(16).toString("base64");
    expect(() => openSecret(parts.join(":"))).toThrow(EmailSecretInvalidError);
  });

  it("refuses another key's seal", () => {
    const sealed = sealSecret("hunter2");
    process.env[EMAIL_SECRET_KEY_ENV] = OTHER_KEY;
    expect(() => openSecret(sealed)).toThrow(EmailSecretInvalidError);
  });

  it("refuses a malformed or unversioned value", () => {
    expect(() => openSecret("hunter2")).toThrow(EmailSecretInvalidError);
    expect(() => openSecret("v2:a:b:c")).toThrow(EmailSecretInvalidError);
    expect(() => openSecret("v1::b:c")).toThrow(EmailSecretInvalidError);
    expect(() => openSecret("v1:a:b:c:d")).toThrow(EmailSecretInvalidError);
  });

  it("says the same thing whatever went wrong", () => {
    // A wrong key and a tampered row are one event to a caller: saying which
    // half was right is a hint an attacker can use.
    const sealed = sealSecret("hunter2");
    let tamperedMessage = "";
    try {
      openSecret(sealed.slice(0, -4) + "AAAA");
    } catch (error) {
      tamperedMessage = (error as Error).message;
    }
    expect(tamperedMessage).not.toBe("");
    process.env[EMAIL_SECRET_KEY_ENV] = OTHER_KEY;
    expect(() => openSecret(sealed)).toThrow(tamperedMessage);
  });
});

describe("the key itself", () => {
  it("is required to seal or open — there is no plaintext path", () => {
    delete process.env[EMAIL_SECRET_KEY_ENV];
    expect(() => sealSecret("hunter2")).toThrow(EmailSecretKeyMissingError);
    expect(() => openSecret("v1:a:b:c")).toThrow(EmailSecretKeyMissingError);
    expect(hasEmailSecretKey()).toBe(false);
  });

  it("must be exactly 32 bytes — a short key is never padded", () => {
    process.env[EMAIL_SECRET_KEY_ENV] = Buffer.from("too short").toString("base64");
    expect(() => sealSecret("hunter2")).toThrow(EmailSecretKeyMissingError);
    expect(hasEmailSecretKey()).toBe(false);
  });

  it("generates one that works", () => {
    process.env[EMAIL_SECRET_KEY_ENV] = generateEmailSecretKey();
    expect(hasEmailSecretKey()).toBe(true);
    expect(openSecret(sealSecret("hunter2"))).toBe("hunter2");
  });
});
