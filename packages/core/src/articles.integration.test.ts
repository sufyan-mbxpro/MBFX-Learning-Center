// Module 15 required tests (ADR-015): article transition map + per-kind
// permission gates, schedule-time visibility (query-side scheduler),
// publishDueArticles sweep, XSS sanitize-on-save for article bodies, slug
// change → 301 row on the /news path, the full visibility rule
// (status × isActive × time × category active), category-in-use guard.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type * as ArticlesModule from "./articles.ts";
import type * as MediaModule from "./media.ts";
import type * as PublicArticlesModule from "./public-articles.ts";
import {
  ARTICLE_TRANSITIONS,
  articleKindPermission,
  articlePath,
  assertArticleTransition,
  IllegalArticleTransitionError,
} from "./articles.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let articles: typeof ArticlesModule;
let media: typeof MediaModule;
let publicArticles: typeof PublicArticlesModule;
let editor: Subject; // full news + analysis rights
let analyst: Subject; // analysis.* only — the seeded analyst role's shape
let newsCategoryId: string;

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_test")
    .withUsername("test")
    .withUserPassword("test")
    .start();

  const url = container.getConnectionUri().replace(/^mariadb:/, "mysql:");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = url;
  db = (await import("@repo/db")).db;
  articles = await import("./articles.ts");
  media = await import("./media.ts");
  publicArticles = await import("./public-articles.ts");

  const user = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: "articles-actor@x.com",
      name: "Editor",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
  editor = {
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
    ]),
    denied: new Set(),
  };
  analyst = {
    ...editor,
    allowed: new Set(["analysis.view", "analysis.create", "analysis.update", "analysis.publish"]),
  };

  await db.locale.create({
    data: {
      code: "en",
      name: "English",
      nativeName: "English",
      direction: "LTR",
      isDefault: true,
      isActive: true,
      sortOrder: 1,
    },
  });
  await db.locale.create({
    data: {
      code: "es",
      name: "Spanish",
      nativeName: "Español",
      direction: "LTR",
      isActive: false,
      sortOrder: 2,
      fallbackCode: "en",
    },
  });

  newsCategoryId = await articles.createArticleCategory(editor, { name: "Market News" });
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

// ─── Pure: the lean article machine (ADR-015 #4) ─────────────

describe("article transition map", () => {
  it("allows DRAFT → PUBLISHED directly (no review chain for news)", () => {
    expect(() => assertArticleTransition("DRAFT", "PUBLISHED")).not.toThrow();
    expect(() => assertArticleTransition("DRAFT", "SCHEDULED")).not.toThrow();
  });

  it("has the unpublish loop the shared machine lacks", () => {
    expect(() => assertArticleTransition("PUBLISHED", "DRAFT")).not.toThrow();
    expect(() => assertArticleTransition("ARCHIVED", "DRAFT")).not.toThrow();
  });

  it("keeps the review states unreachable for articles", () => {
    expect(ARTICLE_TRANSITIONS.IN_REVIEW).toEqual([]);
    expect(() => assertArticleTransition("DRAFT", "IN_REVIEW")).toThrow(
      IllegalArticleTransitionError,
    );
    expect(() => assertArticleTransition("SCHEDULED", "ARCHIVED")).toThrow(
      IllegalArticleTransitionError,
    );
  });
});

describe("per-kind permission mapping (ADR-015 #5)", () => {
  it("routes NEWS to news.manage and the analysis kinds to analysis.*", () => {
    expect(articleKindPermission("NEWS", "publish")).toBe("news.manage");
    expect(articleKindPermission("ANALYSIS", "publish")).toBe("analysis.publish");
    expect(articleKindPermission("TRADE_IDEA", "create")).toBe("analysis.create");
  });
});

// ─── DB-backed lifecycle ─────────────────────────────────────

describe("kind-specific gates", () => {
  it("an analyst (no news.manage) cannot create or edit NEWS, but can run analysis end to end", async () => {
    await expect(
      articles.createArticle(analyst, { kind: "NEWS", categoryId: newsCategoryId }),
    ).rejects.toThrow(articles.ArticlePermissionError);

    const id = await articles.createArticle(analyst, {
      kind: "ANALYSIS",
      categoryId: newsCategoryId,
    });
    await articles.saveArticleTranslation(analyst, {
      articleId: id,
      locale: "en",
      title: "EURUSD outlook",
      body: "<p>Levels to watch</p>",
    });
    await articles.transitionArticle(analyst, id, "PUBLISHED");
    const row = await db.article.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("PUBLISHED");
    expect(row.publishedAt).not.toBeNull();

    // Re-kinding an analysis article to NEWS needs rights on the target kind.
    await expect(articles.updateArticleMeta(analyst, id, { kind: "NEWS" })).rejects.toThrow(
      articles.ArticlePermissionError,
    );
  });

  it("publishing requires the kind's publish permission on top of update rights", async () => {
    const id = await articles.createArticle(editor, {
      kind: "ANALYSIS",
      categoryId: newsCategoryId,
    });
    const noPublish: Subject = { ...editor, allowed: new Set(["analysis.update"]) };
    await expect(articles.transitionArticle(noPublish, id, "PUBLISHED")).rejects.toThrow(
      "analysis.publish",
    );
    // The failed attempt must not have written anything.
    expect((await db.article.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");
  });
});

describe("scheduling (ADR-015 #6 — the where-clause is the scheduler)", () => {
  it("rejects scheduling in the past", async () => {
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId: newsCategoryId });
    await expect(
      articles.transitionArticle(editor, id, "SCHEDULED", new Date(Date.now() - 60_000)),
    ).rejects.toThrow(articles.ScheduleInPastError);
  });

  it("a SCHEDULED article is publicly invisible until its time, then visible without any sweep", async () => {
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId: newsCategoryId });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title: "NFP preview",
      body: "<p>Numbers due</p>",
    });
    await articles.transitionArticle(editor, id, "SCHEDULED", new Date(Date.now() + 60 * 60_000));

    const before = await publicArticles.loadPublishedArticles("en", {
      kinds: ["NEWS"],
      page: 0,
      perPage: 50,
    });
    expect(before.entries.map((e) => e.articleId)).not.toContain(id);

    // Time passes (simulated by moving the scheduled moment into the past).
    await db.article.update({
      where: { id },
      data: { scheduledFor: new Date(Date.now() - 60_000) },
    });
    const after = await publicArticles.loadPublishedArticles("en", {
      kinds: ["NEWS"],
      page: 0,
      perPage: 50,
    });
    const entry = after.entries.find((e) => e.articleId === id);
    expect(entry).toBeDefined();
    // Effective publish time is the scheduled one even before the sweep.
    expect(entry?.publishedAt).not.toBeNull();

    // Park the row so the sweep test below counts only its own article.
    await db.article.update({ where: { id }, data: { status: "DRAFT", scheduledFor: null } });
  });

  it("publishDueArticles flips due rows exactly once, stamping publishedAt from scheduledFor", async () => {
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId: newsCategoryId });
    const due = new Date(Date.now() + 30 * 60_000);
    await articles.transitionArticle(editor, id, "SCHEDULED", due);

    expect(await articles.publishDueArticles(new Date(due.getTime() - 1000))).toBe(0);
    expect(await articles.publishDueArticles(new Date(due.getTime() + 1000))).toBe(1);
    expect(await articles.publishDueArticles(new Date(due.getTime() + 2000))).toBe(0);

    const row = await db.article.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("PUBLISHED");
    expect(row.publishedAt?.getTime()).toBe(due.getTime());
    expect(row.scheduledFor).toBeNull();

    // System sweep audits with no user attached.
    const audit = await db.auditLog.findFirst({
      where: { action: "articles.publishDue" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.userId).toBeNull();
  });
});

describe("translation lifecycle", () => {
  it("sanitizes the body ON SAVE — script payloads never reach the row", async () => {
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId: newsCategoryId });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title: "XSS probe",
      body: '<p>ok</p><script>alert("boom")</script><p onclick="x()">click</p>',
    });
    const row = await db.articleTranslation.findUniqueOrThrow({
      where: { articleId_locale: { articleId: id, locale: "en" } },
    });
    expect(row.body).toBe("<p>ok</p><p>click</p>");
  });

  it("slug change writes a 301 Redirect on the /news path", async () => {
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId: newsCategoryId });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title: "Rate decision",
      slug: "rate-decision-old",
      body: "<p>x</p>",
    });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title: "Rate decision",
      slug: "rate-decision-new",
      body: "<p>x</p>",
    });
    const redirect = await db.redirect.findUniqueOrThrow({
      where: { fromPath: articlePath("en", "en", "rate-decision-old") },
    });
    expect(redirect.toPath).toBe("/news/rate-decision-new");
    expect(redirect.statusCode).toBe(301);
  });

  it("EN source edit flips the ES sibling OUTDATED", async () => {
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId: newsCategoryId });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title: "CPI report",
      body: "<p>v1</p>",
    });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "es",
      title: "Informe IPC",
      body: "<p>v1-es</p>",
    });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title: "CPI report",
      body: "<p>v2 corrected</p>",
    });
    const es = await db.articleTranslation.findUniqueOrThrow({
      where: { articleId_locale: { articleId: id, locale: "es" } },
    });
    expect(es.translationStatus).toBe("OUTDATED");
  });
});

describe("ADR-035: media reference wiring (closes ADR-034's usage-guard gap)", () => {
  let assetCounter = 0;
  async function fakeMediaAsset(): Promise<string> {
    assetCounter += 1;
    const asset = await db.mediaAsset.create({
      data: {
        key: `adr035-${assetCounter}-${Date.now().toString(36)}.png`,
        url: `/uploads/adr035-${assetCounter}-${Date.now().toString(36)}.png`,
        fileName: "cover.png",
        mimeType: "image/png",
        size: 1024,
        purpose: "article",
      },
    });
    return asset.id;
  }

  it("updateArticleMeta syncs a MEDIA reference for coverImageAssetId, and clearing it removes the reference", async () => {
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId: newsCategoryId });
    const assetId = await fakeMediaAsset();

    await articles.updateArticleMeta(editor, id, { coverImageAssetId: assetId });
    let refs = await db.contentReference.findMany({
      where: { sourceType: "ARTICLE", sourceId: id, refType: "MEDIA" },
    });
    expect(refs).toHaveLength(1);
    expect(refs[0]?.refId).toBe(assetId);
    expect(refs[0]?.field).toBe("coverImageAssetId");

    // A meta save that doesn't touch the image must not wipe the reference.
    await articles.updateArticleMeta(editor, id, { isPremium: true });
    refs = await db.contentReference.findMany({
      where: { sourceType: "ARTICLE", sourceId: id, refType: "MEDIA" },
    });
    expect(refs).toHaveLength(1);

    // Explicitly clearing the cover image clears the reference.
    await articles.updateArticleMeta(editor, id, { coverImageAssetId: null });
    refs = await db.contentReference.findMany({
      where: { sourceType: "ARTICLE", sourceId: id, refType: "MEDIA" },
    });
    expect(refs).toHaveLength(0);
  });

  it("saveArticleTranslation syncs ogImageAssetId per locale, independent of the article's cover reference", async () => {
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId: newsCategoryId });
    const coverAssetId = await fakeMediaAsset();
    const enOgAssetId = await fakeMediaAsset();
    const esOgAssetId = await fakeMediaAsset();

    await articles.updateArticleMeta(editor, id, { coverImageAssetId: coverAssetId });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title: "Reference wiring",
      body: "<p>x</p>",
      ogImageAssetId: enOgAssetId,
    });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "es",
      title: "Cableado de referencias",
      body: "<p>x</p>",
      ogImageAssetId: esOgAssetId,
    });

    const coverRefs = await db.contentReference.findMany({
      where: { sourceType: "ARTICLE", sourceId: id, refType: "MEDIA" },
    });
    expect(coverRefs.map((r) => r.refId)).toEqual([coverAssetId]);

    const enRefs = await db.contentReference.findMany({
      where: { sourceType: "ARTICLE", sourceId: `${id}:en`, refType: "MEDIA" },
    });
    expect(enRefs.map((r) => r.refId)).toEqual([enOgAssetId]);

    const esRefs = await db.contentReference.findMany({
      where: { sourceType: "ARTICLE", sourceId: `${id}:es`, refType: "MEDIA" },
    });
    expect(esRefs.map((r) => r.refId)).toEqual([esOgAssetId]);
  });

  it("duplicateArticle syncs references for the COPY's id, not the source's", async () => {
    const sourceId = await articles.createArticle(editor, {
      kind: "NEWS",
      categoryId: newsCategoryId,
    });
    const assetId = await fakeMediaAsset();
    await articles.updateArticleMeta(editor, sourceId, { coverImageAssetId: assetId });

    const copyId = await articles.duplicateArticle(editor, sourceId);

    const sourceRefs = await db.contentReference.findMany({
      where: { sourceType: "ARTICLE", sourceId, refType: "MEDIA" },
    });
    const copyRefs = await db.contentReference.findMany({
      where: { sourceType: "ARTICLE", sourceId: copyId, refType: "MEDIA" },
    });
    expect(sourceRefs.map((r) => r.refId)).toEqual([assetId]);
    expect(copyRefs.map((r) => r.refId)).toEqual([assetId]);
    expect(copyId).not.toBe(sourceId);
  });

  it("deleteMedia refuses when an ARTICLE-sourced reference exists, and reports ARTICLE in the count", async () => {
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId: newsCategoryId });
    const assetId = await fakeMediaAsset();
    await articles.updateArticleMeta(editor, id, { coverImageAssetId: assetId });

    await expect(media.deleteMedia(editor.id, assetId)).rejects.toThrow(media.MediaAssetInUseError);

    // Freeing the reference allows the delete to proceed.
    await articles.updateArticleMeta(editor, id, { coverImageAssetId: null });
    await expect(media.deleteMedia(editor.id, assetId)).resolves.toBeUndefined();
  });
});

describe("visibility rule (status × isActive × category × deletion)", () => {
  async function publishedArticle(): Promise<string> {
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId: newsCategoryId });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title: `Visible ${id.slice(-6)}`,
      body: "<p>x</p>",
    });
    await articles.transitionArticle(editor, id, "PUBLISHED");
    return id;
  }

  async function visibleIds(): Promise<string[]> {
    const page = await publicArticles.loadPublishedArticles("en", {
      kinds: ["NEWS", "ANALYSIS", "TRADE_IDEA"],
      page: 0,
      perPage: 100,
    });
    return page.entries.map((e) => e.articleId);
  }

  it("deactivate hides instantly without touching status; reactivate restores", async () => {
    const id = await publishedArticle();
    expect(await visibleIds()).toContain(id);

    await articles.setArticleActive(editor, id, false);
    expect(await visibleIds()).not.toContain(id);
    expect((await db.article.findUniqueOrThrow({ where: { id } })).status).toBe("PUBLISHED");

    await articles.setArticleActive(editor, id, true);
    expect(await visibleIds()).toContain(id);
  });

  it("an inactive category hides all its articles", async () => {
    const categoryId = await articles.createArticleCategory(editor, { name: "Toggling" });
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title: "Category gated",
      body: "<p>x</p>",
    });
    await articles.transitionArticle(editor, id, "PUBLISHED");
    expect(await visibleIds()).toContain(id);

    await articles.updateArticleCategory(editor, categoryId, { isActive: false });
    expect(await visibleIds()).not.toContain(id);
  });

  it("soft-deleted and draft articles resolve to null by slug", async () => {
    const id = await publishedArticle();
    const slugRow = await db.articleTranslation.findUniqueOrThrow({
      where: { articleId_locale: { articleId: id, locale: "en" } },
      select: { slug: true },
    });
    expect(await publicArticles.loadArticleBySlug("en", slugRow.slug)).not.toBeNull();

    await articles.setArticleDeleted(editor, id, true);
    expect(await publicArticles.loadArticleBySlug("en", slugRow.slug)).toBeNull();

    await articles.setArticleDeleted(editor, id, false);
    await articles.transitionArticle(editor, id, "DRAFT");
    expect(await publicArticles.loadArticleBySlug("en", slugRow.slug)).toBeNull();
  });
});

describe("categories & tags", () => {
  it("a category with articles cannot be deleted; an empty one can", async () => {
    const inUse = await articles.createArticleCategory(editor, { name: "In Use" });
    await articles.createArticle(editor, { kind: "NEWS", categoryId: inUse });
    await expect(articles.deleteArticleCategory(editor, inUse)).rejects.toThrow(
      articles.CategoryInUseError,
    );

    const empty = await articles.createArticleCategory(editor, { name: "Empty" });
    await expect(articles.deleteArticleCategory(editor, empty)).resolves.toBeUndefined();
  });

  it("rejects a non-whitelisted featured video URL, accepts YouTube, replaces tags as a set", async () => {
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId: newsCategoryId });
    await expect(
      articles.updateArticleMeta(editor, id, { videoUrl: "https://evil.example.com/v/123" }),
    ).rejects.toThrow(articles.InvalidVideoUrlError);

    const tagA = await articles.createArticleTag(editor, { name: "EUR/USD" });
    const tagB = await articles.createArticleTag(editor, { name: "Fed" });
    await articles.updateArticleMeta(editor, id, {
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
      tagIds: [tagA, tagB],
    });
    await articles.updateArticleMeta(editor, id, { tagIds: [tagB] });

    const detail = await articles.loadArticleAdminDetail(id);
    expect(detail?.videoUrl).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(detail?.tagIds).toEqual([tagB]);
  });
});

// ─── Phase 3 additions (changes-03-plan.md §5.3) ─────────────

describe("free-text search (`q`) — filters, but never widens visibility", () => {
  async function publish(title: string, excerpt?: string): Promise<string> {
    const id = await articles.createArticle(editor, { kind: "NEWS", categoryId: newsCategoryId });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title,
      body: "<p>x</p>",
      ...(excerpt ? { excerpt } : {}),
    });
    await articles.transitionArticle(editor, id, "PUBLISHED");
    return id;
  }

  async function search(q?: string): Promise<string[]> {
    const page = await publicArticles.loadPublishedArticles("en", {
      kinds: ["NEWS", "ANALYSIS", "TRADE_IDEA"],
      page: 0,
      perPage: 100,
      ...(q ? { q } : {}),
    });
    return page.entries.map((e) => e.articleId);
  }

  it("matches on title and on excerpt", async () => {
    const byTitle = await publish("Yen carry trade unwinds");
    const byExcerpt = await publish("Unrelated headline", "A note about the yen carry trade");
    const neither = await publish("Gold holds range");

    const hits = await search("carry trade");
    expect(hits).toContain(byTitle);
    expect(hits).toContain(byExcerpt);
    expect(hits).not.toContain(neither);
  });

  it("a draft matching the query stays invisible — search filters the visible set, it does not bypass it", async () => {
    const draft = await articles.createArticle(editor, {
      kind: "NEWS",
      categoryId: newsCategoryId,
    });
    await articles.saveArticleTranslation(editor, {
      articleId: draft,
      locale: "en",
      title: "Secret unpublished briefing",
      body: "<p>x</p>",
    });
    // Never transitioned — still DRAFT.
    expect(await search("Secret unpublished")).toEqual([]);
  });

  it("a soft-deleted match is excluded too", async () => {
    const id = await publish("Deletable copper outlook");
    expect(await search("Deletable copper")).toContain(id);
    await articles.setArticleDeleted(editor, id, true);
    expect(await search("Deletable copper")).not.toContain(id);
  });

  it("reports the filtered total, so pagination reflects the query", async () => {
    await publish("Uniquetoken alpha");
    const page = await publicArticles.loadPublishedArticles("en", {
      kinds: ["NEWS", "ANALYSIS", "TRADE_IDEA"],
      page: 0,
      perPage: 100,
      q: "Uniquetoken",
    });
    expect(page.total).toBe(1);
    expect(page.pageCount).toBe(1);
  });

  it("omitting `q` is unfiltered — the option is additive", async () => {
    const id = await publish("Baseline listing entry");
    expect(await search()).toContain(id);
  });
});

describe("getArticleFacets — the listing sidebar", () => {
  it("counts only publicly-visible articles per category", async () => {
    const categoryId = await articles.createArticleCategory(editor, { name: "Facet Counting" });
    const published = await articles.createArticle(editor, { kind: "NEWS", categoryId });
    await articles.saveArticleTranslation(editor, {
      articleId: published,
      locale: "en",
      title: "Counted",
      body: "<p>x</p>",
    });
    await articles.transitionArticle(editor, published, "PUBLISHED");

    // A draft in the same category must NOT inflate the count.
    const draft = await articles.createArticle(editor, { kind: "NEWS", categoryId });
    await articles.saveArticleTranslation(editor, {
      articleId: draft,
      locale: "en",
      title: "Not counted",
      body: "<p>x</p>",
    });

    const facets = await publicArticles.loadArticleFacets("en", {
      kinds: ["NEWS", "ANALYSIS", "TRADE_IDEA"],
    });
    const entry = facets.categories.find((c) => c.id === categoryId);
    expect(entry?.name).toBe("Facet Counting");
    expect(entry?.count).toBe(1);
  });

  it("returns archive months newest-first, derived from the EFFECTIVE publish date", async () => {
    const facets = await publicArticles.loadArticleFacets("en", {
      kinds: ["NEWS", "ANALYSIS", "TRADE_IDEA"],
    });
    expect(facets.archives.length).toBeGreaterThan(0);
    const times = facets.archives.map((a) => a.month.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    // Every bucket is the first instant of a UTC month.
    for (const { month } of facets.archives) {
      expect(month.getUTCDate()).toBe(1);
      expect(month.getUTCHours()).toBe(0);
    }
  });

  it("honours latestCount and returns real listing entries", async () => {
    const facets = await publicArticles.loadArticleFacets("en", {
      kinds: ["NEWS", "ANALYSIS", "TRADE_IDEA"],
      latestCount: 2,
    });
    expect(facets.latest.length).toBeLessThanOrEqual(2);
    for (const entry of facets.latest) {
      expect(entry.title).toBeTruthy();
      expect(entry.slug).toBeTruthy();
    }
  });

  it("caps the tag cloud and orders it by popularity", async () => {
    const facets = await publicArticles.loadArticleFacets("en", {
      kinds: ["NEWS", "ANALYSIS", "TRADE_IDEA"],
      tagLimit: 3,
    });
    expect(facets.tags.length).toBeLessThanOrEqual(3);
    const counts = facets.tags.map((t) => t.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe("author byline on listing entries (changes-04 image-10)", () => {
  it("resolves the author's name for cards, and null when an article has none", async () => {
    const authored = await articles.createArticle(editor, {
      kind: "NEWS",
      categoryId: newsCategoryId,
    });
    await articles.saveArticleTranslation(editor, {
      articleId: authored,
      locale: "en",
      title: "Bylined piece",
      body: "<p>x</p>",
    });
    await articles.transitionArticle(editor, authored, "PUBLISHED");
    // createArticle records the acting staff member as the author.
    await db.article.update({ where: { id: authored }, data: { authorId: editor.id } });

    const anonymous = await articles.createArticle(editor, {
      kind: "NEWS",
      categoryId: newsCategoryId,
    });
    await articles.saveArticleTranslation(editor, {
      articleId: anonymous,
      locale: "en",
      title: "Unbylined piece",
      body: "<p>x</p>",
    });
    await articles.transitionArticle(editor, anonymous, "PUBLISHED");
    // Ingested articles carry no author (ADR-015's ingestion-ready column).
    await db.article.update({ where: { id: anonymous }, data: { authorId: null } });

    const page = await publicArticles.loadPublishedArticles("en", {
      kinds: ["NEWS", "ANALYSIS", "TRADE_IDEA"],
      page: 0,
      perPage: 100,
    });
    const withAuthor = page.entries.find((e) => e.articleId === authored);
    const withoutAuthor = page.entries.find((e) => e.articleId === anonymous);

    expect(withAuthor?.authorName).toBe("Editor");
    // Null, not undefined and not a crash — the card simply omits the name.
    expect(withoutAuthor?.authorName).toBeNull();
  });

  it("resolves every distinct author in ONE query, not one per row", async () => {
    // The detail page does a per-article db.user.findUnique; a listing of 48
    // rows must not repeat that. Asserted behaviourally: many rows sharing an
    // author still come back correctly named.
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = await articles.createArticle(editor, {
        kind: "NEWS",
        categoryId: newsCategoryId,
      });
      await articles.saveArticleTranslation(editor, {
        articleId: id,
        locale: "en",
        title: `Batch author ${i}`,
        body: "<p>x</p>",
      });
      await articles.transitionArticle(editor, id, "PUBLISHED");
      await db.article.update({ where: { id }, data: { authorId: editor.id } });
      ids.push(id);
    }

    const page = await publicArticles.loadPublishedArticles("en", {
      kinds: ["NEWS", "ANALYSIS", "TRADE_IDEA"],
      page: 0,
      perPage: 100,
    });
    for (const id of ids) {
      expect(page.entries.find((e) => e.articleId === id)?.authorName).toBe("Editor");
    }
  });
});

// ─── changes-07 PR 3: saveArticle, FAQ, relations, featured, quick edit ───

describe("saveArticle — one transaction, one audit, one revalidation", () => {
  async function draft(kind: "NEWS" | "ANALYSIS" = "ANALYSIS") {
    return articles.createArticle(editor, { kind, categoryId: newsCategoryId });
  }

  it("commits meta and translation together", async () => {
    const id = await draft();
    await articles.saveArticle(editor, {
      articleId: id,
      meta: { isFeatured: true, showRelated: false, relatedCount: 5, isPremium: true },
      translation: {
        articleId: id,
        locale: "en",
        title: "Combined save",
        body: "<p>body</p>",
        focusKeywords: "risk, sizing",
        noFollow: true,
        ogTitle: "OG title",
        twitterCard: "summary_large_image",
      },
    });

    const detail = await articles.loadArticleAdminDetail(id);
    expect(detail).toMatchObject({
      isFeatured: true,
      showRelated: false,
      relatedCount: 5,
      isPremium: true,
    });
    expect(detail?.translations[0]).toMatchObject({
      title: "Combined save",
      focusKeywords: "risk, sizing",
      noFollow: true,
      ogTitle: "OG title",
      twitterCard: "summary_large_image",
    });
  });

  it("writes exactly ONE audit row for the whole save", async () => {
    const id = await draft();
    const before = await db.auditLog.count({ where: { entityId: id } });
    await articles.saveArticle(editor, {
      articleId: id,
      meta: { isFeatured: true },
      translation: { articleId: id, locale: "en", title: "Audited once" },
    });
    const after = await db.auditLog.count({ where: { entityId: id } });
    expect(after - before).toBe(1);
  });

  it("is ATOMIC — a failure mid-save persists neither half", async () => {
    const id = await draft();
    await articles.saveArticle(editor, {
      articleId: id,
      meta: { isFeatured: false },
      translation: { articleId: id, locale: "en", title: "Original title" },
    });

    // A non-existent category id violates the FK on `articles.categoryId`, so
    // the meta write fails while the translation write in the SAME transaction
    // has already run — exactly the interleaving that would leave a half-saved
    // article if these were two separate service calls.
    await expect(
      articles.saveArticle(editor, {
        articleId: id,
        meta: { categoryId: "does-not-exist-fk" },
        translation: { articleId: id, locale: "en", title: "Should not persist" },
      }),
    ).rejects.toThrow();

    const detail = await articles.loadArticleAdminDetail(id);
    expect(detail?.translations[0]?.title).toBe("Original title");
    expect(detail?.isFeatured).toBe(false);
  });

  it("denies a subject without rights on the article's kind", async () => {
    const id = await draft("NEWS");
    await expect(
      articles.saveArticle(analyst, {
        articleId: id,
        meta: {},
        translation: { articleId: id, locale: "en", title: "nope" },
      }),
    ).rejects.toThrow(/news\.manage/);
    // Denial asserted at the DB level, not just by the thrown error.
    const detail = await articles.loadArticleAdminDetail(id);
    expect(detail?.translations).toHaveLength(0);
  });

  it("writes the 301 redirect when the slug changes, same as a translation save", async () => {
    const id = await draft();
    await articles.saveArticle(editor, {
      articleId: id,
      meta: {},
      translation: { articleId: id, locale: "en", title: "First title", slug: "first-slug" },
    });
    await articles.saveArticle(editor, {
      articleId: id,
      meta: {},
      translation: { articleId: id, locale: "en", title: "First title", slug: "second-slug" },
    });
    const redirect = await db.redirect.findUnique({
      where: { fromPath: articlePath("en", "en", "first-slug") },
    });
    expect(redirect).toMatchObject({
      toPath: articlePath("en", "en", "second-slug"),
      statusCode: 301,
    });
  });
});

describe("FAQ items", () => {
  // Each host needs its OWN title: slug is derived from it and
  // (locale, slug) is unique, so a shared fixture title collides.
  async function withFaq(
    title: string,
    items: { id?: string; question: string; answer: string }[],
  ) {
    const id = await articles.createArticle(editor, {
      kind: "ANALYSIS",
      categoryId: newsCategoryId,
    });
    await articles.saveArticle(editor, {
      articleId: id,
      meta: {},
      translation: { articleId: id, locale: "en", title, faqItems: items },
    });
    return id;
  }

  it("stores items in array order", async () => {
    const id = await withFaq("FAQ order host", [
      { question: "First?", answer: "<p>one</p>" },
      { question: "Second?", answer: "<p>two</p>" },
    ]);
    const detail = await articles.loadArticleAdminDetail(id);
    expect(detail?.translations[0]?.faqItems.map((f) => f.question)).toEqual(["First?", "Second?"]);
  });

  it("SANITIZES answers on save — a script tag never reaches the database", async () => {
    const id = await withFaq("FAQ xss host", [
      {
        question: "XSS?",
        answer: "<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>",
      },
    ]);
    const stored = await db.articleFaqItem.findFirst({
      where: { translation: { articleId: id } },
    });
    expect(stored?.answer).not.toContain("<script");
    expect(stored?.answer).not.toContain("onerror");
    expect(stored?.answer).toContain("<p>ok</p>");
  });

  it("replaces the whole list — removed items are deleted", async () => {
    const id = await withFaq("FAQ replace host", [
      { question: "Keep?", answer: "<p>a</p>" },
      { question: "Drop?", answer: "<p>b</p>" },
    ]);
    const before = await articles.loadArticleAdminDetail(id);
    const keepId = before?.translations[0]?.faqItems[0]?.id;

    await articles.saveArticle(editor, {
      articleId: id,
      meta: {},
      translation: {
        articleId: id,
        locale: "en",
        title: "FAQ replace host",
        faqItems: [{ id: keepId, question: "Keep, renamed?", answer: "<p>a2</p>" }],
      },
    });

    const after = await articles.loadArticleAdminDetail(id);
    expect(after?.translations[0]?.faqItems).toHaveLength(1);
    // The kept row keeps its identity rather than being deleted and recreated.
    expect(after?.translations[0]?.faqItems[0]?.id).toBe(keepId);
    expect(after?.translations[0]?.faqItems[0]?.question).toBe("Keep, renamed?");
  });

  it("omitting faqItems entirely leaves the stored list untouched", async () => {
    const id = await withFaq("FAQ untouched host", [
      { question: "Survives?", answer: "<p>yes</p>" },
    ]);
    await articles.saveArticle(editor, {
      articleId: id,
      meta: {},
      translation: { articleId: id, locale: "en", title: "FAQ untouched host" },
    });
    const after = await articles.loadArticleAdminDetail(id);
    expect(after?.translations[0]?.faqItems).toHaveLength(1);
  });

  it("cascades when the article is deleted", async () => {
    const id = await withFaq("FAQ cascade host", [{ question: "Cascade?", answer: "<p>y</p>" }]);
    await db.article.delete({ where: { id } });
    const orphans = await db.articleFaqItem.count({ where: { translation: { articleId: id } } });
    expect(orphans).toBe(0);
  });
});

describe("related articles (ContentRelation reuse)", () => {
  async function published(title: string) {
    const id = await articles.createArticle(editor, {
      kind: "ANALYSIS",
      categoryId: newsCategoryId,
    });
    await articles.saveArticleTranslation(editor, { articleId: id, locale: "en", title });
    await articles.transitionArticle(editor, id, "PUBLISHED");
    return id;
  }

  it("stores curated ids in order and reads them back", async () => {
    const a = await published("Rel A");
    const b = await published("Rel B");
    const c = await published("Rel C");
    const host = await published("Rel host");
    await articles.saveArticle(editor, {
      articleId: host,
      meta: { relatedArticleIds: [c, a, b] },
      translation: { articleId: host, locale: "en", title: "Rel host" },
    });
    const detail = await articles.loadArticleAdminDetail(host);
    expect(detail?.relatedArticleIds).toEqual([c, a, b]);
  });

  it("is idempotent and drops removed targets", async () => {
    const a = await published("Idem A");
    const b = await published("Idem B");
    const host = await published("Idem host");
    const save = (ids: string[]) =>
      articles.saveArticle(editor, {
        articleId: host,
        meta: { relatedArticleIds: ids },
        translation: { articleId: host, locale: "en", title: "Idem host" },
      });

    await save([a, b]);
    await save([a, b]);
    expect(await db.contentRelation.count({ where: { sourceId: host } })).toBe(2);

    await save([b]);
    expect((await articles.loadArticleAdminDetail(host))?.relatedArticleIds).toEqual([b]);
  });

  it("drops a self-reference rather than failing the save", async () => {
    const host = await published("Self host");
    const other = await published("Self other");
    await articles.saveArticle(editor, {
      articleId: host,
      meta: { relatedArticleIds: [host, other] },
      translation: { articleId: host, locale: "en", title: "Self host" },
    });
    expect((await articles.loadArticleAdminDetail(host))?.relatedArticleIds).toEqual([other]);
  });

  it("NEVER returns a non-public curated pick (the frozen visibility rule)", async () => {
    const visible = await published("Curated visible");
    const draftPick = await articles.createArticle(editor, {
      kind: "ANALYSIS",
      categoryId: newsCategoryId,
    });
    await articles.saveArticleTranslation(editor, {
      articleId: draftPick,
      locale: "en",
      title: "Curated draft",
    });
    const deactivated = await published("Curated deactivated");
    await articles.setArticleActive(editor, deactivated, false);
    const deleted = await published("Curated deleted");
    await articles.setArticleDeleted(editor, deleted, true);

    const host = await published("Visibility host");
    await articles.saveArticle(editor, {
      articleId: host,
      meta: { relatedArticleIds: [draftPick, deactivated, deleted, visible] },
      translation: { articleId: host, locale: "en", title: "Visibility host" },
    });

    const shown = await publicArticles.loadCuratedRelatedArticles(host, "en", 10);
    expect(shown.map((e) => e.articleId)).toEqual([visible]);
  });

  it("respects the editor's order and the limit", async () => {
    const a = await published("Ord A");
    const b = await published("Ord B");
    const c = await published("Ord C");
    const host = await published("Ord host");
    await articles.saveArticle(editor, {
      articleId: host,
      meta: { relatedArticleIds: [c, b, a] },
      translation: { articleId: host, locale: "en", title: "Ord host" },
    });
    const shown = await publicArticles.loadCuratedRelatedArticles(host, "en", 2);
    expect(shown.map((e) => e.articleId)).toEqual([c, b]);
  });

  it("returns nothing when nothing is curated, so the caller can fall back", async () => {
    const host = await published("Uncurated");
    expect(await publicArticles.loadCuratedRelatedArticles(host, "en", 3)).toEqual([]);
  });
});

describe("setArticleFeatured", () => {
  it("toggles the flag and audits it", async () => {
    const id = await articles.createArticle(editor, {
      kind: "ANALYSIS",
      categoryId: newsCategoryId,
    });
    await articles.setArticleFeatured(editor, id, true);
    expect((await articles.loadArticleAdminDetail(id))?.isFeatured).toBe(true);
    await articles.setArticleFeatured(editor, id, false);
    expect((await articles.loadArticleAdminDetail(id))?.isFeatured).toBe(false);

    const audits = await db.auditLog.count({
      where: { entityId: id, action: "articles.setFeatured" },
    });
    expect(audits).toBe(2);
  });

  it("denies a subject holding only the OTHER kind's permission", async () => {
    const id = await articles.createArticle(editor, {
      kind: "NEWS",
      categoryId: newsCategoryId,
    });
    await expect(articles.setArticleFeatured(analyst, id, true)).rejects.toThrow(/news\.manage/);
    expect((await articles.loadArticleAdminDetail(id))?.isFeatured).toBe(false);
  });
});

describe("quickUpdateArticle", () => {
  it("updates title, slug, category and featured without opening the editor", async () => {
    const id = await articles.createArticle(editor, {
      kind: "ANALYSIS",
      categoryId: newsCategoryId,
    });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title: "Quick original",
      slug: "quick-original",
    });
    const otherCategory = await articles.createArticleCategory(editor, { name: "Quick Cat" });

    await articles.quickUpdateArticle(editor, id, {
      title: "Quick renamed",
      slug: "quick-renamed",
      categoryId: otherCategory,
      isFeatured: true,
    });

    const detail = await articles.loadArticleAdminDetail(id);
    expect(detail).toMatchObject({ categoryId: otherCategory, isFeatured: true });
    expect(detail?.translations[0]).toMatchObject({
      title: "Quick renamed",
      slug: "quick-renamed",
    });
  });

  it("STILL writes the 301 redirect on a slug change", async () => {
    const id = await articles.createArticle(editor, {
      kind: "ANALYSIS",
      categoryId: newsCategoryId,
    });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title: "Quick redirect",
      slug: "quick-redirect-old",
    });
    await articles.quickUpdateArticle(editor, id, { slug: "quick-redirect-new" });

    const redirect = await db.redirect.findUnique({
      where: { fromPath: articlePath("en", "en", "quick-redirect-old") },
    });
    expect(redirect).toMatchObject({
      toPath: articlePath("en", "en", "quick-redirect-new"),
      statusCode: 301,
    });
  });

  it("denies a subject without rights on the article's kind", async () => {
    const id = await articles.createArticle(editor, {
      kind: "NEWS",
      categoryId: newsCategoryId,
    });
    await articles.saveArticleTranslation(editor, {
      articleId: id,
      locale: "en",
      title: "Quick denied",
    });
    await expect(articles.quickUpdateArticle(analyst, id, { title: "hacked" })).rejects.toThrow(
      /news\.manage/,
    );
    const detail = await articles.loadArticleAdminDetail(id);
    expect(detail?.translations[0]?.title).toBe("Quick denied");
  });
});
