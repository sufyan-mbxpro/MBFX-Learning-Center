// Phase 5, the glossary on a real MariaDB with Google faked (MSW): a term and
// a topic are translated by the engine; the public pages serve machine words
// `noindex`, keep them out of the sitemap and out of hreflang until a person
// saves; and a machine-written term is never used to substitute the site's
// wording into other translations.
import { ContentStatus } from "@repo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  startTranslationTestDb,
  useFakeGoogle,
  type TranslationTestContext,
} from "./test-utils/translation-container.ts";
import type * as ContentModule from "./content.ts";
import type * as TopicsModule from "./glossary-topics.ts";
import type * as PublicContentModule from "./public-content.ts";
import type * as RunnerModule from "./translation-runner.ts";
import type * as ArticleTranslationModule from "./article-translation.ts";

let ctx: TranslationTestContext;
let content: typeof ContentModule;
let topics: typeof TopicsModule;
let publicContent: typeof PublicContentModule;
let runner: typeof RunnerModule;
let articleTranslation: typeof ArticleTranslationModule;

beforeAll(async () => {
  ctx = await startTranslationTestDb("mbfx_glossary_translation", [
    "glossary.create",
    "glossary.update",
    "glossary.publish",
  ]);
  content = await import("./content.ts");
  topics = await import("./glossary-topics.ts");
  publicContent = await import("./public-content.ts");
  runner = await import("./translation-runner.ts");
  articleTranslation = await import("./article-translation.ts");
}, 180_000);

afterAll(async () => {
  await ctx?.stop();
});

beforeEach(() => {
  useFakeGoogle(ctx.server);
});

let seq = 0;

async function publishedTerm() {
  seq += 1;
  const termId = await content.createGlossaryTerm(ctx.editor);
  await content.saveGlossaryTerm(ctx.editor, {
    termId,
    meta: {},
    translation: {
      locale: "en",
      term: `Margin ${seq}`,
      simpleExplanation: "<p>Money set aside to hold a trade.</p>",
      exampleScenario: "<p>With 1:100 leverage you post 1% as margin.</p>",
      faq: [{ question: "Is margin a fee?", answer: "No, it is returned." }],
      seoTitle: `Margin ${seq} explained`,
    },
  });
  await content.transitionContentStatus(ctx.editor, "glossary", termId, ContentStatus.PUBLISHED);
  const en = await ctx.db.glossaryTermTranslation.findFirstOrThrow({
    where: { termId, locale: "en" },
  });
  return { termId, slug: en.slug };
}

describe("glossary terms", () => {
  it("translates every field, reusing the English slug", async () => {
    const { termId, slug } = await publishedTerm();
    await runner.drainTranslationQueue();
    const es = await ctx.db.glossaryTermTranslation.findFirstOrThrow({
      where: { termId, locale: "es" },
    });
    expect(es).toMatchObject({
      term: `[es] Margin ${seq}`,
      slug,
      seoTitle: `[es] Margin ${seq} explained`,
      translationStatus: "MACHINE_TRANSLATED",
      detailedExplanation: null,
    });
    expect(es.simpleExplanation).toContain("[es]");
    expect(es.faq).toEqual([
      { question: "[es] Is margin a fee?", answer: "[es] No, it is returned." },
    ]);
  });

  it("is served noindex and left out of the sitemap until a person saves it", async () => {
    const { termId, slug } = await publishedTerm();
    await runner.drainTranslationQueue();

    expect((await publicContent.loadGlossaryTermBySlug("es", slug))?.noIndex).toBe(true);
    expect((await publicContent.loadGlossaryTermBySlug("en", slug))?.noIndex).toBe(false);
    let sitemap = await publicContent.loadGlossarySitemapEntries();
    expect(sitemap.filter((e) => e.slug === slug).map((e) => e.locale)).toEqual(["en"]);

    await content.saveGlossaryTerm(ctx.editor, {
      termId,
      meta: {},
      translation: {
        locale: "es",
        term: "Margen",
        slug,
        simpleExplanation: "<p>Dinero reservado. With 1:100 leverage.</p>",
      },
    });
    const view = await publicContent.loadGlossaryTermBySlug("es", slug);
    expect(view?.noIndex).toBe(false);
    expect(view?.alternates.map((a) => a.locale).sort()).toEqual(["en", "es"]);
    sitemap = await publicContent.loadGlossarySitemapEntries();
    expect(
      sitemap
        .filter((e) => e.slug === slug)
        .map((e) => e.locale)
        .sort(),
    ).toEqual(["en", "es"]);
  });

  it("uses only a person's term for glossary substitution, never a machine one", async () => {
    const { termId } = await publishedTerm();
    await runner.drainTranslationQueue();
    const machinePairs = await articleTranslation.loadGlossaryPairs("es", "en");
    expect(machinePairs.find((p) => p.source === `Margin ${seq}`)).toBeUndefined();

    const es = await ctx.db.glossaryTermTranslation.findFirstOrThrow({
      where: { termId, locale: "es" },
    });
    await content.saveGlossaryTerm(ctx.editor, {
      termId,
      meta: {},
      translation: {
        locale: "es",
        term: "Margen",
        slug: es.slug,
        simpleExplanation: es.simpleExplanation,
      },
    });
    const humanPairs = await articleTranslation.loadGlossaryPairs("es", "en");
    expect(humanPairs).toContainEqual({ source: `Margin ${seq}`, target: "Margen" });
  });

  it("an English FAQ edit refreshes a machine term and flags a person's", async () => {
    const machine = await publishedTerm();
    const human = await publishedTerm();
    await runner.drainTranslationQueue();
    const humanEs = await ctx.db.glossaryTermTranslation.findFirstOrThrow({
      where: { termId: human.termId, locale: "es" },
    });
    await content.saveGlossaryTerm(ctx.editor, {
      termId: human.termId,
      meta: {},
      translation: {
        locale: "es",
        term: "Margen revisado",
        slug: humanEs.slug,
        simpleExplanation: humanEs.simpleExplanation,
      },
    });

    for (const { termId } of [machine, human]) {
      const en = await ctx.db.glossaryTermTranslation.findFirstOrThrow({
        where: { termId, locale: "en" },
      });
      await content.saveGlossaryTerm(ctx.editor, {
        termId,
        meta: {},
        translation: {
          locale: "en",
          term: en.term,
          slug: en.slug,
          simpleExplanation: en.simpleExplanation,
          exampleScenario: en.exampleScenario,
          faq: [{ question: "Is margin a fee?", answer: "No. It is a deposit." }],
        },
      });
    }
    await runner.drainTranslationQueue();

    const machineEs = await ctx.db.glossaryTermTranslation.findFirstOrThrow({
      where: { termId: machine.termId, locale: "es" },
    });
    expect(machineEs.translationStatus).toBe("MACHINE_TRANSLATED");
    expect(machineEs.faq).toEqual([
      { question: "[es] Is margin a fee?", answer: "[es] No. It is a deposit." },
    ]);
    expect(
      (
        await ctx.db.glossaryTermTranslation.findFirstOrThrow({
          where: { termId: human.termId, locale: "es" },
        })
      ).translationStatus,
    ).toBe("OUTDATED");
  });
});

describe("glossary topics", () => {
  it("translates a topic; a person's save over it is TRANSLATED and indexable", async () => {
    const topicId = await topics.createGlossaryTopic(ctx.editor, "Risk management");
    const { termId } = await publishedTerm();
    await topics.setGlossaryTermTopic(ctx.editor, termId, topicId);
    await runner.drainTranslationQueue();

    const es = await ctx.db.glossaryTopicTranslation.findFirstOrThrow({
      where: { topicId, locale: "es" },
    });
    expect(es).toMatchObject({
      name: "[es] Risk management",
      translationStatus: "MACHINE_TRANSLATED",
    });
    let view = await topics.loadGlossaryTopicBySlug("es", es.slug);
    expect(view?.noIndex).toBe(true);
    expect(view?.alternates.map((a) => a.locale)).toEqual(["en"]);
    let sitemap = await topics.loadGlossaryTopicSitemapEntries();
    expect(sitemap.filter((e) => e.path.endsWith(es.slug)).map((e) => e.locale)).toEqual(["en"]);

    await topics.saveGlossaryTopic(ctx.editor, {
      topicId,
      locale: "es",
      name: "Gestión del riesgo",
      slug: es.slug,
    });
    expect(
      (await ctx.db.glossaryTopicTranslation.findFirstOrThrow({ where: { topicId, locale: "es" } }))
        .translationStatus,
    ).toBe("TRANSLATED");
    view = await topics.loadGlossaryTopicBySlug("es", es.slug);
    expect(view?.noIndex).toBe(false);
    sitemap = await topics.loadGlossaryTopicSitemapEntries();
    expect(
      sitemap
        .filter((e) => e.path.endsWith(es.slug))
        .map((e) => e.locale)
        .sort(),
    ).toEqual(["en", "es"]);
  });

  it("a translation keeps the English slug; an English rename moves it with a 301 (ADR-181)", async () => {
    const topicId = await topics.createGlossaryTopic(ctx.editor, "Order types adr181");
    const enSlug = (
      await ctx.db.glossaryTopicTranslation.findFirstOrThrow({ where: { topicId, locale: "en" } })
    ).slug;
    await topics.saveGlossaryTopic(ctx.editor, {
      topicId,
      locale: "es",
      name: "Tipos de orden",
      slug: "tipos-de-orden",
    });
    const es = () =>
      ctx.db.glossaryTopicTranslation.findFirstOrThrow({ where: { topicId, locale: "es" } });
    expect((await es()).slug).toBe(enSlug);

    await topics.saveGlossaryTopic(ctx.editor, {
      topicId,
      locale: "en",
      name: "Order types adr181",
      slug: `${enSlug}-v2`,
    });
    expect((await es()).slug).toBe(`${enSlug}-v2`);
    await expect(
      ctx.db.redirect.findUniqueOrThrow({ where: { fromPath: `/es/glossary/topics/${enSlug}` } }),
    ).resolves.toMatchObject({ toPath: `/es/glossary/topics/${enSlug}-v2`, statusCode: 301 });
    await expect(
      ctx.db.redirect.findUniqueOrThrow({ where: { fromPath: `/glossary/topics/${enSlug}` } }),
    ).resolves.toMatchObject({ toPath: `/glossary/topics/${enSlug}-v2` });
  });
});
