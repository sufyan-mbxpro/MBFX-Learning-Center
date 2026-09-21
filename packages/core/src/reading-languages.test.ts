// ADR-127 #2: which translations a reader may choose to read.
import { describe, expect, it } from "vitest";
import { TranslationStatus } from "@repo/db";
import {
  advertisedAlternates,
  READABLE_TRANSLATION_STATUSES,
  applyReadingLocale,
  resolveReadingLanguages,
  type LocaleMeta,
} from "./reading-languages.ts";

const known: LocaleMeta[] = [
  { code: "es", nativeName: "Español", direction: "LTR", sortOrder: 4 },
  { code: "en", nativeName: "English", direction: "LTR", sortOrder: 1 },
  { code: "ar", nativeName: "العربية", direction: "RTL", sortOrder: 3 },
  { code: "ur", nativeName: "اردو", direction: "RTL", sortOrder: 2 },
];

const row = (locale: string, translationStatus: TranslationStatus) => ({
  locale,
  slug: `${locale}-slug`,
  translationStatus,
});

describe("READABLE_TRANSLATION_STATUSES", () => {
  it("admits only what a human wrote (ADR-097's consequence)", () => {
    expect(READABLE_TRANSLATION_STATUSES).toContain(TranslationStatus.TRANSLATED);
    expect(READABLE_TRANSLATION_STATUSES).toContain(TranslationStatus.OUTDATED);
    expect(READABLE_TRANSLATION_STATUSES).not.toContain(TranslationStatus.MACHINE_TRANSLATED);
    expect(READABLE_TRANSLATION_STATUSES).not.toContain(TranslationStatus.DRAFT);
    expect(READABLE_TRANSLATION_STATUSES).not.toContain(TranslationStatus.NEEDS_REVIEW);
  });
});

describe("resolveReadingLanguages", () => {
  it("lists human translations in the locales' display order, with direction", () => {
    const languages = resolveReadingLanguages(
      [
        row("es", TranslationStatus.TRANSLATED),
        row("en", TranslationStatus.TRANSLATED),
        row("ar", TranslationStatus.OUTDATED),
      ],
      known,
      ["en"],
    );
    expect(languages).toEqual([
      { locale: "en", nativeName: "English", direction: "ltr", slug: "en-slug" },
      { locale: "ar", nativeName: "العربية", direction: "rtl", slug: "ar-slug" },
      { locale: "es", nativeName: "Español", direction: "ltr", slug: "es-slug" },
    ]);
  });

  it("drops a machine translation and a draft", () => {
    const languages = resolveReadingLanguages(
      [
        row("en", TranslationStatus.TRANSLATED),
        row("es", TranslationStatus.MACHINE_TRANSLATED),
        row("ar", TranslationStatus.DRAFT),
      ],
      known,
      ["en"],
    );
    expect(languages.map((l) => l.locale)).toEqual(["en"]);
  });

  it("always lists the translation on screen, whatever its status", () => {
    const languages = resolveReadingLanguages(
      [row("en", TranslationStatus.DRAFT), row("es", TranslationStatus.TRANSLATED)],
      known,
      ["en"],
    );
    expect(languages.map((l) => l.locale)).toEqual(["en", "es"]);
  });

  it("drops a translation whose locale has no Locale row", () => {
    const languages = resolveReadingLanguages(
      [row("en", TranslationStatus.TRANSLATED), row("fr", TranslationStatus.TRANSLATED)],
      known,
      ["en"],
    );
    expect(languages.map((l) => l.locale)).toEqual(["en"]);
  });
});

describe("applyReadingLocale", () => {
  const en = row("en", TranslationStatus.TRANSLATED);
  const translations = [
    en,
    row("ar", TranslationStatus.TRANSLATED),
    row("es", TranslationStatus.MACHINE_TRANSLATED),
  ];

  it("swaps in a human translation the reader chose, with its direction", () => {
    const result = applyReadingLocale(translations, en, "ar", known, "en");
    expect(result.picked?.locale).toBe("ar");
    expect(result.readingLocale).toBe("ar");
    expect(result.contentLocale).toBe("ar");
    expect(result.contentDirection).toBe("rtl");
    expect(result.readingLanguages.map((l) => l.locale)).toEqual(["en", "ar"]);
  });

  it("ignores a machine translation, an unknown code and the language already shown", () => {
    for (const lang of ["es", "fr", "en", undefined]) {
      const result = applyReadingLocale(translations, en, lang, known, "en");
      expect(result.picked).toBe(en);
      expect(result.readingLocale).toBeNull();
      expect(result.contentDirection).toBe("ltr");
    }
  });

  it("keeps the page's own translation on a reading view even when it is a DRAFT", () => {
    const draftEn = row("en", TranslationStatus.DRAFT);
    const result = applyReadingLocale(
      [draftEn, row("es", TranslationStatus.TRANSLATED)],
      draftEn,
      "es",
      known,
      "en",
    );
    expect(result.readingLocale).toBe("es");
    expect(result.readingLanguages.map((l) => l.locale)).toEqual(["en", "es"]);
  });

  it("falls back to the interface locale when nothing is picked at all", () => {
    const result = applyReadingLocale([], null, "ar", known, "ur");
    expect(result.picked).toBeNull();
    expect(result.contentLocale).toBe("ur");
    expect(result.readingLanguages).toEqual([]);
  });
});

describe("advertisedAlternates", () => {
  const row = (locale: string, translationStatus: TranslationStatus) => ({
    locale,
    slug: `${locale}-slug`,
    translationStatus,
  });

  it("keeps the default locale's row whatever its status — it is the source", () => {
    expect(advertisedAlternates([row("en", TranslationStatus.DRAFT)], "en")).toEqual([
      { locale: "en", slug: "en-slug" },
    ]);
  });

  it("drops a machine or draft translation in another locale", () => {
    const rows = [
      row("en", TranslationStatus.TRANSLATED),
      row("es", TranslationStatus.MACHINE_TRANSLATED),
      row("ar", TranslationStatus.DRAFT),
      row("ur", TranslationStatus.OUTDATED),
    ];
    expect(advertisedAlternates(rows, "en").map((a) => a.locale)).toEqual(["en", "ur"]);
  });
});
