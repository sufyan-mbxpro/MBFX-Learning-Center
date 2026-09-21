// ADR-127: the reading-language menu on every detail page that has one.
//
// Two halves. `readingLanguageOptions` is pure and tested as a function. The
// pages are async server components behind cached queries, so what guards
// them is their SOURCE: each wiring decision the ADR makes, on each page, so a
// sixth page cannot copy four of the five and look finished.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ReadingLanguage } from "@repo/core";
import { readingLanguageOptions, readingLocaleFrom } from "./reading-language.ts";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const language = (locale: string, direction: "ltr" | "rtl" = "ltr"): ReadingLanguage => ({
  locale,
  nativeName: locale.toUpperCase(),
  direction,
  slug: `${locale}-slug`,
});

describe("readingLocaleFrom", () => {
  it("accepts a locale code and ignores anything else, never throwing", () => {
    expect(readingLocaleFrom({ lang: "ar" })).toBe("ar");
    expect(readingLocaleFrom({})).toBeUndefined();
    expect(readingLocaleFrom({ lang: ["ar", "es"] })).toBeUndefined();
    expect(readingLocaleFrom({ lang: "../../etc" })).toBeUndefined();
  });
});

describe("readingLanguageOptions", () => {
  const base = {
    languages: [language("en"), language("ar", "rtl"), language("es")],
    interfaceLocale: "en",
    currentPath: "/glossary/en-slug",
    pathFor: (l: ReadingLanguage) => `/glossary/${l.slug}`,
  };

  it("sends the interface locale home, a served locale to its own page, the rest to ?lang=", () => {
    const options = readingLanguageOptions({
      ...base,
      contentLocale: "ar",
      servable: ["en", "es"],
    });
    expect(options).toEqual([
      { code: "en", nativeName: "EN", direction: "ltr", current: false, href: "/glossary/en-slug" },
      {
        code: "ar",
        nativeName: "AR",
        direction: "rtl",
        current: true,
        href: "/glossary/en-slug?lang=ar",
      },
      {
        code: "es",
        nativeName: "ES",
        direction: "ltr",
        current: false,
        href: "/glossary/es-slug",
        locale: "es",
      },
    ]);
  });

  it("keeps a served locale with no address of its own as a reading view", () => {
    const options = readingLanguageOptions({
      ...base,
      contentLocale: "en",
      servable: ["en", "es"],
      pathFor: (l) => (l.locale === "es" ? null : `/glossary/${l.slug}`),
    });
    expect(options.find((o) => o.code === "es")).toMatchObject({
      href: "/glossary/en-slug?lang=es",
    });
    expect(options.find((o) => o.code === "es")).not.toHaveProperty("locale");
  });
});

const PAGES = {
  news: "app/(public)/[locale]/news/[slug]/page.tsx",
  course: "app/(public)/[locale]/learn/[track]/[course]/page.tsx",
  lesson: "app/(public)/[locale]/learn/[track]/[course]/[lesson]/page.tsx",
  video: "app/(public)/[locale]/learn/[track]/videos/[topic]/page.tsx",
  glossary: "app/(public)/[locale]/glossary/[slug]/page.tsx",
  quiz: "app/(public)/[locale]/learn/[track]/quizzes/[quiz]/page.tsx",
} as const;

describe.each(Object.entries(PAGES))("%s page reading language (ADR-127)", (_, path) => {
  const page = read(path);

  it("parses ?lang= through the shared reader, in the page AND its metadata", () => {
    expect(page.match(/readingLocaleFrom\(await searchParams\)/g)).toHaveLength(2);
    expect(page).not.toMatch(/\.lang as /);
  });

  it("builds its options through the shared helper and renders the menu", () => {
    expect(page).toContain("readingLanguageOptions({");
    expect(page).toContain("<ReadingLanguageMenu");
  });

  // The `robots: undefined` half of ADR-090 is `seo-metadata.test.ts`'s job.
  it("never indexes a reading view", () => {
    // A quiz page is never indexed at all (ADR-058), so it needs no condition.
    expect(page).toMatch(
      /view\.readingLocale\s*\?\s*\{ robots: \{ index: false|^\s*robots: \{ index: false, follow: true \},\r?$/m,
    );
  });

  it("marks the item's own words with the translation's direction", () => {
    expect(page).toContain("dir={view.contentDirection}");
  });
});

describe("the menu component", () => {
  const menu = read("app/(public)/[locale]/_components/reading-language-menu.tsx");

  it("renders nothing for fewer than two languages, rather than a disabled control", () => {
    expect(menu).toContain("if (options.length < 2) return null;");
    // A prop, not the word: the file's comment says "ABSENT, not disabled".
    expect(menu).not.toMatch(/\bdisabled[={]/);
  });
});
