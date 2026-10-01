import { describe, expect, it } from "vitest";
import { LOCALE_DIRECTION, routing, SUPPORTED_LOCALES, supportedLocale } from "./routing.ts";

describe("SUPPORTED_LOCALES (ADR-178 #1)", () => {
  it("is what next-intl routes, with a direction for every code", () => {
    expect([...routing.locales]).toEqual(SUPPORTED_LOCALES.map((l) => l.code));
    for (const { code, direction } of SUPPORTED_LOCALES) {
      expect(LOCALE_DIRECTION[code]).toBe(direction);
    }
  });

  it("has unique codes, plain ISO 639-1, the default first", () => {
    const codes = SUPPORTED_LOCALES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^[a-z]{2}$/.test(c))).toBe(true);
    expect(codes[0]).toBe(routing.defaultLocale);
  });

  it("looks a code up", () => {
    expect(supportedLocale("fa")?.direction).toBe("rtl");
    expect(supportedLocale("xx")).toBeUndefined();
  });
});
