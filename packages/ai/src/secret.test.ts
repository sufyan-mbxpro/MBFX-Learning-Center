// ADR-098. `email/secret.test.ts` copied, as ADR-087 #6 proved it should be:
// the seal is shared, so the properties a database row depends on are the same
// three every time — that what it holds is useless without the env key, that a
// tampered row fails loudly, and that there is **never** a fallback to
// plaintext.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AI_SECRET_KEY_ENV,
  AiSecretInvalidError,
  AiSecretKeyMissingError,
  generateAiSecretKey,
  hasAiSecretKey,
  openAiSecret,
  sealAiSecret,
} from "./secret.ts";

const KEY = "3q2+796tvu/erb7v3q2+796tvu/erb7v3q2+796tvu8=";
const OTHER_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

beforeEach(() => {
  process.env[AI_SECRET_KEY_ENV] = KEY;
});

afterEach(() => {
  delete process.env[AI_SECRET_KEY_ENV];
});

describe("sealAiSecret / openAiSecret", () => {
  it("round-trips an API key", () => {
    expect(openAiSecret(sealAiSecret("sk-ant-secret"))).toBe("sk-ant-secret");
  });

  it("round-trips non-ASCII and empty values", () => {
    expect(openAiSecret(sealAiSecret("clé — 🔐"))).toBe("clé — 🔐");
    expect(openAiSecret(sealAiSecret(""))).toBe("");
  });

  it("never produces the same ciphertext twice", () => {
    expect(sealAiSecret("sk-ant-secret")).not.toBe(sealAiSecret("sk-ant-secret"));
  });

  it("stores nothing that looks like the plaintext", () => {
    expect(sealAiSecret("sk-ant-secret")).not.toContain("sk-ant-secret");
  });

  it("labels the seal with its version", () => {
    expect(sealAiSecret("k").startsWith("v1:")).toBe(true);
    expect(sealAiSecret("k").split(":")).toHaveLength(4);
  });
});

describe("a seal that should not open", () => {
  it("refuses a tampered ciphertext", () => {
    const parts = sealAiSecret("sk-ant-secret").split(":");
    const ciphertext = Buffer.from(parts[3]!, "base64");
    ciphertext[0] = ciphertext[0]! ^ 0xff;
    parts[3] = ciphertext.toString("base64");
    expect(() => openAiSecret(parts.join(":"))).toThrow(AiSecretInvalidError);
  });

  it("refuses a seal written under a different key", () => {
    const sealed = sealAiSecret("sk-ant-secret");
    process.env[AI_SECRET_KEY_ENV] = OTHER_KEY;
    expect(() => openAiSecret(sealed)).toThrow(AiSecretInvalidError);
  });

  it("refuses a value that is not in our shape at all", () => {
    expect(() => openAiSecret("sk-ant-plaintext")).toThrow(AiSecretInvalidError);
  });
});

describe("without AI_SECRET_KEY", () => {
  it("cannot seal, and does NOT fall back to plaintext", () => {
    // The property that matters most: a missing key must stop a write, never
    // silently store a readable credential.
    delete process.env[AI_SECRET_KEY_ENV];
    expect(() => sealAiSecret("sk-ant-secret")).toThrow(AiSecretKeyMissingError);
  });

  it("cannot open", () => {
    const sealed = sealAiSecret("sk-ant-secret");
    delete process.env[AI_SECRET_KEY_ENV];
    expect(() => openAiSecret(sealed)).toThrow(AiSecretKeyMissingError);
  });

  it("reports itself, so the screen can warn instead of failing later", () => {
    // An edited `.env` does nothing until `next dev` restarts (DEVLOG
    // 2026-09-14), and an absent key reads exactly like a rejected API key.
    // This is what lets the providers screen say which one it is.
    expect(hasAiSecretKey()).toBe(true);
    delete process.env[AI_SECRET_KEY_ENV];
    expect(hasAiSecretKey()).toBe(false);
  });

  it("refuses a key of the wrong length rather than padding it", () => {
    process.env[AI_SECRET_KEY_ENV] = Buffer.from("too short").toString("base64");
    expect(hasAiSecretKey()).toBe(false);
    expect(() => sealAiSecret("k")).toThrow(AiSecretKeyMissingError);
  });
});

describe("generateAiSecretKey", () => {
  it("produces a usable 32-byte key", () => {
    const key = generateAiSecretKey();
    expect(Buffer.from(key, "base64")).toHaveLength(32);
    process.env[AI_SECRET_KEY_ENV] = key;
    expect(openAiSecret(sealAiSecret("round trip"))).toBe("round trip");
  });
});
