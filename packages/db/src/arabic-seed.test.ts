// ADR-166 — the Arabic seed files say the same thing, structurally, as the
// English they translate.
//
// A translation can be wrong in ways no test sees. What a test CAN see is the
// part a translator must not change: the `{{variables}}` an email renders (a
// typo reaches an inbox as literal braces — `check:email-templates` reads only
// the English defaults), the links and the heading outline of a body, the
// count of FAQ items, and whether every key still names something the English
// seed writes. And for the demo courses, COVERAGE: Arabic has no fallback, so
// a lesson missing from the map is a hole in the curriculum.
//
// The course corpus is read as SOURCE, like `footer-sitemap.test.ts` beside
// it, because it is a literal inside the seed script rather than an export.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SEED_ARTICLES } from "../prisma/seed-articles.ts";
import {
  ARTICLE_CATEGORY_NAMES_AR,
  ARTICLE_TAG_NAMES_AR,
  SEED_ARTICLES_AR,
} from "../prisma/seed-articles-ar.ts";
import { EMAIL_TEMPLATES_AR } from "../prisma/seed-email-ar.ts";
import { DEMO_COURSES_AR, DEMO_LESSONS_AR, DEMO_SECTIONS_AR } from "../prisma/seed-learn-ar.ts";
import { EMAIL_TEMPLATE_DEFAULTS } from "./email-template-defaults.ts";

const variables = (text: string) => [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]);
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
const outline = (html: string) =>
  [...html.matchAll(/<(h[1-6]|p|em|strong|a|img)\b/g)].map((m) => m[1]);
const sorted = (list: (string | undefined)[]) => [...new Set(list)].sort();

describe("Arabic email templates", () => {
  for (const [key, arabic] of Object.entries(EMAIL_TEMPLATES_AR)) {
    const english = EMAIL_TEMPLATE_DEFAULTS.find((template) => template.key === key);

    it(`${key} translates a seeded template`, () => {
      expect(english).toBeDefined();
    });
    if (!english) continue;

    it(`${key} uses the same variables, links and markup`, () => {
      expect(sorted(variables(arabic.subject))).toEqual(sorted(variables(english.subject)));
      expect(sorted(variables(arabic.preheader))).toEqual(sorted(variables(english.preheader)));
      expect(sorted(variables(arabic.bodyHtml))).toEqual(sorted(variables(english.bodyHtml)));
      expect(hrefs(arabic.bodyHtml)).toEqual(hrefs(english.bodyHtml));
      expect(outline(arabic.bodyHtml)).toEqual(outline(english.bodyHtml));
    });
  }

  it("leaves the staff-bound support template in English (ADR-113)", () => {
    expect(EMAIL_TEMPLATES_AR["support.request"]).toBeUndefined();
  });
});

describe("Arabic article corpus", () => {
  for (const arabic of SEED_ARTICLES_AR) {
    const english = SEED_ARTICLES.find((article) => article.slug === arabic.slug);

    it(`${arabic.slug} translates a seeded article`, () => {
      expect(english).toBeDefined();
    });
    if (!english) continue;

    it(`${arabic.slug} keeps the links, outline and FAQ count`, () => {
      const arBody = arabic.body.join("");
      const enBody = english.body.join("");
      expect(hrefs(arBody)).toEqual(hrefs(enBody));
      expect(outline(arBody)).toEqual(outline(enBody));
      expect(arabic.faq?.length ?? 0).toBe(english.faq?.length ?? 0);
    });

    it(`${arabic.slug} fits the SEO columns`, () => {
      expect(arabic.seoTitle.length).toBeLessThanOrEqual(70);
      expect(arabic.seoDescription.length).toBeLessThanOrEqual(180);
      expect(arabic.excerpt.length).toBeLessThanOrEqual(500);
    });
  }

  it("names only seeded taxonomy", () => {
    const seed = readFileSync(new URL("../prisma/seed.ts", import.meta.url), "utf8");
    for (const slug of [
      ...Object.keys(ARTICLE_CATEGORY_NAMES_AR),
      ...Object.keys(ARTICLE_TAG_NAMES_AR),
    ]) {
      expect(seed).toContain(`slug: "${slug}"`);
    }
  });
});

describe("Arabic demo courses", () => {
  const seed = readFileSync(new URL("../prisma/seed.ts", import.meta.url), "utf8");
  const block = seed.match(/const DEMO_COURSES = \[([\s\S]*?)\n {2}\] as const;/)?.[1] ?? "";
  // Indentation is the structure: courses at 6, section titles at 10, lessons at 14.
  const courseSlugs = [...block.matchAll(/^ {6}slug: "([\w-]+)"/gm)].map((m) => m[1]);
  const sectionTitles = [...block.matchAll(/^ {10}title: "(.+)",$/gm)].map((m) => m[1]);
  const lessonSlugs = [...block.matchAll(/^ {14}slug: "([\w-]+)"/gm)].map((m) => m[1]);

  it("reads the demo corpus", () => {
    expect(courseSlugs.length).toBeGreaterThan(0);
    expect(sectionTitles.length).toBeGreaterThan(0);
    expect(lessonSlugs.length).toBeGreaterThan(0);
  });

  it("translates every demo course, section and lesson, and nothing else", () => {
    expect(sorted(Object.keys(DEMO_COURSES_AR))).toEqual(sorted(courseSlugs));
    expect(sorted(Object.keys(DEMO_SECTIONS_AR))).toEqual(sorted(sectionTitles));
    expect(sorted(Object.keys(DEMO_LESSONS_AR))).toEqual(sorted(lessonSlugs));
  });
});
