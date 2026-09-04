// Content-surface contracts (Module 15: News & Analysis articles, ADR-015).
// Every article server action parses its input through these before any
// service call — "parse, don't spread" (security.md #6).
import { z } from "zod";

// ─── Articles ────────────────────────────────────────────────

export const articleKindSchema = z.enum(["NEWS", "ANALYSIS", "TRADE_IDEA"]);
export type ArticleKindInput = z.infer<typeof articleKindSchema>;

/** The lean article lifecycle (ADR-015 #4) — review states are unused here. */
export const articleStatusFilterSchema = z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]);
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
  // Provider whitelist (YouTube/Vimeo/Dailymotion) is enforced in the
  // service via @repo/utils parseVideoUrl — the contract only shapes it.
  videoUrl: z.url().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  isPremium: z.boolean().optional(),
  source: z.string().trim().max(150).nullable().optional(),
  sourceUrl: z.url().max(500).nullable().optional(),
  /** Full replacement set, like setRolePermissions — never a partial merge. */
  tagIds: z.array(z.string().min(1).max(64)).max(20).optional(),
});
export type UpdateArticleMetaInput = z.infer<typeof updateArticleMetaSchema>;

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
  canonicalUrl: z.url().max(500).nullable().optional(),
  noIndex: z.boolean().optional(),
});
export type SaveArticleTranslationInput = z.infer<typeof saveArticleTranslationSchema>;

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
