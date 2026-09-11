// Video-section contracts (Module 11/12, ADR-068).
//
// Three rules in this file are load-bearing, and they are the reason it exists
// rather than the schemas living beside their service:
//
//   1. A video row carries EXACTLY ONE source — an uploaded asset or an
//      external URL, never both and never neither (ADR-068 §4).
//   2. A link carries EXACTLY ONE href — a site-relative path or an external
//      https URL (ADR-068 §5), and "site-relative" is a real check, not a
//      naming convention.
//   3. A topic must carry at least one capability, or an empty page can be
//      published (ADR-068, following ADR-055 #4).
//
// All three are enforced here so the admin form, the server action and the
// service fail identically rather than in three slightly different ways.
import { z } from "zod";
import { externalUrlSchema, learnTrackSchema } from "./learn.ts";

// Local rather than shared with learn.ts, which keeps its own copies private
// for the same reason: these are shapes, not a contract between the files, and
// a shared alias would invite widening one caller's id at another's expense.
const idSchema = z.string().min(1).max(64);
const localeSchema = z.string().min(2).max(10);

// ─── Links (ADR-068 §5) ──────────────────────────────────────

/**
 * A path INSIDE this site: exactly one leading slash, then a path character.
 *
 * The leading `\/(?!\/)` is the whole point. `//evil.example/x` is a
 * protocol-relative URL — a browser resolves it against the current scheme and
 * navigates off-site — and it satisfies every naive "starts with a slash"
 * check ever written. `externalUrlSchema` already refuses `javascript:` and
 * `data:` on the other branch; this refuses the one attack that looks internal.
 *
 * No locale prefix is stored. The renderer passes this to @repo/i18n's `Link`,
 * which adds the prefix for the reader's locale — storing `/es/...` would pin
 * an editor's link to one language.
 */
export const internalPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^\/(?!\/)[\w\-./~%?=&#+:@]*$/, "must be a site-relative path beginning with /");

/**
 * One link on a topic: a label plus exactly one destination.
 *
 * Shaped like `menuItemLinkSchema` (Module 08) and refined the same way, with
 * one widening it cannot offer: `routeKey` only addresses the static routes in
 * `ROUTE_PATHS`, and an editor linking to a specific course or article needs to
 * name a path that no registry contains.
 *
 * There is deliberately no `isExternal` field. Which branch is set says it, and
 * a stored copy is a second source of truth that goes stale the first time a
 * link is edited (ADR-068 §5).
 */
export const videoTopicLinkSchema = z
  .object({
    label: z.string().trim().min(1).max(200),
    path: internalPathSchema.nullable().optional(),
    url: externalUrlSchema.nullable().optional(),
  })
  .refine((value) => Boolean(value.path) !== Boolean(value.url), {
    message: "a link needs exactly one of path (internal) or url (external)",
    path: ["path"],
  });
export type VideoTopicLinkInput = z.infer<typeof videoTopicLinkSchema>;

// ─── Videos (ADR-068 §4) ─────────────────────────────────────

/**
 * One attached video. `assetId` is a `MediaAsset` of `kind: VIDEO`; the
 * provider whitelist for `externalUrl` is enforced in the service by
 * @repo/utils `parseVideoUrl`, exactly as `lessonMetaSchema.videoUrl` documents
 * — the contract shapes the value, the parser decides whether it can be framed.
 *
 * `posterAssetId` is only meaningful beside `assetId`: an external video's
 * thumbnail is derived by the parser. It is not rejected beside a URL, because
 * an editor who pastes a URL over an upload should not have a save refused for
 * a field they cannot see.
 */
export const videoTopicVideoSchema = z
  .object({
    id: idSchema.optional(),
    assetId: idSchema.nullable().optional(),
    externalUrl: externalUrlSchema.nullable().optional(),
    posterAssetId: idSchema.nullable().optional(),
    /** Display-only, and not translatable (ADR-068 §4). */
    title: z.string().trim().max(200).nullable().optional(),
    sortOrder: z.int().min(0).max(999),
  })
  .refine((value) => Boolean(value.assetId) !== Boolean(value.externalUrl), {
    message: "a video needs exactly one source: an uploaded asset or an external URL",
    path: ["assetId"],
  });
export type VideoTopicVideoInput = z.infer<typeof videoTopicVideoSchema>;

// ─── Topics ──────────────────────────────────────────────────

export const videoTopicMetaSchema = z.object({
  /**
   * Required (ADR-068 §1): the track is the URL's second segment, not a filter
   * over one, so it cannot be null for the same reason `Quiz.track` cannot.
   */
  track: learnTrackSchema,
  /** Nullable: a topic outlives the category it was filed under. */
  categoryId: idSchema.nullable().optional(),
  coverAssetId: idSchema.nullable().optional(),
  visibility: z.enum(["PUBLIC", "AUTHENTICATED", "PREMIUM"]).optional(),
  sortOrder: z.int().min(0).max(9999).optional(),
});
export type VideoTopicMetaInput = z.infer<typeof videoTopicMetaSchema>;

export const videoTopicTranslationSchema = z.object({
  locale: localeSchema,
  title: z.string().trim().min(1).max(255),
  /** Derived from the title when absent, like every other content slug. */
  slug: z.string().trim().max(255).optional(),
  summary: z.string().trim().max(1000).nullable().optional(),
  /** Sanitized server-side on save, always (security.md #8). This cap only bounds the payload. */
  content: z.string().max(400_000).nullable().optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(180).nullable().optional(),
  seoFocusKeyword: z.string().trim().max(100).nullable().optional(),
});
export type VideoTopicTranslationInput = z.infer<typeof videoTopicTranslationSchema>;

export const createVideoTopicSchema = z.object({
  title: z.string().trim().min(1).max(255),
  /** Asked for at creation: a topic cannot have a URL without one (ADR-068 §1). */
  track: learnTrackSchema,
  categoryId: idSchema.nullable().optional(),
});
export type CreateVideoTopicInput = z.infer<typeof createVideoTopicSchema>;

/**
 * The save payload, and the home of the capability rule.
 *
 * `videos` and `links` are REQUIRED rather than optional for the reason
 * `lessonInputSchema.attachments` records: an optional list cannot distinguish
 * a caller who sent nothing from one who cleared everything, so the rule would
 * pass or fail on what the caller meant rather than what they sent. Both are
 * full replacement sets.
 *
 * A topic with a body and no video is legitimate — a written guide filed under
 * a category. A topic with neither is an empty page someone will find on the
 * public site.
 */
export const videoTopicInputSchema = z
  .object({
    topicId: idSchema,
    meta: videoTopicMetaSchema.partial().extend({ track: learnTrackSchema.optional() }),
    translation: videoTopicTranslationSchema,
    videos: z.array(videoTopicVideoSchema).max(50),
    links: z.array(videoTopicLinkSchema).max(20),
  })
  .superRefine((value, ctx) => {
    const hasBody = (value.translation.content ?? "").trim().length > 0;
    if (value.videos.length === 0 && !hasBody) {
      ctx.addIssue({
        code: "custom",
        message: "a video topic needs at least one capability: a video, or body content",
        path: ["videos"],
      });
    }
  });
export type VideoTopicInput = z.infer<typeof videoTopicInputSchema>;

// ─── Categories (ADR-068 §1, shaped after GlossaryTopic / D27) ───

export const videoCategoryTranslationSchema = z.object({
  locale: localeSchema,
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(150).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(180).nullable().optional(),
});
export type VideoCategoryTranslationInput = z.infer<typeof videoCategoryTranslationSchema>;

export const videoCategoryInputSchema = z.object({
  /** Absent on create, present on update — one screen, one action. */
  categoryId: idSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.int().min(0).max(9999).optional(),
  translation: videoCategoryTranslationSchema,
});
export type VideoCategoryInput = z.infer<typeof videoCategoryInputSchema>;

export const reorderVideoCategoriesSchema = z.object({
  ids: z.array(idSchema).max(200),
});
export type ReorderVideoCategoriesInput = z.infer<typeof reorderVideoCategoriesSchema>;

// ─── Views (what the public pages read) ──────────────────────

/**
 * A resolved video, ready to render. The service has already decided which
 * branch it is; the page never re-parses a URL and never sees a raw one.
 *
 * `embedUrl` is what `parseVideoUrl` derived — the page hands it to
 * `VideoFacade` and nothing else. `src` is a same-origin `/uploads/…` path.
 */
export type VideoSourceView =
  | {
      kind: "upload";
      src: string;
      posterUrl: string | null;
      title: string | null;
    }
  | {
      kind: "embed";
      embedUrl: string;
      thumbnailUrl: string | null;
      title: string | null;
    };

export interface VideoTopicLinkView {
  label: string;
  href: string;
  /** Derived at render time from which branch was stored (ADR-068 §5). */
  isExternal: boolean;
}

export interface VideoCategoryView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Topics in THIS track only — a category spans tracks (ADR-068 §1). */
  topicCount: number;
}

export interface VideoTopicCardView {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  track: string;
  category: { slug: string; name: string } | null;
  coverUrl: string | null;
  videoCount: number;
}

export interface VideoTopicView {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: string | null;
  track: string;
  category: { slug: string; name: string } | null;
  coverUrl: string | null;
  videos: VideoSourceView[];
  links: VideoTopicLinkView[];
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: Date;
}
