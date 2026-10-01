import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_MESSAGE_NAMESPACES,
  catalogMessage,
  flattenMessageKeys,
  missingPublicKeys,
  publicCatalogGaps,
} from "./catalog-gaps.ts";
import type { MessageOverrideRow, OverrideLoader } from "./catalog.ts";

/** No database in a unit test: overrides come from these. */
const none: OverrideLoader = async () => [];
const rows =
  (byLocale: Record<string, MessageOverrideRow[]>): OverrideLoader =>
  async (locale) =>
    byLocale[locale] ?? [];

/**
 * The `ADMIN_NAMESPACES` set another file declares, read as TEXT: the CI
 * script is plain Node and the catalog-fill script keeps its own copy, so no
 * typed import can compare them.
 */
function declaredIn(path: string): string[] {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const match = /ADMIN_NAMESPACES\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(source);
  return [...(match?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "").sort();
}

describe("catalog gaps (ADR-163 #2)", () => {
  it("uses the same admin namespaces as check:catalog-completeness and translate:catalog", () => {
    const ours = [...ADMIN_MESSAGE_NAMESPACES].sort();
    expect(declaredIn("../../../scripts/check-catalog-completeness.mjs")).toEqual(ours);
    expect(declaredIn("../../translate/scripts/translate-catalog.ts")).toEqual(ours);
  });

  it("flattens nested catalogs to dotted leaf keys", () => {
    expect(flattenMessageKeys({ a: { b: "x", c: { d: "y" } }, e: "z" })).toEqual([
      "a.b",
      "a.c.d",
      "e",
    ]);
  });

  it("reports public gaps and ignores admin ones", () => {
    const en = { home: { title: "Home", intro: "Hi" }, admin: { save: "Save" }, cms: { x: "y" } };
    expect(missingPublicKeys(en, { home: { title: "Inicio" } })).toEqual(["home.intro"]);
    expect(missingPublicKeys(en, { home: { title: "Inicio", intro: "Hola" } })).toEqual([]);
  });

  it("refuses a code next-intl cannot route, before touching a file", async () => {
    expect(await publicCatalogGaps("../../package", none)).toBeNull();
    expect(await publicCatalogGaps("xx", none)).toBeNull();
  });

  it("has no gaps for the default locale", async () => {
    expect(await publicCatalogGaps("en", none)).toEqual([]);
  });

  it("measures a real catalog against en.json", async () => {
    const gaps = await publicCatalogGaps("ar", none);
    expect(Array.isArray(gaps)).toBe(true);
    expect(gaps!.every((key) => !key.startsWith("admin.") && !key.startsWith("cms."))).toBe(true);
  });
});

describe("catalogMessage (ADR-171)", () => {
  it("reads a string in the locale, and falls back to the default locale", async () => {
    expect(await catalogMessage("en", "learn.difficulty.BEGINNER", none)).toBe("Beginner");
    expect(await catalogMessage("ar", "learn.difficulty.BEGINNER", none)).not.toBeNull();
    // A locale next-intl cannot route never reaches a file path.
    expect(await catalogMessage("../../etc", "learn.difficulty.BEGINNER", none)).toBe("Beginner");
  });

  it("returns null for a missing key or a namespace that is not a string", async () => {
    expect(await catalogMessage("en", "learn.difficulty.NOPE", none)).toBeNull();
    expect(await catalogMessage("en", "learn.difficulty", none)).toBeNull();
  });
});

describe("overrides in the gap count and the email reader (ADR-178 #3)", () => {
  it("counts a language with no file as missing every public key", async () => {
    const gaps = await publicCatalogGaps("fr", none);
    expect(gaps).not.toBeNull();
    expect(gaps!.length).toBeGreaterThan(100);
    expect(gaps).toContain("learn.difficulty.BEGINNER");
  });

  it("closes a gap with an override", async () => {
    const before = await publicCatalogGaps("fr", none);
    const after = await publicCatalogGaps(
      "fr",
      rows({ fr: [{ key: "learn.difficulty.BEGINNER", value: "Débutant", isMachine: false }] }),
    );
    expect(after!.length).toBe(before!.length - 1);
    expect(after).not.toContain("learn.difficulty.BEGINNER");
  });

  it("reads an override before the file, and an English override as the fallback", async () => {
    const loader = rows({
      en: [{ key: "learn.difficulty.BEGINNER", value: "Starter", isMachine: false }],
      fr: [{ key: "learn.difficulty.ADVANCED", value: "Avancé", isMachine: true }],
    });
    expect(await catalogMessage("fr", "learn.difficulty.ADVANCED", loader)).toBe("Avancé");
    expect(await catalogMessage("fr", "learn.difficulty.BEGINNER", loader)).toBe("Starter");
  });

  it("falls back to the file when the override read fails", async () => {
    const broken: OverrideLoader = async () => {
      throw new Error("database down");
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await catalogMessage("en", "learn.difficulty.BEGINNER", broken)).toBe("Beginner");
    spy.mockRestore();
  });
});
