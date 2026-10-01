// Phase 5, the short labels on a real MariaDB with Google faked (MSW): article
// categories and tags are translated on creation, a person's save is
// TRANSLATED and flagged when the English moves on, and menu items — which
// only the seed writes — are reached by a language's backfill.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  startTranslationTestDb,
  useFakeGoogle,
  type TranslationTestContext,
} from "./test-utils/translation-container.ts";
import type * as ArticlesModule from "./articles.ts";
import type * as RunnerModule from "./translation-runner.ts";
import type * as TranslateModule from "@repo/translate";

let ctx: TranslationTestContext;
let articles: typeof ArticlesModule;
let runner: typeof RunnerModule;
let translate: typeof TranslateModule;

beforeAll(async () => {
  ctx = await startTranslationTestDb("mbfx_label_translation", ["news.manage"]);
  articles = await import("./articles.ts");
  runner = await import("./translation-runner.ts");
  translate = await import("@repo/translate");
}, 180_000);

afterAll(async () => {
  await ctx?.stop();
});

beforeEach(() => {
  useFakeGoogle(ctx.server);
});

describe("article categories and tags", () => {
  it("translates a new category and tag, reusing their slugs", async () => {
    const categoryId = await articles.createArticleCategory(ctx.editor, {
      name: "Central banks",
      description: "Rate decisions.",
    });
    const tagId = await articles.createArticleTag(ctx.editor, { name: "Inflation" });
    await runner.drainTranslationQueue();

    expect(
      await ctx.db.articleCategoryTranslation.findFirstOrThrow({
        where: { categoryId, locale: "es" },
      }),
    ).toMatchObject({
      name: "[es] Central banks",
      slug: "central-banks",
      description: "[es] Rate decisions.",
      translationStatus: "MACHINE_TRANSLATED",
    });
    expect(
      await ctx.db.articleTagTranslation.findFirstOrThrow({ where: { tagId, locale: "es" } }),
    ).toMatchObject({
      name: "[es] Inflation",
      slug: "inflation",
      translationStatus: "MACHINE_TRANSLATED",
    });
  });

  it("a person's save is TRANSLATED, and an English rename flags it", async () => {
    const tagId = await articles.createArticleTag(ctx.editor, { name: "Yields" });
    await runner.drainTranslationQueue();
    await articles.saveArticleTagTranslation(ctx.editor, {
      tagId,
      locale: "es",
      name: "Rendimientos",
      slug: "rendimientos",
    });
    let es = await ctx.db.articleTagTranslation.findFirstOrThrow({
      where: { tagId, locale: "es" },
    });
    expect(es.translationStatus).toBe("TRANSLATED");

    await articles.saveArticleTagTranslation(ctx.editor, {
      tagId,
      locale: "en",
      name: "Bond yields",
      slug: "yields",
    });
    await runner.drainTranslationQueue();
    es = await ctx.db.articleTagTranslation.findFirstOrThrow({ where: { tagId, locale: "es" } });
    expect(es).toMatchObject({ name: "Rendimientos", translationStatus: "OUTDATED" });
  });
});

describe("menu items", () => {
  it("are reached by the language backfill", async () => {
    const menu = await ctx.db.menu.create({
      data: { key: "main", name: "Main", location: "header" },
    });
    const item = await ctx.db.menuItem.create({
      data: {
        menuId: menu.id,
        translations: { create: { locale: "en", label: "Learn", title: "Start learning" } },
      },
    });
    await ctx.db.translationJob.deleteMany();
    await translate.enqueueLocaleBackfill("es");
    await runner.drainTranslationQueue();
    expect(
      await ctx.db.menuItemTranslation.findFirstOrThrow({
        where: { menuItemId: item.id, locale: "es" },
      }),
    ).toMatchObject({
      label: "[es] Learn",
      title: "[es] Start learning",
      translationStatus: "MACHINE_TRANSLATED",
    });
  });
});
