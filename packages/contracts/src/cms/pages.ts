// CMS page/version/redirect contracts (ADR-021, ADR-032 §6). Every
// mutation in packages/core/src/cms/* and every server action in
// apps/web/app/(admin)/admin/website/* parses its input through these
// before the service runs (security.md #6 — parse, don't spread).
import { z } from "zod";
import { featureVisibilitySchema, layoutTreeSchema } from "./layout.ts";
import { pageSlugSchema } from "./paths.ts";

export const pageKindSchema = z.enum(["STATIC", "COLLECTION", "DETAIL", "DATA"]);
export type PageKindInput = z.infer<typeof pageKindSchema>;

/** Mirrors Prisma's `ContentStatus` (packages/db). */
export const pageStatusSchema = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "SEO_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
]);
export type PageStatusInput = z.infer<typeof pageStatusSchema>;

// ─── Pages ───────────────────────────────────────────────────

/** Phase 1 creates STATIC pages only — the service refuses any other `kind` until later phases wire COLLECTION/DETAIL/DATA creation. */
export const createPageSchema = z.object({
  title: z.string().trim().min(1).max(255),
  slug: pageSlugSchema,
  parentId: z.string().trim().min(1).max(64).nullable().optional(),
  group: z.string().trim().max(80).nullable().optional(),
});
export type CreatePageInput = z.infer<typeof createPageSchema>;

export const updatePageMetaSchema = z.object({
  parentId: z.string().trim().min(1).max(64).nullable().optional(),
  group: z.string().trim().max(80).nullable().optional(),
  visibility: featureVisibilitySchema.optional(),
  requiresFeature: z.string().trim().max(80).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePageMetaInput = z.infer<typeof updatePageMetaSchema>;

export const savePageTranslationSchema = z.object({
  locale: z.string().trim().min(2).max(10),
  title: z.string().trim().min(1).max(255),
  /** "" only valid for the home page — the service refuses an empty slug on any other page (it knows `page.key`, this schema does not). */
  slug: pageSlugSchema,
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(180).nullable().optional(),
  ogImageId: z.string().trim().min(1).max(64).nullable().optional(),
  canonicalUrl: z.url().max(500).nullable().optional(),
  robots: z.string().trim().max(40).nullable().optional(),
  includeInSitemap: z.boolean().optional(),
  schemaType: z.string().trim().max(40).nullable().optional(),
});
export type SavePageTranslationInput = z.infer<typeof savePageTranslationSchema>;

export const saveDraftSchema = z.object({
  layout: layoutTreeSchema,
  /** The optimistic lock (ADR-032 §6): the client's last-known `PageVersion.revision`. A mismatch means someone else saved first. */
  baseRevision: z.int().min(0),
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export const publishPageSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type PublishPageInput = z.infer<typeof publishPageSchema>;

export const rollbackPageSchema = z.object({
  versionNumber: z.int().min(1),
});
export type RollbackPageInput = z.infer<typeof rollbackPageSchema>;

// ─── Admin list state (URL-driven, the `articles/page.tsx` pattern) ──

export const pageListTabSchema = z.enum(["pages", "designs", "global"]);
export type PageListTab = z.infer<typeof pageListTabSchema>;

export const pageListSortBySchema = z.enum(["updatedAt", "title", "status"]);

export const listPagesQuerySchema = z.object({
  tab: pageListTabSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  status: pageStatusSchema.optional(),
  page: z.coerce.number().int().min(0).max(10_000).optional(),
  sortBy: pageListSortBySchema.optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});
export type ListPagesQuery = z.infer<typeof listPagesQuerySchema>;

// ─── Redirects (the `Redirect` model exists — ADR-015 #1 — only the
//     screen and its actions are new) ──────────────────────────

export const createRedirectSchema = z.object({
  fromPath: z.string().trim().min(1).max(500).regex(/^\//, "must be an absolute internal path"),
  toPath: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .regex(/^(\/|https?:\/\/)/, "must be an absolute internal path or an http(s) URL"),
  statusCode: z.union([z.literal(301), z.literal(302)]).default(301),
});
export type CreateRedirectInput = z.infer<typeof createRedirectSchema>;

export const setRedirectActiveSchema = z.object({
  isActive: z.boolean(),
});
export type SetRedirectActiveInput = z.infer<typeof setRedirectActiveSchema>;
