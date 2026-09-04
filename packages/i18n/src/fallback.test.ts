// Fallback chain resolution table (SKILL.md required test), including the
// ar-no-fallback case — the reason this whole module exists per the
// architecture doc §4.2.
import { describe, expect, it } from "vitest";
import { pickTranslation, resolveFallbackChain, type LocaleFallbackInfo } from "./fallback.ts";

const locales: LocaleFallbackInfo[] = [
  { code: "en", fallbackCode: null },
  { code: "es", fallbackCode: "en" },
  { code: "ar", fallbackCode: null },
  { code: "ur", fallbackCode: null },
];

describe("resolveFallbackChain", () => {
  it.each([
    ["en", ["en"]],
    ["es", ["es", "en"]],
    // The Arabic rule (ADR-007): no fallbackCode configured, chain stops —
    // never silently falls through to English.
    ["ar", ["ar"]],
    ["ur", ["ur"]],
  ] as const)("%s → %j", (requested, expected) => {
    expect(resolveFallbackChain(requested, "en", locales)).toEqual(expected);
  });

  it("an unconfigured locale code still falls through to the default, rather than dead-ending", () => {
    expect(resolveFallbackChain("fr", "en", locales)).toEqual(["fr", "en"]);
  });

  it("a hypothetical 3-level chain (fallbackCode distinct from default) includes all three", () => {
    const withRegionalVariant: LocaleFallbackInfo[] = [
      ...locales,
      { code: "pt-BR", fallbackCode: "pt" },
      { code: "pt", fallbackCode: "en" },
    ];
    expect(resolveFallbackChain("pt-BR", "en", withRegionalVariant)).toEqual(["pt-BR", "pt", "en"]);
  });
});

describe("pickTranslation", () => {
  const rows = [
    { locale: "en", title: "English title" },
    { locale: "es", title: "Título en español" },
  ];

  it("returns the exact-locale row when it exists", () => {
    expect(pickTranslation(rows, "es", "en", locales)).toEqual(rows[1]);
  });

  it("falls back through the chain when the exact locale is missing (es has none here, ur's chain never reaches en)", () => {
    const enOnly = [{ locale: "en", title: "English title" }];
    expect(pickTranslation(enOnly, "es", "en", locales)).toEqual(enOnly[0]);
  });

  it("returns null — 'not yet translated' — for ar when only an English row exists (the Arabic rule in effect)", () => {
    const enOnly = [{ locale: "en", title: "English title" }];
    expect(pickTranslation(enOnly, "ar", "en", locales)).toBeNull();
  });

  it("returns null when nothing in the chain matches at all", () => {
    expect(pickTranslation([], "es", "en", locales)).toBeNull();
  });
});
