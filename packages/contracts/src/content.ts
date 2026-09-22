// Content-surface contracts (Module 15: News & Analysis articles, ADR-015).
// Every article server action parses its input through these before any
// service call — "parse, don't spread" (security.md #6).
import { z } from "zod";

// ─── Articles ────────────────────────────────────────────────

export const articleKindSchema = z.enum(["NEWS", "ANALYSIS", "TRADE_IDEA"]);
export type ArticleKindInput = z.infer<typeof articleKindSchema>;

/**
 * The admin list's "show the trash" status value (changes-49). The SAME
 * string as `DELETED_FILTER` in the admin's `_components/trash.tsx`, which the
 * client-filtered lists use; spelled out again here because contracts cannot
 * import from an app, and the articles list is filtered on the SERVER, so the
 * URL's `?status=` must survive this schema.
 */
export const ARTICLE_DELETED_FILTER = "__deleted";

/**
 * The lean article lifecycle (ADR-015 #4) — review states are unused here —
 * plus the trash, which is not a `ContentStatus` and is mapped to a
 * `deletedAt` clause by the page before it reaches the service.
 */
export const articleStatusFilterSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
  ARTICLE_DELETED_FILTER,
]);
export type ArticleStatusFilter = z.infer<typeof articleStatusFilterSchema>;

export const articleSortBySchema = z.enum(["updatedAt", "publishedAt", "status"]);
export type ArticleSortBy = z.infer<typeof articleSortBySchema>;

/** A site-relative path or absolute URL — same rule as the IMAGE settings. */
const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .regex(/^(\/|https?:\/\/)/, "must be a path or URL");

export const createArticleSchema = z.object({
  kind: articleKindSchema,
  categoryId: z.string().min(1).max(64),
});
export type CreateArticleInput = z.infer<typeof createArticleSchema>;

export const updateArticleMetaSchema = z.object({
  kind: articleKindSchema.optional(),
  categoryId: z.string().min(1).max(64).optional(),
  coverImageUrl: imageUrlSchema.nullable().optional(),
  // ADR-035 — the MediaAsset id behind coverImageUrl, for the ContentReference
  // usage guard. Sent alongside coverImageUrl by the upload widget's onChange.
  coverImageAssetId: z.string().min(1).max(64).nullable().optional(),
  // Provider whitelist (YouTube/Vimeo/Dailymotion) is enforced in the
  // service via @repo/utils parseVideoUrl — the contract only shapes it.
  videoUrl: z.url().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  isPremium: z.boolean().optional(),
  source: z.string().trim().max(150).nullable().optional(),
  sourceUrl: z.url().max(500).nullable().optional(),
  /** Full replacement set, like setRolePermissions — never a partial merge. */
  tagIds: z.array(z.string().min(1).max(64)).max(20).optional(),

  // changes-07 PR 2. Every key below is optional so existing callers — and the
  // existing integration tests — keep compiling and behaving identically.
  isFeatured: z.boolean().optional(),
  /** Rendered at the top of this article's page; distinct from the cover/OG image. */
  headerImageUrl: imageUrlSchema.nullable().optional(),
  headerImageAssetId: z.string().min(1).max(64).nullable().optional(),
  showRelated: z.boolean().optional(),
  relatedCount: z.int().min(1).max(12).optional(),
  /**
   * Full replacement set of related-article ids, same rule as `tagIds`. Stored
   * as ContentRelation rows, not a column — the service owns that mapping.
   */
  relatedArticleIds: z.array(z.string().min(1).max(64)).max(12).optional(),
});
export type UpdateArticleMetaInput = z.infer<typeof updateArticleMetaSchema>;

/**
 * One FAQ entry. `id` absent means "create"; present means "keep this row".
 * Answers are sanitized server-side through the ADR-009 pipeline, exactly like
 * article bodies — this cap only bounds the payload.
 */
export const articleFaqItemSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(5000),
});
export type ArticleFaqItemInput = z.infer<typeof articleFaqItemSchema>;

export const saveArticleTranslationSchema = z.object({
  articleId: z.string().min(1).max(64),
  locale: z.string().min(2).max(10),
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().max(255).optional(),
  excerpt: z.string().trim().max(500).nullable().optional(),
  body: z.string().max(200_000).nullable().optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(180).nullable().optional(),
  ogImageUrl: imageUrlSchema.nullable().optional(),
  // ADR-035 — same purpose as coverImageAssetId, scoped per translation.
  ogImageAssetId: z.string().min(1).max(64).nullable().optional(),
  canonicalUrl: z.url().max(500).nullable().optional(),
  noIndex: z.boolean().optional(),

  // changes-07 PR 2 — per-locale SEO. All optional, so the existing payload
  // shape stays valid unchanged.
  /** Comma-separated; `parseKeywords` in @repo/utils splits it, never SQL. */
  focusKeywords: z.string().trim().max(300).nullable().optional(),
  noFollow: z.boolean().optional(),
  /** Null means "inherit from seoTitle → title", not "render empty". */
  ogTitle: z.string().trim().max(120).nullable().optional(),
  ogDescription: z.string().trim().max(300).nullable().optional(),
  twitterCard: z.enum(["summary", "summary_large_image"]).nullable().optional(),
  twitterImageUrl: imageUrlSchema.nullable().optional(),
  twitterImageAssetId: z.string().min(1).max(64).nullable().optional(),
  /** Full replacement set — the service diffs it against the stored rows. */
  faqItems: z.array(articleFaqItemSchema).max(20).optional(),

  /**
   * 3-5 short takeaways, or null (changes-29 B4).
   *
   * The bounds are the schema's, not the prompt's: an AI suggestion and a
   * hand-typed list are validated by the SAME rule, which is what makes the
   * public block render identically whichever wrote it (ADR-097 / §2.2 #8).
   * An empty array is normalised to null by the service, because "no
   * takeaways" and "a list with nothing in it" must not be two states.
   */
  keyTakeaways: z.array(z.string().trim().min(1).max(160)).min(3).max(5).nullable().optional(),

  /**
   * This locale's text came from AI and has not been edited since
   * (changes-29 B3).
   *
   * It decides ONE thing: whether the save writes `MACHINE_TRANSLATED` instead
   * of `TRANSLATED`. The AI path cannot write `TRANSLATED` at all, and a human
   * who opens the translation and presses Save writes it by NOT setting this —
   * the review IS the promotion, so no separate "approve" step is invented.
   *
   * Editing any translatable field in the editor clears it, which is what makes
   * "has not been edited since" true rather than aspirational.
   */
  machineTranslated: z.boolean().optional(),
});
export type SaveArticleTranslationInput = z.infer<typeof saveArticleTranslationSchema>;

/**
 * The editor's single "Update & Publish" payload (changes-07 §4.1). Meta and
 * translation in one object so the service can commit both in ONE transaction
 * — the two single-purpose schemas above stay exported and unchanged for every
 * other caller.
 */
export const saveArticleSchema = z.object({
  articleId: z.string().min(1).max(64),
  meta: updateArticleMetaSchema,
  translation: saveArticleTranslationSchema,
});
export type SaveArticleInput = z.infer<typeof saveArticleSchema>;

/** The list row-menu's Quick Edit — default-locale title/slug plus lifecycle. */
export const quickEditArticleSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  slug: z.string().trim().max(255).optional(),
  categoryId: z.string().min(1).max(64).optional(),
  isFeatured: z.boolean().optional(),
});
export type QuickEditArticleInput = z.infer<typeof quickEditArticleSchema>;

export const scheduleArticleSchema = z.object({
  articleId: z.string().min(1).max(64),
  scheduledFor: z.coerce.date(),
});
export type ScheduleArticleInput = z.infer<typeof scheduleArticleSchema>;

// ─── Categories & tags ───────────────────────────────────────

export const createArticleCategorySchema = z.object({
  /** Default-locale name — the service creates base row + translation together. */
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(150).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.int().min(0).max(999).optional(),
});
export type CreateArticleCategoryInput = z.infer<typeof createArticleCategorySchema>;

export const updateArticleCategorySchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.int().min(0).max(999).optional(),
});
export type UpdateArticleCategoryInput = z.infer<typeof updateArticleCategorySchema>;

export const saveArticleCategoryTranslationSchema = z.object({
  categoryId: z.string().min(1).max(64),
  locale: z.string().min(2).max(10),
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(150).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(180).nullable().optional(),
});
export type SaveArticleCategoryTranslationInput = z.infer<
  typeof saveArticleCategoryTranslationSchema
>;

export const createArticleTagSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(150).optional(),
});
export type CreateArticleTagInput = z.infer<typeof createArticleTagSchema>;

export const saveArticleTagTranslationSchema = z.object({
  tagId: z.string().min(1).max(64),
  locale: z.string().min(2).max(10),
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(150).optional(),
});
export type SaveArticleTagTranslationInput = z.infer<typeof saveArticleTagTranslationSchema>;

// ─── Public article listing (changes-03-plan.md §5.3) ─────────
//
// Parsed at the ROUTE boundary before reaching @repo/core — search text and
// page number arrive as untrusted `searchParams` strings (security.md #6:
// parse, don't cast). `q` is a plain contains-match on title/excerpt, so it
// is capped rather than left open-ended.
export const publicArticleSearchSchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(0).max(10_000).optional(),
});
export type PublicArticleSearchInput = z.infer<typeof publicArticleSearchSchema>;

// ─── Reading language (ADR-127) ───────────────────────────────
//
// `?lang=` on a public detail page: the language the item's OWN words are read
// in, independent of the interface locale. Shaped like a locale code and
// nothing more — whether a translation exists is the loader's question, and an
// unusable value is ignored rather than rejected, so callers `safeParse`.
export const readingLanguageSearchSchema = z.object({
  lang: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/)
    .optional(),
});
export type ReadingLanguageSearchInput = z.infer<typeof readingLanguageSearchSchema>;

/**
 * The closed class vocabulary the rich-text editor may emit (changes-10,
 * ADR-046). Mirrors the `.ed-*` rules in `@repo/ui`'s globals.css — that file
 * is the definition, this is the gate. Enumerated rather than globbed as
 * `ed-*` so a class with no stylesheet behind it cannot ride along.
 *
 * It lives here rather than in `@repo/core` because two sanitisers need it
 * now: core's `sanitizeRichText`, and `@repo/email`'s layout, which maps each
 * class to an inline style because email clients drop class CSS. Email cannot
 * import core: it sits BELOW both its senders (ADR-078 #1), so the vocabulary
 * has to live upstream of both.
 */
export const EDITORIAL_CLASSES = [
  "ed-tx-primary",
  "ed-tx-success",
  "ed-tx-warning",
  "ed-tx-info",
  "ed-tx-danger",
  "ed-tx-muted",
  "ed-hl-primary",
  "ed-hl-success",
  "ed-hl-warning",
  "ed-hl-info",
  "ed-hl-danger",
  "ed-hl-muted",
  // `body` and `display` are changes-40's names for the two families the
  // theme owns; `sans` is `body`'s old name and stays allowed because
  // articles saved before the rename carry it. Dropping it here would not
  // rename anything — it would strip the class from the stored HTML the next
  // time an editor pressed Save, silently reverting the author's choice.
  "ed-ff-body",
  "ed-ff-display",
  "ed-ff-sans",
  "ed-ff-serif",
  "ed-ff-mono",
  "ed-fs-sm",
  "ed-fs-base",
  "ed-fs-lg",
  "ed-fs-xl",
  "ed-fs-2xl",
  "ed-align-start",
  "ed-align-center",
  "ed-align-end",
  "ed-align-justify",
  "ed-embed",
] as const;

// ─── Permanent delete (changes-49, ADR-147) ──────────────────

/** The content modules whose trash can be emptied row by row. */
export const PURGEABLE_ENTITIES = [
  "course",
  "lesson",
  "quiz",
  "glossary",
  "video",
  "article",
] as const;
export type PurgeableEntity = (typeof PURGEABLE_ENTITIES)[number];

export const purgeContentSchema = z.object({
  entity: z.enum(PURGEABLE_ENTITIES),
  id: z.string().min(1).max(64),
});
