// ADR-127 #5: `?lang=` is shaped like a locale code, or it is no reading language.
import { describe, expect, it } from "vitest";
import { readingLanguageSearchSchema } from "./content.ts";

describe("readingLanguageSearchSchema", () => {
  it.each(["es", "ar", "ur", "fil", "pt-BR", "zh-Hant"])("accepts %s", (lang) => {
    expect(readingLanguageSearchSchema.parse({ lang })).toEqual({ lang });
  });

  it("treats an absent value as no reading language", () => {
    expect(readingLanguageSearchSchema.parse({})).toEqual({});
  });

  it.each([
    "",
    "ES",
    "english",
    "../admin",
    "es?x=1",
    "e",
    "es-",
    "<script>",
    ["es", "ar"],
  ])("rejects %j", (lang) => {
    expect(readingLanguageSearchSchema.safeParse({ lang }).success).toBe(false);
  });
});
