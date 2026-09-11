// News & Analysis article services (Module 15, ADR-015). Same discipline as
// content.ts: sanitize-on-save (security.md #8), slug change → Redirect row,
// sourceHash freshness, audit on every mutation, `content` tag revalidation.
//
// Permission model (ADR-015 #5): the calling action gates on the base key
// (`requireAnyPermission(["analysis.view","news.manage"])` etc.); the
// KIND-specific gate lives here because it depends on the row being touched —
// NEWS articles need `news.manage`, ANALYSIS/TRADE_IDEA need `analysis.*`.
// Same conditional-gate precedent as content.ts's publish check.
import { revalidateTag } from "next/cache";
import { ArticleKind, ContentStatus, TranslationStatus, db, type Prisma } from "@repo/db";
import { computeSourceHash, isTranslationOutdated } from "@repo/i18n";
import { can, type Subject } from "@repo/rbac";
import { parseVideoUrl } from "@repo/utils";
import { syncReferences } from "./cms/references.ts";
import { ARTICLE, RELATED, loadRelationTargets, replaceRelations } from "./content-relations.ts";
import type {
  ArticleFaqItemInput,
  CreateArticleCategoryInput,
  CreateArticleInput,
  CreateArticleTagInput,
  QuickEditArticleInput,
  SaveArticleCategoryTranslationInput,
  SaveArticleInput,
  SaveArticleTagTranslationInput,
  SaveArticleTranslationInput,
  UpdateArticleCategoryInput,
  UpdateArticleMetaInput,
} from "@repo/contracts";
import { recordAudit } from "./index.ts";
import {
  PublishPermissionError,
  ScheduleInPastError,
  sanitizeRichText,
  slugify,
} from "./content.ts";
// ADR-071 moved the class to content.ts when the other five entities gained a
// schedule. Re-exported so every existing importer — and the integration
// suite, which reaches it as `articles.ScheduleInPastError` — is unchanged.
export { ScheduleInPastError };

// ─── Transition map (ADR-015 #4) ─────────────────────────────

/**
 * Leaner than CONTENT_TRANSITIONS: news is time-sensitive, so the review
 * states are unused and DRAFT can go straight to SCHEDULED/PUBLISHED —
 * guarded by the kind's publish permission instead of a review chain.
 * PUBLISHED → DRAFT is the unpublish loop the other entities don't have.
 */
export const ARTICLE_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: [ContentStatus.SCHEDULED, ContentStatus.PUBLISHED, ContentStatus.ARCHIVED],
  SCHEDULED: [ContentStatus.DRAFT, ContentStatus.PUBLISHED],
  PUBLISHED: [ContentStatus.DRAFT, ContentStatus.ARCHIVED],
  ARCHIVED: [ContentStatus.DRAFT],
  // Unused for articles — no way in, no way out.
  IN_REVIEW: [],
  SEO_REVIEW: [],
  APPROVED: [],
};

export class IllegalArticleTransitionError extends Error {
  constructor(from: ContentStatus, to: ContentStatus) {
    super(`Illegal article transition: ${from} → ${to}`);
    this.name = "IllegalArticleTransitionError";
  }
}

export class ArticlePermissionError extends Error {
  constructor(permission: string) {
    super(`This article requires ${permission}`);
    this.name = "ArticlePermissionError";
  }
}

export class InvalidVideoUrlError extends Error {
  constructor() {
    super("Video URL is not from a whitelisted provider (YouTube, Vimeo, Dailymotion)");
    this.name = "InvalidVideoUrlError";
  }
}

export class CategoryInUseError extends Error {
  constructor(count: number) {
    super(`Category still has ${count} article(s) — reassign them first`);
    this.name = "CategoryInUseError";
  }
}

export function assertArticleTransition(from: ContentStatus, to: ContentStatus): void {
  if (!ARTICLE_TRANSITIONS[from]?.includes(to)) throw new IllegalArticleTransitionError(from, to);
}

/** ADR-015 #5: NEWS rides the single `news.manage` key; the other kinds use the granular `analysis.*` set. */
export function articleKindPermission(
  kind: ArticleKind,
  verb: "create" | "update" | "delete" | "publish",
): string {
  return kind === ArticleKind.NEWS ? "news.manage" : `analysis.${verb}`;
}

function assertKindPermission(
  actor: Subject,
  kind: ArticleKind,
  verb: "create" | "update" | "delete" | "publish",
): void {
  const permission = articleKindPermission(kind, verb);
  if (!can(actor, permission)) throw new ArticlePermissionError(permission);
}

// ─── Public path shapes (one place, like glossaryTermPath) ───

export function articlePath(locale: string, defaultLocale: string, slug: string): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/news/${slug}`;
}

export function articleCategoryPath(locale: string, defaultLocale: string, slug: string): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/news/category/${slug}`;
}

export function articleTagPath(locale: string, defaultLocale: string, slug: string): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/news/tag/${slug}`;
}

async function defaultLocaleCode(): Promise<string> {
  return (
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en"
  );
}

async function createSlugRedirect(
  fromPath: string,
  toPath: string,
  actorId: string,
): Promise<void> {
  if (fromPath === toPath) return;
  await db.redirect.upsert({
    where: { fromPath },
    update: { toPath, isActive: true },
    create: { fromPath, toPath, statusCode: 301, createdBy: actorId },
  });
}

// ─── Article lifecycle ───────────────────────────────────────

export async function createArticle(actor: Subject, input: CreateArticleInput): Promise<string> {
  assertKindPermission(actor, input.kind, "create");
  const article = await db.article.create({
    data: { kind: input.kind, categoryId: input.categoryId, authorId: actor.id },
  });
  await recordAudit({
    userId: actor.id,
    action: "articles.create",
    entityType: "article",
    entityId: article.id,
    changes: { after: { kind: input.kind, categoryId: input.categoryId } },
  });
  return article.id;
}

export async function updateArticleMeta(
  actor: Subject,
  articleId: string,
  input: UpdateArticleMetaInput,
): Promise<void> {
  const current = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    select: { kind: true },
  });
  assertKindPermission(actor, current.kind, "update");
  // Re-kinding NEWS ↔ ANALYSIS also needs rights on the TARGET kind.
  if (input.kind && input.kind !== current.kind) {
    assertKindPermission(actor, input.kind, "update");
  }
  // Featured video: whitelist-validated here, not just shaped (ADR-015 #9).
  if (input.videoUrl && parseVideoUrl(input.videoUrl) === null) {
    throw new InvalidVideoUrlError();
  }

  await db.$transaction((tx) => applyArticleMeta(tx, articleId, input));
  const { tagIds, relatedArticleIds, ...meta } = input;
  await recordAudit({
    userId: actor.id,
    action: "articles.updateMeta",
    entityType: "article",
    entityId: articleId,
    changes: {
      after: {
        ...meta,
        ...(tagIds ? { tagIds } : {}),
        ...(relatedArticleIds ? { relatedArticleIds } : {}),
      },
    },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * The transactional body of a meta save, without gating, audit or
 * revalidation — so `saveArticle` can commit it in the SAME transaction as a
 * translation save instead of running two (changes-07 §4.2). Callers own the
 * gate; this function assumes it already passed.
 */
async function applyArticleMeta(
  tx: Prisma.TransactionClient,
  articleId: string,
  input: UpdateArticleMetaInput,
): Promise<void> {
  const { tagIds, relatedArticleIds, ...meta } = input;
  const updated = await tx.article.update({ where: { id: articleId }, data: meta });

  if (tagIds) {
    await tx.articleTagAssignment.deleteMany({ where: { articleId } });
    if (tagIds.length > 0) {
      await tx.articleTagAssignment.createMany({
        data: tagIds.map((tagId) => ({ articleId, tagId })),
      });
    }
  }

  // Related posts live in ContentRelation, not a column (changes-07 §3).
  if (relatedArticleIds) {
    await replaceRelations(tx, {
      sourceType: ARTICLE,
      sourceId: articleId,
      targetType: ARTICLE,
      relationType: RELATED,
      targetIds: relatedArticleIds,
    });
  }

  // ADR-035: sync from the row's resulting value, not the raw input, so a
  // meta save that doesn't touch an image can't wipe its reference. Both the
  // cover and the (changes-07) header image are tracked under this one
  // sourceId, each tagged with its own field name.
  await syncReferences(
    tx,
    { sourceType: "ARTICLE", sourceId: articleId },
    [
      updated.coverImageAssetId
        ? {
            refType: "MEDIA" as const,
            refId: updated.coverImageAssetId,
            field: "coverImageAssetId",
          }
        : null,
      updated.headerImageAssetId
        ? {
            refType: "MEDIA" as const,
            refId: updated.headerImageAssetId,
            field: "headerImageAssetId",
          }
        : null,
    ].filter((r) => r !== null),
  );
}

/**
 * Same lifecycle as saveGlossaryTranslation: sanitize on save, slug change
 * → 301 Redirect row for the old /news path, default-locale edits flip
 * stale sibling translations OUTDATED.
 */
export async function saveArticleTranslation(
  actor: Subject,
  input: SaveArticleTranslationInput,
): Promise<void> {
  const article = await db.article.findUniqueOrThrow({
    where: { id: input.articleId },
    select: { kind: true },
  });
  assertKindPermission(actor, article.kind, "update");

  const defaultLocale = await defaultLocaleCode();
  const prepared = await prepareArticleTranslation(actor, input, defaultLocale);
  await db.$transaction((tx) => applyArticleTranslation(tx, input, prepared));
  await finishArticleTranslation(actor, input, prepared, defaultLocale);

  const slug = prepared.slug;
  await recordAudit({
    userId: actor.id,
    action: "articles.saveTranslation",
    entityType: "articleTranslation",
    entityId: `${input.articleId}:${input.locale}`,
    changes: { after: { title: input.title, slug, locale: input.locale } },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * A translation save split into three pieces so `saveArticle` can put the
 * middle one inside a shared transaction (changes-07 §4.2):
 *
 *   prepare — reads and pure computation (sanitize, slug, hashes). No writes.
 *   apply   — every write, transactional.
 *   finish  — the after-effects that are deliberately NOT in the transaction:
 *             the 301 redirect row and the sibling-OUTDATED sweep.
 *
 * Keeping finish outside preserves the pre-existing behaviour exactly: a
 * failure to write a redirect has never rolled back a saved translation, and
 * changing that inside a refactor would be a silent behavioural change.
 */
interface PreparedTranslation {
  slug: string;
  isSource: boolean;
  previousSlug: string | null;
  sourceHash: string | null;
  fields: Prisma.ArticleTranslationCreateWithoutArticleInput;
  faqItems: ArticleFaqItemInput[] | undefined;
}

async function prepareArticleTranslation(
  actor: Subject,
  input: SaveArticleTranslationInput,
  defaultLocale: string,
): Promise<PreparedTranslation> {
  const body = input.body ? sanitizeRichText(input.body) : null;
  const slug = slugify(input.slug?.trim() || input.title);
  const isSource = input.locale === defaultLocale;

  const existing = await db.articleTranslation.findUnique({
    where: { articleId_locale: { articleId: input.articleId, locale: input.locale } },
    select: { slug: true },
  });

  const sourceHash = isSource
    ? computeSourceHash((input.title ?? "") + (body ?? ""))
    : await currentArticleSourceHash(input.articleId, defaultLocale);

  return {
    slug,
    isSource,
    previousSlug: existing?.slug ?? null,
    sourceHash,
    faqItems: input.faqItems,
    fields: {
      locale: input.locale,
      title: input.title,
      slug,
      excerpt: input.excerpt ?? null,
      body,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      ogImageUrl: input.ogImageUrl ?? null,
      ogImageAssetId: input.ogImageAssetId ?? null,
      canonicalUrl: input.canonicalUrl ?? null,
      noIndex: input.noIndex ?? false,
      // changes-07 PR 2 fields.
      focusKeywords: input.focusKeywords ?? null,
      noFollow: input.noFollow ?? false,
      ogTitle: input.ogTitle ?? null,
      ogDescription: input.ogDescription ?? null,
      twitterCard: input.twitterCard ?? null,
      twitterImageUrl: input.twitterImageUrl ?? null,
      twitterImageAssetId: input.twitterImageAssetId ?? null,
      sourceHash,
      translationStatus: TranslationStatus.TRANSLATED,
      translatedBy: actor.id,
    },
  };
}

async function applyArticleTranslation(
  tx: Prisma.TransactionClient,
  input: SaveArticleTranslationInput,
  prepared: PreparedTranslation,
): Promise<void> {
  const { locale: _locale, ...updateFields } = prepared.fields;
  const saved = await tx.articleTranslation.upsert({
    where: { articleId_locale: { articleId: input.articleId, locale: input.locale } },
    update: updateFields,
    create: { articleId: input.articleId, ...prepared.fields },
  });

  if (prepared.faqItems) {
    await replaceArticleFaqItems(tx, saved.id, prepared.faqItems);
  }

  // ADR-035: one ContentReference sourceId per translation so two locales'
  // OG images don't overwrite each other's synced reference set. The
  // changes-07 Twitter image is tracked in the same set, under its own field.
  await syncReferences(
    tx,
    { sourceType: "ARTICLE", sourceId: `${input.articleId}:${input.locale}` },
    [
      saved.ogImageAssetId
        ? { refType: "MEDIA" as const, refId: saved.ogImageAssetId, field: "ogImageAssetId" }
        : null,
      saved.twitterImageAssetId
        ? {
            refType: "MEDIA" as const,
            refId: saved.twitterImageAssetId,
            field: "twitterImageAssetId",
          }
        : null,
    ].filter((r) => r !== null),
  );
}

async function finishArticleTranslation(
  actor: Subject,
  input: SaveArticleTranslationInput,
  prepared: PreparedTranslation,
  defaultLocale: string,
): Promise<void> {
  if (prepared.previousSlug !== null && prepared.previousSlug !== prepared.slug) {
    await createSlugRedirect(
      articlePath(input.locale, defaultLocale, prepared.previousSlug),
      articlePath(input.locale, defaultLocale, prepared.slug),
      actor.id,
    );
  }

  if (prepared.isSource) {
    const siblings = await db.articleTranslation.findMany({
      where: { articleId: input.articleId, locale: { not: defaultLocale } },
      select: { id: true, sourceHash: true },
    });
    const stale = siblings.filter((s) => isTranslationOutdated(prepared.sourceHash!, s.sourceHash));
    if (stale.length > 0) {
      await db.articleTranslation.updateMany({
        where: { id: { in: stale.map((s) => s.id) } },
        data: { translationStatus: TranslationStatus.OUTDATED },
      });
    }
  }
}

/**
 * Full replacement of a translation's FAQ list, in array order.
 *
 * Answers go through `sanitizeRichText` exactly like article bodies — the
 * editor is authoring convenience, never the boundary (security.md #8,
 * ADR-009). Rows absent from `items` are deleted; rows carrying an existing
 * `id` are updated in place so their identity survives a reorder.
 */
async function replaceArticleFaqItems(
  tx: Prisma.TransactionClient,
  translationId: string,
  items: ArticleFaqItemInput[],
): Promise<void> {
  const keepIds = items.map((i) => i.id).filter((id) => id !== undefined);
  await tx.articleFaqItem.deleteMany({
    where: { translationId, ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}) },
  });

  for (const [index, item] of items.entries()) {
    const data = {
      sortOrder: index,
      question: item.question,
      answer: sanitizeRichText(item.answer),
    };
    if (item.id) {
      // `updateMany` scoped to the translation, so a forged id from another
      // article's FAQ cannot be repointed here (IDOR, security.md #7).
      await tx.articleFaqItem.updateMany({ where: { id: item.id, translationId }, data });
    } else {
      await tx.articleFaqItem.create({ data: { translationId, ...data } });
    }
  }
}

async function currentArticleSourceHash(
  articleId: string,
  defaultLocale: string,
): Promise<string | null> {
  const source = await db.articleTranslation.findUnique({
    where: { articleId_locale: { articleId, locale: defaultLocale } },
    select: { title: true, body: true },
  });
  if (!source) return null;
  return computeSourceHash(source.title + (source.body ?? ""));
}

/**
 * The editor's single "Update & Publish" (changes-07 §4.2). Meta and
 * translation commit in ONE transaction, with ONE audit row and ONE
 * revalidation — not two independent saves that can leave an article half
 * updated when the second one throws.
 *
 * This is a COMPOSITION, not a rewrite: `updateArticleMeta` and
 * `saveArticleTranslation` stay exported and behave exactly as before, and
 * all three now share the same `apply*` bodies, so there is one implementation
 * of each write, not two that can drift.
 */
export async function saveArticle(actor: Subject, input: SaveArticleInput): Promise<void> {
  const current = await db.article.findUniqueOrThrow({
    where: { id: input.articleId },
    select: { kind: true },
  });
  assertKindPermission(actor, current.kind, "update");
  if (input.meta.kind && input.meta.kind !== current.kind) {
    assertKindPermission(actor, input.meta.kind, "update");
  }
  if (input.meta.videoUrl && parseVideoUrl(input.meta.videoUrl) === null) {
    throw new InvalidVideoUrlError();
  }

  const defaultLocale = await defaultLocaleCode();
  const prepared = await prepareArticleTranslation(actor, input.translation, defaultLocale);

  await db.$transaction(async (tx) => {
    await applyArticleMeta(tx, input.articleId, input.meta);
    await applyArticleTranslation(tx, input.translation, prepared);
  });

  await finishArticleTranslation(actor, input.translation, prepared, defaultLocale);

  const { tagIds, relatedArticleIds, ...meta } = input.meta;
  await recordAudit({
    userId: actor.id,
    action: "articles.save",
    entityType: "article",
    entityId: input.articleId,
    changes: {
      after: {
        ...meta,
        ...(tagIds ? { tagIds } : {}),
        ...(relatedArticleIds ? { relatedArticleIds } : {}),
        locale: input.translation.locale,
        title: input.translation.title,
        slug: prepared.slug,
      },
    },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * Editorial promotion toggle — mirrors `setArticleActive` exactly, including
 * its kind gate. Separate from the meta save so the list's row menu can flip
 * it without loading or re-submitting a whole article.
 */
export async function setArticleFeatured(
  actor: Subject,
  articleId: string,
  isFeatured: boolean,
): Promise<void> {
  const current = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    select: { kind: true },
  });
  assertKindPermission(actor, current.kind, "update");

  await db.article.update({ where: { id: articleId }, data: { isFeatured } });
  await recordAudit({
    userId: actor.id,
    action: "articles.setFeatured",
    entityType: "article",
    entityId: articleId,
    changes: { after: { isFeatured } },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * The list row-menu's Quick Edit: default-locale title/slug plus category and
 * the featured flag, without opening the editor.
 *
 * A slug change here writes the same 301 `Redirect` row a full translation
 * save does — a shortcut that silently broke inbound links would be worse
 * than no shortcut.
 */
export async function quickUpdateArticle(
  actor: Subject,
  articleId: string,
  input: QuickEditArticleInput,
): Promise<void> {
  const current = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    select: { kind: true },
  });
  assertKindPermission(actor, current.kind, "update");

  const defaultLocale = await defaultLocaleCode();
  const existing = await db.articleTranslation.findUnique({
    where: { articleId_locale: { articleId, locale: defaultLocale } },
    select: { id: true, title: true, slug: true },
  });

  const nextSlug =
    input.slug !== undefined || input.title !== undefined
      ? slugify(input.slug?.trim() || input.title || existing?.title || "")
      : undefined;

  await db.$transaction(async (tx) => {
    const articleData = {
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
    };
    if (Object.keys(articleData).length > 0) {
      await tx.article.update({ where: { id: articleId }, data: articleData });
    }
    if (existing && (input.title !== undefined || nextSlug !== undefined)) {
      await tx.articleTranslation.update({
        where: { id: existing.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(nextSlug !== undefined ? { slug: nextSlug } : {}),
        },
      });
    }
  });

  if (existing && nextSlug !== undefined && nextSlug !== existing.slug) {
    await createSlugRedirect(
      articlePath(defaultLocale, defaultLocale, existing.slug),
      articlePath(defaultLocale, defaultLocale, nextSlug),
      actor.id,
    );
  }

  await recordAudit({
    userId: actor.id,
    action: "articles.quickUpdate",
    entityType: "article",
    entityId: articleId,
    changes: { after: { ...input, ...(nextSlug !== undefined ? { slug: nextSlug } : {}) } },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * Publish / schedule / unpublish / archive. Publishing (→ PUBLISHED or
 * SCHEDULED) requires the kind's publish permission on top of what the
 * calling action already required (content.ts precedent).
 */
export async function transitionArticle(
  actor: Subject,
  articleId: string,
  to: ContentStatus,
  scheduledFor?: Date,
): Promise<void> {
  const current = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    select: { kind: true, status: true },
  });
  const publishing = to === ContentStatus.PUBLISHED || to === ContentStatus.SCHEDULED;
  if (publishing) {
    const permission = articleKindPermission(current.kind, "publish");
    if (!can(actor, permission)) throw new PublishPermissionError(permission);
  } else {
    assertKindPermission(actor, current.kind, "update");
  }
  assertArticleTransition(current.status, to);

  if (to === ContentStatus.SCHEDULED) {
    if (!scheduledFor || scheduledFor.getTime() <= Date.now()) throw new ScheduleInPastError();
  }

  await db.article.update({
    where: { id: articleId },
    data: {
      status: to,
      ...(to === ContentStatus.PUBLISHED ? { publishedAt: new Date(), scheduledFor: null } : {}),
      ...(to === ContentStatus.SCHEDULED ? { scheduledFor } : {}),
      ...(to === ContentStatus.DRAFT ? { scheduledFor: null } : {}),
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "articles.transition",
    entityType: "article",
    entityId: articleId,
    changes: {
      before: { status: current.status },
      after: { status: to, ...(scheduledFor ? { scheduledFor: scheduledFor.toISOString() } : {}) },
    },
  });
  revalidateTag("content", { expire: 0 });
}

export async function setArticleActive(
  actor: Subject,
  articleId: string,
  isActive: boolean,
): Promise<void> {
  const current = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    select: { kind: true },
  });
  assertKindPermission(actor, current.kind, "update");
  await db.article.update({ where: { id: articleId }, data: { isActive } });
  await recordAudit({
    userId: actor.id,
    action: isActive ? "articles.activate" : "articles.deactivate",
    entityType: "article",
    entityId: articleId,
  });
  revalidateTag("content", { expire: 0 });
}

export async function setArticleDeleted(
  actor: Subject,
  articleId: string,
  deleted: boolean,
): Promise<void> {
  const current = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    select: { kind: true },
  });
  assertKindPermission(actor, current.kind, "delete");
  await db.article.update({
    where: { id: articleId },
    data: { deletedAt: deleted ? new Date() : null },
  });
  await recordAudit({
    userId: actor.id,
    action: deleted ? "articles.softDelete" : "articles.restore",
    entityType: "article",
    entityId: articleId,
  });
  revalidateTag("content", { expire: 0 });
}

export async function duplicateArticle(actor: Subject, articleId: string): Promise<string> {
  const source = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    include: { translations: true, tags: true },
  });
  assertKindPermission(actor, source.kind, "create");

  const copy = await db.$transaction(async (tx) => {
    const created = await tx.article.create({
      data: {
        kind: source.kind,
        categoryId: source.categoryId,
        authorId: actor.id,
        coverImageUrl: source.coverImageUrl,
        coverImageAssetId: source.coverImageAssetId,
        videoUrl: source.videoUrl,
        isPremium: source.isPremium,
        // Fresh lifecycle: draft, unscheduled, never published.
        status: ContentStatus.DRAFT,
        tags: { create: source.tags.map((t) => ({ tagId: t.tagId })) },
        translations: {
          create: source.translations.map((t) => ({
            locale: t.locale,
            title: t.title,
            // Uniqueness without a lookup loop; editable before publish anyway.
            slug: `${t.slug}-copy-${Date.now().toString(36)}`.slice(0, 255),
            excerpt: t.excerpt,
            body: t.body,
            seoTitle: t.seoTitle,
            seoDescription: t.seoDescription,
            ogImageUrl: t.ogImageUrl,
            ogImageAssetId: t.ogImageAssetId,
            noIndex: t.noIndex,
            translationStatus: TranslationStatus.DRAFT,
          })),
        },
      },
      include: { translations: true },
    });
    // ADR-035: the copy is a real, independent usage from the moment it
    // exists — the guard must see it, not just the source article's refs.
    if (created.coverImageAssetId) {
      await syncReferences(tx, { sourceType: "ARTICLE", sourceId: created.id }, [
        { refType: "MEDIA", refId: created.coverImageAssetId, field: "coverImageAssetId" },
      ]);
    }
    for (const t of created.translations) {
      if (t.ogImageAssetId) {
        await syncReferences(tx, { sourceType: "ARTICLE", sourceId: `${created.id}:${t.locale}` }, [
          { refType: "MEDIA", refId: t.ogImageAssetId, field: "ogImageAssetId" },
        ]);
      }
    }
    return created;
  });
  await recordAudit({
    userId: actor.id,
    action: "articles.duplicate",
    entityType: "article",
    entityId: copy.id,
    changes: { after: { sourceArticleId: articleId } },
  });
  return copy.id;
}

/**
 * Flip due SCHEDULED articles → PUBLISHED (ADR-015 #6). Callable from a
 * future cron/queue; public visibility does NOT depend on it — the public
 * where-clause already treats a due SCHEDULED article as live.
 */
export async function publishDueArticles(now: Date = new Date()): Promise<number> {
  const due = await db.article.findMany({
    where: { status: ContentStatus.SCHEDULED, scheduledFor: { lte: now }, deletedAt: null },
    select: { id: true, scheduledFor: true },
  });
  if (due.length === 0) return 0;

  for (const row of due) {
    await db.article.update({
      where: { id: row.id },
      // The honest publish time is the scheduled one, not the sweep's.
      data: { status: ContentStatus.PUBLISHED, publishedAt: row.scheduledFor, scheduledFor: null },
    });
  }
  await recordAudit({
    userId: null, // system sweep, not a user action
    action: "articles.publishDue",
    entityType: "article",
    changes: { after: { count: due.length, ids: due.map((r) => r.id) } },
  });
  revalidateTag("content", { expire: 0 });
  return due.length;
}

// ─── Admin reads ─────────────────────────────────────────────

export interface ListArticlesParams {
  page: number;
  pageSize: number;
  sortBy?: "updatedAt" | "publishedAt" | "status";
  sortDir?: "asc" | "desc";
  search?: string;
  kind?: ArticleKind;
  status?: ContentStatus;
  categoryId?: string;
}

export interface ArticleAdminRow {
  id: string;
  kind: ArticleKind;
  status: ContentStatus;
  isActive: boolean;
  isFeatured: boolean;
  deletedAt: Date | null;
  title: string | null;
  slug: string | null;
  categoryName: string | null;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
  locales: { locale: string; translationStatus: TranslationStatus }[];
  legalTransitions: ContentStatus[];
}

export interface ListArticlesResult {
  rows: ArticleAdminRow[];
  total: number;
  pageCount: number;
}

export async function listArticlesAdmin(params: ListArticlesParams): Promise<ListArticlesResult> {
  const defaultLocale = await defaultLocaleCode();
  const where = {
    ...(params.kind ? { kind: params.kind } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.search ? { translations: { some: { title: { contains: params.search } } } } : {}),
  };
  const orderBy = { [params.sortBy ?? "updatedAt"]: params.sortDir ?? "desc" };
  const [rows, total] = await Promise.all([
    db.article.findMany({
      where,
      orderBy,
      skip: params.page * params.pageSize,
      take: params.pageSize,
      include: {
        translations: {
          select: { locale: true, title: true, slug: true, translationStatus: true },
        },
        category: {
          include: { translations: { select: { locale: true, name: true } } },
        },
      },
    }),
    db.article.count({ where }),
  ]);

  return {
    rows: rows.map((row) => {
      const source = row.translations.find((t) => t.locale === defaultLocale);
      const categoryName =
        row.category.translations.find((t) => t.locale === defaultLocale)?.name ??
        row.category.translations[0]?.name ??
        null;
      return {
        id: row.id,
        kind: row.kind,
        status: row.status,
        isActive: row.isActive,
        isFeatured: row.isFeatured,
        deletedAt: row.deletedAt,
        title: source?.title ?? null,
        slug: source?.slug ?? null,
        categoryName,
        scheduledFor: row.scheduledFor,
        publishedAt: row.publishedAt,
        updatedAt: row.updatedAt,
        locales: row.translations.map((t) => ({
          locale: t.locale,
          translationStatus: t.translationStatus,
        })),
        legalTransitions: ARTICLE_TRANSITIONS[row.status],
      };
    }),
    total,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export interface ArticleAdminDetail {
  id: string;
  kind: ArticleKind;
  status: ContentStatus;
  isActive: boolean;
  isPremium: boolean;
  isFeatured: boolean;
  coverImageUrl: string | null;
  coverImageAssetId: string | null;
  headerImageUrl: string | null;
  headerImageAssetId: string | null;
  videoUrl: string | null;
  showRelated: boolean;
  relatedCount: number;
  categoryId: string;
  authorId: string | null;
  source: string | null;
  sourceUrl: string | null;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tagIds: string[];
  /** Curated related-article ids, in the order the editor arranged them. */
  relatedArticleIds: string[];
  translations: {
    locale: string;
    title: string;
    slug: string;
    excerpt: string | null;
    body: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    ogImageUrl: string | null;
    ogImageAssetId: string | null;
    canonicalUrl: string | null;
    noIndex: boolean;
    focusKeywords: string | null;
    noFollow: boolean;
    ogTitle: string | null;
    ogDescription: string | null;
    twitterCard: string | null;
    twitterImageUrl: string | null;
    twitterImageAssetId: string | null;
    faqItems: { id: string; question: string; answer: string }[];
    translationStatus: TranslationStatus;
  }[];
  legalTransitions: ContentStatus[];
}

export async function loadArticleAdminDetail(
  articleId: string,
): Promise<ArticleAdminDetail | null> {
  const row = await db.article.findUnique({
    where: { id: articleId },
    include: {
      translations: { include: { faqItems: { orderBy: { sortOrder: "asc" } } } },
      tags: { select: { tagId: true } },
    },
  });
  if (!row) return null;

  // Related posts are relation rows, not a column — one extra read rather than
  // a join, since the editor loads a single article at a time.
  const relatedArticleIds = await loadRelationTargets({
    sourceType: ARTICLE,
    sourceId: articleId,
    targetType: ARTICLE,
    relationType: RELATED,
  });

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    isActive: row.isActive,
    isPremium: row.isPremium,
    isFeatured: row.isFeatured,
    coverImageUrl: row.coverImageUrl,
    coverImageAssetId: row.coverImageAssetId,
    headerImageUrl: row.headerImageUrl,
    headerImageAssetId: row.headerImageAssetId,
    videoUrl: row.videoUrl,
    showRelated: row.showRelated,
    relatedCount: row.relatedCount,
    categoryId: row.categoryId,
    authorId: row.authorId,
    source: row.source,
    sourceUrl: row.sourceUrl,
    scheduledFor: row.scheduledFor,
    publishedAt: row.publishedAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tagIds: row.tags.map((t) => t.tagId),
    relatedArticleIds,
    translations: row.translations.map((t) => ({
      locale: t.locale,
      title: t.title,
      slug: t.slug,
      excerpt: t.excerpt,
      body: t.body,
      seoTitle: t.seoTitle,
      seoDescription: t.seoDescription,
      ogImageUrl: t.ogImageUrl,
      ogImageAssetId: t.ogImageAssetId,
      canonicalUrl: t.canonicalUrl,
      noIndex: t.noIndex,
      focusKeywords: t.focusKeywords,
      noFollow: t.noFollow,
      ogTitle: t.ogTitle,
      ogDescription: t.ogDescription,
      twitterCard: t.twitterCard,
      twitterImageUrl: t.twitterImageUrl,
      twitterImageAssetId: t.twitterImageAssetId,
      faqItems: t.faqItems.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
      translationStatus: t.translationStatus,
    })),
    legalTransitions: ARTICLE_TRANSITIONS[row.status],
  };
}

// ─── Categories ──────────────────────────────────────────────

export interface ArticleCategoryTranslationView {
  locale: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface ArticleCategoryAdminRow {
  id: string;
  isActive: boolean;
  sortOrder: number;
  name: string | null;
  slug: string | null;
  articleCount: number;
  locales: string[];
  /** Every locale's row — the edit modal (changes-02) switches between them. */
  translations: ArticleCategoryTranslationView[];
}

export async function loadArticleCategoriesAdmin(): Promise<ArticleCategoryAdminRow[]> {
  const defaultLocale = await defaultLocaleCode();
  const rows = await db.articleCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      translations: {
        select: {
          locale: true,
          name: true,
          slug: true,
          description: true,
          seoTitle: true,
          seoDescription: true,
        },
      },
      _count: { select: { articles: true } },
    },
  });
  return rows.map((row) => {
    const source = row.translations.find((t) => t.locale === defaultLocale);
    return {
      id: row.id,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      name: source?.name ?? row.translations[0]?.name ?? null,
      slug: source?.slug ?? null,
      articleCount: row._count.articles,
      locales: row.translations.map((t) => t.locale),
      translations: row.translations,
    };
  });
}

export async function createArticleCategory(
  actor: Subject,
  input: CreateArticleCategoryInput,
): Promise<string> {
  const defaultLocale = await defaultLocaleCode();
  const category = await db.articleCategory.create({
    data: {
      sortOrder: input.sortOrder ?? 0,
      translations: {
        create: {
          locale: defaultLocale,
          name: input.name,
          slug: slugify(input.slug?.trim() || input.name),
          description: input.description ?? null,
        },
      },
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "articleCategories.create",
    entityType: "articleCategory",
    entityId: category.id,
    changes: { after: { name: input.name } },
  });
  revalidateTag("content", { expire: 0 });
  return category.id;
}

export async function updateArticleCategory(
  actor: Subject,
  categoryId: string,
  input: UpdateArticleCategoryInput,
): Promise<void> {
  await db.articleCategory.update({ where: { id: categoryId }, data: input });
  await recordAudit({
    userId: actor.id,
    action: "articleCategories.update",
    entityType: "articleCategory",
    entityId: categoryId,
    changes: { after: input },
  });
  revalidateTag("content", { expire: 0 });
}

export async function saveArticleCategoryTranslation(
  actor: Subject,
  input: SaveArticleCategoryTranslationInput,
): Promise<void> {
  const defaultLocale = await defaultLocaleCode();
  const slug = slugify(input.slug?.trim() || input.name);
  const existing = await db.articleCategoryTranslation.findUnique({
    where: { categoryId_locale: { categoryId: input.categoryId, locale: input.locale } },
  });
  const fields = {
    name: input.name,
    slug,
    description: input.description ?? null,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
  };
  await db.articleCategoryTranslation.upsert({
    where: { categoryId_locale: { categoryId: input.categoryId, locale: input.locale } },
    update: fields,
    create: { categoryId: input.categoryId, locale: input.locale, ...fields },
  });
  if (existing && existing.slug !== slug) {
    await createSlugRedirect(
      articleCategoryPath(input.locale, defaultLocale, existing.slug),
      articleCategoryPath(input.locale, defaultLocale, slug),
      actor.id,
    );
  }
  await recordAudit({
    userId: actor.id,
    action: "articleCategories.saveTranslation",
    entityType: "articleCategoryTranslation",
    entityId: `${input.categoryId}:${input.locale}`,
    changes: { after: { name: input.name, slug, locale: input.locale } },
  });
  revalidateTag("content", { expire: 0 });
}

/** Guard mirrors RoleInUseError: a category with articles cannot be deleted. */
export async function deleteArticleCategory(actor: Subject, categoryId: string): Promise<void> {
  const count = await db.article.count({ where: { categoryId } });
  if (count > 0) throw new CategoryInUseError(count);
  await db.articleCategory.delete({ where: { id: categoryId } });
  await recordAudit({
    userId: actor.id,
    action: "articleCategories.delete",
    entityType: "articleCategory",
    entityId: categoryId,
  });
  revalidateTag("content", { expire: 0 });
}

// ─── Tags ────────────────────────────────────────────────────

export interface ArticleTagTranslationView {
  locale: string;
  name: string;
  slug: string;
}

export interface ArticleTagAdminRow {
  id: string;
  isActive: boolean;
  name: string | null;
  slug: string | null;
  articleCount: number;
  locales: string[];
  translations: ArticleTagTranslationView[];
}

export async function loadArticleTagsAdmin(): Promise<ArticleTagAdminRow[]> {
  const defaultLocale = await defaultLocaleCode();
  const rows = await db.articleTag.findMany({
    include: {
      translations: { select: { locale: true, name: true, slug: true } },
      _count: { select: { articles: true } },
    },
  });
  const mapped = rows.map((row) => {
    const source = row.translations.find((t) => t.locale === defaultLocale);
    return {
      id: row.id,
      isActive: row.isActive,
      name: source?.name ?? row.translations[0]?.name ?? null,
      slug: source?.slug ?? null,
      articleCount: row._count.articles,
      locales: row.translations.map((t) => t.locale),
      translations: row.translations,
    };
  });
  return mapped.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}

export async function createArticleTag(
  actor: Subject,
  input: CreateArticleTagInput,
): Promise<string> {
  const defaultLocale = await defaultLocaleCode();
  const tag = await db.articleTag.create({
    data: {
      translations: {
        create: {
          locale: defaultLocale,
          name: input.name,
          slug: slugify(input.slug?.trim() || input.name),
        },
      },
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "articleTags.create",
    entityType: "articleTag",
    entityId: tag.id,
    changes: { after: { name: input.name } },
  });
  revalidateTag("content", { expire: 0 });
  return tag.id;
}

export async function saveArticleTagTranslation(
  actor: Subject,
  input: SaveArticleTagTranslationInput,
): Promise<void> {
  const defaultLocale = await defaultLocaleCode();
  const slug = slugify(input.slug?.trim() || input.name);
  const existing = await db.articleTagTranslation.findUnique({
    where: { tagId_locale: { tagId: input.tagId, locale: input.locale } },
  });
  await db.articleTagTranslation.upsert({
    where: { tagId_locale: { tagId: input.tagId, locale: input.locale } },
    update: { name: input.name, slug },
    create: { tagId: input.tagId, locale: input.locale, name: input.name, slug },
  });
  if (existing && existing.slug !== slug) {
    await createSlugRedirect(
      articleTagPath(input.locale, defaultLocale, existing.slug),
      articleTagPath(input.locale, defaultLocale, slug),
      actor.id,
    );
  }
  await recordAudit({
    userId: actor.id,
    action: "articleTags.saveTranslation",
    entityType: "articleTagTranslation",
    entityId: `${input.tagId}:${input.locale}`,
    changes: { after: { name: input.name, slug, locale: input.locale } },
  });
  revalidateTag("content", { expire: 0 });
}

export async function setArticleTagActive(
  actor: Subject,
  tagId: string,
  isActive: boolean,
): Promise<void> {
  await db.articleTag.update({ where: { id: tagId }, data: { isActive } });
  await recordAudit({
    userId: actor.id,
    action: isActive ? "articleTags.activate" : "articleTags.deactivate",
    entityType: "articleTag",
    entityId: tagId,
  });
  revalidateTag("content", { expire: 0 });
}

/** Tags cascade their assignments — deleting one never orphans an article. */
export async function deleteArticleTag(actor: Subject, tagId: string): Promise<void> {
  await db.articleTag.delete({ where: { id: tagId } });
  await recordAudit({
    userId: actor.id,
    action: "articleTags.delete",
    entityType: "articleTag",
    entityId: tagId,
  });
  revalidateTag("content", { expire: 0 });
}
