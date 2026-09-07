// Provider conformance suite (ADR-022 Compliance): every registered
// `CollectionProvider` runs through the same contract — `list` honours the
// limit cap and returns a `total`, filters resolve by slug, DRAFT content
// never leaks (the visibility rule is composed from the wrapped service,
// never re-derived), and each article-kind provider is scoped to its own
// kind. Plus the one test ADR-022 names explicitly: the news provider's
// results equal calling `getPublishedArticles` directly for the same
// query — proof it composes rather than re-derives `publicArticleWhere`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Subject } from "@repo/rbac";
import { COLLECTION_LIMIT_MAX } from "@repo/contracts";
import type * as ArticlesModule from "../../articles.ts";
import type * as ContentModule from "../../content.ts";
import type * as PublicArticlesModule from "../../public-articles.ts";
import type * as ProvidersModule from "./index.ts";
import {
  startCmsTestDb,
  stopCmsTestDb,
  type CmsTestContext,
} from "../../test-utils/cms-container.ts";

let ctx: CmsTestContext;
let articles: typeof ArticlesModule;
let content: typeof ContentModule;
let publicArticles: typeof PublicArticlesModule;
let providers: typeof ProvidersModule;
let actor: Subject;

let publishedNewsId: string;
let draftNewsId: string;
let publishedAnalysisId: string;
let publishedTradeIdeaId: string;
let glossaryTermId: string;
let categorySlug: string;
let tagSlug: string;

beforeAll(async () => {
  ctx = await startCmsTestDb();
  articles = await import("../../articles.ts");
  content = await import("../../content.ts");
  publicArticles = await import("../../public-articles.ts");
  providers = await import("./index.ts");

  const user = await ctx.db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: "providers-actor@x.com",
      name: "Providers Actor",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
  actor = {
    id: user.id,
    userType: "STAFF",
    roleKeys: [],
    maxRoleLevel: 60,
    allowed: new Set([
      "news.manage",
      "analysis.view",
      "analysis.create",
      "analysis.update",
      "analysis.delete",
      "analysis.publish",
      "glossary.create",
      "glossary.update",
      "glossary.publish",
    ]),
    denied: new Set(),
  };

  const newsCategoryId = await articles.createArticleCategory(actor, { name: "Market News" });
  const tagId = await articles.createArticleTag(actor, { name: "Majors" });
  const category = await ctx.db.articleCategory.findUniqueOrThrow({
    where: { id: newsCategoryId },
    include: { translations: true },
  });
  categorySlug = category.translations[0]!.slug;
  const tag = await ctx.db.articleTag.findUniqueOrThrow({
    where: { id: tagId },
    include: { translations: true },
  });
  tagSlug = tag.translations[0]!.slug;

  publishedNewsId = await articles.createArticle(actor, {
    kind: "NEWS",
    categoryId: newsCategoryId,
  });
  await articles.saveArticleTranslation(actor, {
    articleId: publishedNewsId,
    locale: "en",
    title: "USD rallies on CPI beat",
    body: "<p>Body</p>",
    excerpt: "Excerpt",
  });
  await articles.updateArticleMeta(actor, publishedNewsId, { tagIds: [tagId] });
  await articles.transitionArticle(actor, publishedNewsId, "PUBLISHED");

  draftNewsId = await articles.createArticle(actor, { kind: "NEWS", categoryId: newsCategoryId });
  await articles.saveArticleTranslation(actor, {
    articleId: draftNewsId,
    locale: "en",
    title: "Unpublished draft",
    body: "<p>Body</p>",
  });

  publishedAnalysisId = await articles.createArticle(actor, {
    kind: "ANALYSIS",
    categoryId: newsCategoryId,
  });
  await articles.saveArticleTranslation(actor, {
    articleId: publishedAnalysisId,
    locale: "en",
    title: "EURUSD technical outlook",
    body: "<p>Body</p>",
  });
  await articles.transitionArticle(actor, publishedAnalysisId, "PUBLISHED");

  publishedTradeIdeaId = await articles.createArticle(actor, {
    kind: "TRADE_IDEA",
    categoryId: newsCategoryId,
  });
  await articles.saveArticleTranslation(actor, {
    articleId: publishedTradeIdeaId,
    locale: "en",
    title: "Long GBPUSD setup",
    body: "<p>Body</p>",
  });
  await articles.transitionArticle(actor, publishedTradeIdeaId, "PUBLISHED");

  glossaryTermId = await content.createGlossaryTerm(actor);
  await content.saveGlossaryTranslation(actor, {
    termId: glossaryTermId,
    locale: "en",
    term: "Pip",
    simpleExplanation: "<p>Smallest price move</p>",
  });
  await content.transitionContentStatus(actor, "glossary", glossaryTermId, "IN_REVIEW");
  await content.transitionContentStatus(actor, "glossary", glossaryTermId, "SEO_REVIEW");
  await content.transitionContentStatus(actor, "glossary", glossaryTermId, "APPROVED");
  await content.transitionContentStatus(actor, "glossary", glossaryTermId, "PUBLISHED");
}, 120_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

function allProviders() {
  return [
    providers.newsProvider,
    providers.analysisProvider,
    providers.tradeIdeaProvider,
    providers.glossaryProvider,
  ];
}

describe("provider conformance (ADR-022 compliance)", () => {
  it("every provider's list() honours the limit cap even when asked for more", async () => {
    for (const provider of allProviders()) {
      const result = await provider.list(
        { contentType: provider.key, bindingId: "main", filter: {}, page: 0, limit: 999 },
        { locale: "en" },
      );
      expect(result.items.length).toBeLessThanOrEqual(COLLECTION_LIMIT_MAX);
    }
  });

  it("every provider's list() returns a numeric total alongside items", async () => {
    for (const provider of allProviders()) {
      const result = await provider.list(
        { contentType: provider.key, bindingId: "main", filter: {}, page: 0, limit: 10 },
        { locale: "en" },
      );
      expect(typeof result.total).toBe("number");
      expect(result.total).toBeGreaterThanOrEqual(result.items.length);
    }
  });

  it("the news provider never returns a DRAFT article — the visibility rule is composed, not bypassed", async () => {
    const result = await providers.newsProvider.list(
      { contentType: "news", bindingId: "main", filter: {}, page: 0, limit: 10 },
      { locale: "en" },
    );
    const ids = result.items.map((i) => i.id);
    expect(ids).not.toContain(draftNewsId);
    expect(ids).toContain(publishedNewsId);
  });

  it("each article-kind provider is scoped to its own kind only", async () => {
    const [news, analysis, tradeIdea] = await Promise.all([
      providers.newsProvider.list(
        { contentType: "news", bindingId: "main", filter: {}, page: 0, limit: 10 },
        { locale: "en" },
      ),
      providers.analysisProvider.list(
        { contentType: "analysis", bindingId: "main", filter: {}, page: 0, limit: 10 },
        { locale: "en" },
      ),
      providers.tradeIdeaProvider.list(
        { contentType: "trade-idea", bindingId: "main", filter: {}, page: 0, limit: 10 },
        { locale: "en" },
      ),
    ]);
    expect(news.items.map((i) => i.id)).toEqual([publishedNewsId]);
    expect(analysis.items.map((i) => i.id)).toEqual([publishedAnalysisId]);
    expect(tradeIdea.items.map((i) => i.id)).toEqual([publishedTradeIdeaId]);
  });

  it("the news provider's category and tag filters resolve by slug and narrow results", async () => {
    const byCategory = await providers.newsProvider.list(
      {
        contentType: "news",
        bindingId: "main",
        filter: { category: categorySlug },
        page: 0,
        limit: 10,
      },
      { locale: "en" },
    );
    expect(byCategory.items.map((i) => i.id)).toEqual([publishedNewsId]);

    const byTag = await providers.newsProvider.list(
      { contentType: "news", bindingId: "main", filter: { tag: tagSlug }, page: 0, limit: 10 },
      { locale: "en" },
    );
    expect(byTag.items.map((i) => i.id)).toEqual([publishedNewsId]);

    const byUnknownCategory = await providers.newsProvider.list(
      {
        contentType: "news",
        bindingId: "main",
        filter: { category: "does-not-exist" },
        page: 0,
        limit: 10,
      },
      { locale: "en" },
    );
    expect(byUnknownCategory.items).toEqual([]);
    expect(byUnknownCategory.total).toBe(0);
  });

  it("the news provider's list() results equal calling getPublishedArticles directly for the same query — it composes, it does not re-derive publicArticleWhere", async () => {
    const direct = await publicArticles.getPublishedArticles("en", {
      kinds: ["NEWS"],
      page: 0,
      perPage: 10,
    });
    const viaProvider = await providers.newsProvider.list(
      { contentType: "news", bindingId: "main", filter: {}, page: 0, limit: 10 },
      { locale: "en" },
    );
    expect(viaProvider.items.map((i) => i.id)).toEqual(direct.entries.map((e) => e.articleId));
    expect(viaProvider.total).toBe(direct.total);
  });

  it("bySlug returns null for a slug that does not exist, and the real item for one that does", async () => {
    for (const provider of allProviders()) {
      if (!provider.bySlug) continue;
      await expect(
        provider.bySlug("this-slug-does-not-exist", { locale: "en" }),
      ).resolves.toBeNull();
    }
    const news = await providers.newsProvider.bySlug!(
      (await ctx.db.articleTranslation.findFirstOrThrow({ where: { articleId: publishedNewsId } }))
        .slug,
      { locale: "en" },
    );
    expect(news?.id).toBe(publishedNewsId);
  });

  it("facets() reflects only published, visible counts", async () => {
    const facets = await providers.newsProvider.facets!({ locale: "en" });
    const category = facets.category?.find((c) => c.value === categorySlug);
    expect(category?.count).toBe(1);
  });

  it("the glossary provider paginates and searches over an already-published-scoped list", async () => {
    const all = await providers.glossaryProvider.list(
      { contentType: "glossary", bindingId: "main", filter: {}, page: 0, limit: 10 },
      { locale: "en" },
    );
    expect(all.items.map((i) => i.id)).toContain(glossaryTermId);

    const searched = await providers.glossaryProvider.list(
      { contentType: "glossary", bindingId: "main", filter: {}, page: 0, limit: 10, q: "pip" },
      { locale: "en" },
    );
    expect(searched.items.map((i) => i.id)).toContain(glossaryTermId);

    const noMatch = await providers.glossaryProvider.list(
      {
        contentType: "glossary",
        bindingId: "main",
        filter: {},
        page: 0,
        limit: 10,
        q: "no-such-term-xyz",
      },
      { locale: "en" },
    );
    expect(noMatch.items).toEqual([]);
  });
});
