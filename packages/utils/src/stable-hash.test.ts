import { describe, expect, it } from "vitest";
import { pickByHash, stableHash } from "./stable-hash.ts";

describe("stableHash", () => {
  it("is deterministic — the same key always gives the same number", () => {
    expect(stableHash("crypto-basics")).toBe(stableHash("crypto-basics"));
  });

  it("pins known values, so a refactor that changes the algorithm fails here rather than silently recolouring every category on the site", () => {
    // FNV-1a 32-bit, computed by the implementation this replaced. If these
    // change, every hashed choice in the app changes with them.
    expect(stableHash("")).toBe(0x811c9dc5);
    expect(stableHash("a")).toBe(0xe40c292c);
  });

  it("separates keys that differ only in order", () => {
    expect(stableHash("ab")).not.toBe(stableHash("ba"));
  });

  it("is unsigned — never negative, so a modulo never indexes off the front of a list", () => {
    for (const key of ["", "a", "zzzzzzzzzzzz", "risk-management", "éèê"]) {
      expect(stableHash(key)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("pickByHash", () => {
  const TONES = ["info", "success", "warning", "eyebrow"] as const;

  it("returns the same option for the same key every time", () => {
    expect(pickByHash("scalping", TONES)).toBe(pickByHash("scalping", TONES));
  });

  it("is total — a key never seen before still gets an option", () => {
    expect(TONES).toContain(pickByHash("a-category-invented-just-now", TONES));
  });

  it("always returns an element of the list it was given, for many keys", () => {
    for (let index = 0; index < 200; index += 1) {
      expect(TONES).toContain(pickByHash(`category-${index}`, TONES));
    }
  });

  it("agrees between two vocabularies of the same length — which is what keeps a category the same colour in the admin and on the public site", () => {
    const admin = ["info", "success", "warning", "neutral"] as const;
    const index = TONES.indexOf(pickByHash("crypto-basics", TONES));
    expect(pickByHash("crypto-basics", admin)).toBe(admin[index]);
  });

  it("refuses an empty list rather than returning undefined", () => {
    expect(() => pickByHash("anything", [])).toThrow(/must not be empty/);
  });
});
