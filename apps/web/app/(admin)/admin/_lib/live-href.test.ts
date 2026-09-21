import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { liveHref, storedSlug } from "./live-href.ts";

describe("liveHref", () => {
  it("leaves the default locale's path alone", () => {
    expect(liveHref("/news/pips", "en", "en")).toBe("/news/pips");
  });

  it("opens any other locale as a reading view on the default page, never /es/…", () => {
    expect(liveHref("/learn/forex/videos/pips", "ar", "en")).toBe(
      "/learn/forex/videos/pips?lang=ar",
    );
  });
});

describe("storedSlug", () => {
  const rows = [
    { locale: "en", slug: "pips" },
    { locale: "es", slug: "pipos" },
  ];
  it("reads the locale's saved slug", () => {
    expect(storedSlug(rows, "en")).toBe("pips");
  });
  it("is empty when the locale has no saved row", () => {
    expect(storedSlug(rows, "ur")).toBe("");
  });
});

// Regression: the video topic, glossary term, glossary topic and article
// taxonomy screens offered only ACTIVE locales. Only `en` is active, so the
// switcher (`locales.length > 1`) never rendered and no translation could be
// written there at all.
describe("content editors offer every authoring locale", () => {
  const admin = join(__dirname, "..");
  const pages = [
    "learn/videos/[id]/page.tsx",
    "glossary/[id]/page.tsx",
    "glossary/topics/[id]/page.tsx",
    "articles/(browse)/categories/page.tsx",
    "articles/(browse)/tags/page.tsx",
  ];
  it.each(pages)("%s", (page) => {
    const source = readFileSync(join(admin, page), "utf8");
    expect(source).toContain("getAuthoringLocales()");
    expect(source).not.toContain("getActiveLocales");
  });

  const editors = [
    "articles/[id]/article-editor.tsx",
    "learn/courses/[id]/course-editor.tsx",
    "learn/lessons/[id]/lesson-editor.tsx",
    "learn/videos/[id]/video-editor.tsx",
    "learn/quizzes/[id]/quiz-editor.tsx",
    "glossary/[id]/glossary-editor.tsx",
    "glossary/topics/[id]/topic-editor.tsx",
  ];
  it.each(editors)("%s links View live through liveHref", (editor) => {
    const source = readFileSync(join(admin, editor), "utf8");
    expect(source).toContain("liveHref(");
  });
});
