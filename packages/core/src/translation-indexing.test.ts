// ADR-159 #2: which translations a search engine may be sent to, and the
// language facts a detail page puts on its content wrapper.
import { describe, expect, it } from "vitest";
import { TranslationStatus } from "@repo/db";
import {
  advertisedAlternates,
  contentLanguage,
  INDEXABLE_TRANSLATION_STATUSES,
  isIndexableTranslation,
} from "./translation-indexing.ts";

describe("INDEXABLE_TRANSLATION_STATUSES (ADR-159 #2)", () => {
  it("indexes only what a person saved — never machine prose", () => {
    expect([...INDEXABLE_TRANSLATION_STATUSES].sort()).toEqual(["OUTDATED", "TRANSLATED"]);
  });

  it("always indexes the default locale's row, whatever its status", () => {
    expect(
      isIndexableTranslation({ locale: "en", translationStatus: TranslationStatus.DRAFT }, "en"),
    ).toBe(true);
    expect(
      isIndexableTranslation(
        { locale: "es", translationStatus: TranslationStatus.MACHINE_TRANSLATED },
        "en",
      ),
    ).toBe(false);
  });
});

describe("contentLanguage", () => {
  it("names the words' locale and takes its direction from the routing registry", () => {
    expect(contentLanguage("ar")).toEqual({ contentLocale: "ar", contentDirection: "rtl" });
    expect(contentLanguage("en")).toEqual({ contentLocale: "en", contentDirection: "ltr" });
  });

  it("reads an unroutable code as left-to-right", () => {
    expect(contentLanguage("xx").contentDirection).toBe("ltr");
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
