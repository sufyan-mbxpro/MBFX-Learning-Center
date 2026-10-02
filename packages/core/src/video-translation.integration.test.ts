// Phase 5, videos on a real MariaDB with Google faked (MSW): a topic and its
// link labels, and a category, are translated by the engine; the topic page
// serves machine words `noindex` with the labels in the reader's language and
// keeps them out of the sitemap until a person saves.
import { ContentStatus } from "@repo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  startTranslationTestDb,
  useFakeGoogle,
  type TranslationTestContext,
} from "./test-utils/translation-container.ts";
import type * as ContentModule from "./content.ts";
import type * as VideosModule from "./videos.ts";
import type * as RunnerModule from "./translation-runner.ts";

let ctx: TranslationTestContext;
let content: typeof ContentModule;
let videos: typeof VideosModule;
let runner: typeof RunnerModule;

beforeAll(async () => {
  ctx = await startTranslationTestDb("mbfx_video_translation", [
    "lessons.create",
    "lessons.update",
    "lessons.publish",
    "videos.create",
    "videos.update",
    "videos.publish",
  ]);
  content = await import("./content.ts");
  videos = await import("./videos.ts");
  runner = await import("./translation-runner.ts");
}, 180_000);

afterAll(async () => {
  await ctx?.stop();
});

beforeEach(() => {
  useFakeGoogle(ctx.server);
});

let seq = 0;

async function publishedTopic() {
  seq += 1;
  const categoryId = await videos.saveVideoCategory(ctx.editor, {
    translation: { locale: "en", name: `Charting ${seq}` },
  });
  const topicId = await videos.createVideoTopic(ctx.editor, {
    title: `Candles ${seq}`,
    track: "forex",
    categoryId,
  });
  await videos.saveVideoTopic(ctx.editor, {
    topicId,
    meta: {},
    translation: {
      locale: "en",
      title: `Candles ${seq}`,
      summary: "How to read a candle.",
      content: "<p>A candle shows 4 prices.</p>",
    },
    videos: [],
    links: [{ label: "Practice quiz", path: "/learn/forex/quizzes" }],
  });
  await content.transitionContentStatus(ctx.editor, "videos", topicId, ContentStatus.PUBLISHED);
  const en = await ctx.db.videoTopicTranslation.findFirstOrThrow({
    where: { topicId, locale: "en" },
  });
  return { topicId, categoryId, slug: en.slug };
}

describe("video topics and categories", () => {
  it("translates the topic, its link labels and its category", async () => {
    const { topicId, categoryId, slug } = await publishedTopic();
    const drained = await runner.drainTranslationQueue();
    expect(drained.failed).toBe(0);

    const es = await ctx.db.videoTopicTranslation.findFirstOrThrow({
      where: { topicId, locale: "es" },
    });
    expect(es).toMatchObject({
      title: `[es] Candles ${seq}`,
      slug,
      summary: "[es] How to read a candle.",
      translationStatus: "MACHINE_TRANSLATED",
      linkLabels: { "Practice quiz": "[es] Practice quiz" },
    });
    const category = await ctx.db.videoCategoryTranslation.findFirstOrThrow({
      where: { categoryId, locale: "es" },
    });
    expect(category).toMatchObject({
      name: `[es] Charting ${seq}`,
      translationStatus: "MACHINE_TRANSLATED",
    });
  });

  it("serves the page noindex with translated labels; a person's save lifts it", async () => {
    const { topicId, slug } = await publishedTopic();
    await runner.drainTranslationQueue();

    const view = await videos.loadVideoTopicBySlug("es", "forex", slug);
    expect(view).toMatchObject({ title: `[es] Candles ${seq}`, noIndex: true });
    expect(view?.links.map((l) => l.label)).toEqual(["[es] Practice quiz"]);
    expect(
      (await videos.loadVideoTopicBySlug("en", "forex", slug))?.links.map((l) => l.label),
    ).toEqual(["Practice quiz"]);
    let sitemap = await videos.loadVideoSitemapEntries();
    expect(sitemap.filter((e) => e.path.endsWith(slug)).map((e) => e.locale)).toEqual(["en"]);

    await videos.saveVideoTopic(ctx.editor, {
      topicId,
      meta: {},
      translation: {
        locale: "es",
        title: "Velas revisadas",
        slug,
        content: "<p>Una vela muestra 4 precios.</p>",
      },
      videos: [],
      links: [{ label: "Practice quiz", path: "/learn/forex/quizzes" }],
    });
    expect((await videos.loadVideoTopicBySlug("es", "forex", slug))?.noIndex).toBe(false);
    sitemap = await videos.loadVideoSitemapEntries();
    expect(
      sitemap
        .filter((e) => e.path.endsWith(slug))
        .map((e) => e.locale)
        .sort(),
    ).toEqual(["en", "es"]);
  });

  it("a changed link label re-translates a machine topic even from a Spanish save", async () => {
    const { topicId, slug } = await publishedTopic();
    await runner.drainTranslationQueue();
    const en = await ctx.db.videoTopicTranslation.findFirstOrThrow({
      where: { topicId, locale: "en" },
    });
    // The links panel is shared by every locale, so its labels are the
    // English source whichever tab was open.
    await videos.saveVideoTopic(ctx.editor, {
      topicId,
      meta: {},
      translation: { locale: "en", title: en.title, slug, content: en.content },
      videos: [],
      links: [{ label: "Take the quiz", path: "/learn/forex/quizzes" }],
    });
    await runner.drainTranslationQueue();
    const es = await ctx.db.videoTopicTranslation.findFirstOrThrow({
      where: { topicId, locale: "es" },
    });
    expect(es.linkLabels).toEqual({ "Take the quiz": "[es] Take the quiz" });
  });

  it("a person's category save is TRANSLATED", async () => {
    const { categoryId } = await publishedTopic();
    await runner.drainTranslationQueue();
    await videos.saveVideoCategory(ctx.editor, {
      categoryId,
      translation: { locale: "es", name: "Gráficos" },
    });
    expect(
      (
        await ctx.db.videoCategoryTranslation.findFirstOrThrow({
          where: { categoryId, locale: "es" },
        })
      ).translationStatus,
    ).toBe("TRANSLATED");
  });

  it("a translation keeps the English slug; an English rename moves it with a 301 (ADR-181)", async () => {
    const { topicId, categoryId, slug } = await publishedTopic();
    await runner.drainTranslationQueue();
    const categorySlug = (
      await ctx.db.videoCategoryTranslation.findFirstOrThrow({ where: { categoryId, locale: "en" } })
    ).slug;

    await videos.saveVideoTopic(ctx.editor, {
      topicId,
      meta: {},
      translation: { locale: "es", title: "Velas", slug: "velas" },
      videos: [],
      links: [{ label: "Practice quiz", path: "/learn/forex/quizzes" }],
    });
    await videos.saveVideoCategory(ctx.editor, {
      categoryId,
      translation: { locale: "es", name: "Gráficos", slug: "graficos" },
    });
    const esTopic = () =>
      ctx.db.videoTopicTranslation.findFirstOrThrow({ where: { topicId, locale: "es" } });
    const esCategory = () =>
      ctx.db.videoCategoryTranslation.findFirstOrThrow({ where: { categoryId, locale: "es" } });
    expect((await esTopic()).slug).toBe(slug);
    expect((await esCategory()).slug).toBe(categorySlug);

    await videos.saveVideoTopic(ctx.editor, {
      topicId,
      meta: {},
      translation: { locale: "en", title: `Candles ${seq}`, slug: `${slug}-v2` },
      videos: [],
      links: [{ label: "Practice quiz", path: "/learn/forex/quizzes" }],
    });
    await videos.saveVideoCategory(ctx.editor, {
      categoryId,
      translation: { locale: "en", name: `Charting ${seq}`, slug: `${categorySlug}-v2` },
    });

    expect((await esTopic()).slug).toBe(`${slug}-v2`);
    expect((await esCategory()).slug).toBe(`${categorySlug}-v2`);
    await expect(
      ctx.db.redirect.findUniqueOrThrow({
        where: { fromPath: `/es/learn/forex/videos/${slug}` },
      }),
    ).resolves.toMatchObject({ toPath: `/es/learn/forex/videos/${slug}-v2`, statusCode: 301 });
    await expect(
      ctx.db.redirect.findUniqueOrThrow({
        where: { fromPath: `/es/learn/forex/videos/categories/${categorySlug}` },
      }),
    ).resolves.toMatchObject({
      toPath: `/es/learn/forex/videos/categories/${categorySlug}-v2`,
    });
  });
});
