// Media & brand-asset contracts (changes-02, ADR-017). The upload action
// parses `purpose` through here to pick its permission gate; the bytes
// themselves are validated in @repo/core's media service (magic-byte
// sniff + size cap), never by the client's declared type.
import { z } from "zod";

/** Where an upload is headed — decides the permission gate (ADR-017). */
export const uploadPurposeSchema = z.enum(["brand", "setting", "article", "content"]);
export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

/** Site-relative path or absolute URL — same rule as the IMAGE settings. */
export const storedImageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .regex(/^(\/|https?:\/\/)/, "must be a path or URL");

/**
 * The BrandAsset slots the theme editor's Logos & Favicons tab manages.
 * `og_image` deliberately stays with the `seo.defaultOgImage` setting —
 * one home per asset, not two.
 */
export const brandAssetKeySchema = z.enum(["logo_light", "logo_dark", "favicon"]);
export type BrandAssetKey = z.infer<typeof brandAssetKeySchema>;
export const BRAND_ASSET_KEYS = brandAssetKeySchema.options;

export const setBrandAssetSchema = z.object({
  key: brandAssetKeySchema,
  /** A MediaAsset id from a prior upload — the service resolves the URL. */
  mediaAssetId: z.string().min(1).max(64),
  altText: z.string().trim().max(255).nullable().optional(),
});
export type SetBrandAssetInput = z.infer<typeof setBrandAssetSchema>;

// ─── Media v2 (ADR-034) ──────────────────────────────────────

export const mediaKindSchema = z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]);
export type MediaKindInput = z.infer<typeof mediaKindSchema>;

const mediaTagSchema = z.string().trim().toLowerCase().min(1).max(40);

// ─── Categories (ADR-066) ────────────────────────────────────

/**
 * The library's sections. A code registry, not a table (ADR-066 §1): a
 * category is structure, and ADR-042 settled that structure lives in code
 * while content data lives in the database — the same split ADR-048 made
 * for the mega menu.
 *
 * Adding one is an entry here plus an `admin.mediaCategory.*` catalog key.
 * Removing one needs a superseding ADR: the key is embedded in `folder`, so
 * dropping it strands every asset filed under it.
 */
export const MEDIA_CATEGORIES = ["news", "learn", "brand", "general"] as const;
export const mediaCategorySchema = z.enum(MEDIA_CATEGORIES);
export type MediaCategory = z.infer<typeof mediaCategorySchema>;

export const DEFAULT_MEDIA_CATEGORY: MediaCategory = "general";

/**
 * The picker's "All categories" option. A NAMED sentinel rather than `""` —
 * an empty value reads as "nothing selected" to a listbox, and this is a
 * deliberate choice. Same reasoning as the glossary's "Both schools" option.
 */
export const ALL_MEDIA_CATEGORIES = "__all__" as const;

/** Type names are NOT folder segments (ADR-066 §3) — `kind` is the type axis. */
const KIND_LIKE_SEGMENTS = new Set(["images", "videos", "audio", "documents", "image", "video"]);

/**
 * `/news` or `/news/2026-covers`. Only the FIRST segment is constrained, so
 * ADR-034 §2's free sub-paths survive; a sub-path that names a media type is
 * refused, because that would be a second source of truth for `kind`
 * (ADR-066 §3).
 */
export const mediaFolderSchema = z
  .string()
  .trim()
  .max(300)
  .regex(/^\/[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/, "must be a lower-case absolute path")
  .refine(
    (value) => mediaCategorySchema.safeParse(value.split("/")[1]).success,
    `first segment must be one of: ${MEDIA_CATEGORIES.join(", ")}`,
  )
  .refine(
    (value) =>
      !value
        .split("/")
        .slice(2)
        .some((segment) => KIND_LIKE_SEGMENTS.has(segment)),
    "media type is stored in `kind`, not in the folder path",
  );

/** `/news` for `news` — the folder an upload lands in when it names no sub-path. */
export function folderForCategory(category: MediaCategory): string {
  return `/${category}`;
}

/** The category a stored folder belongs to, or null for a path that predates ADR-066. */
export function categoryOfFolder(folder: string): MediaCategory | null {
  const parsed = mediaCategorySchema.safeParse(folder.split("/")[1]);
  return parsed.success ? parsed.data : null;
}

export const updateMediaMetaSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  altText: z.string().trim().max(500).nullable().optional(),
  folder: mediaFolderSchema.optional(),
  tags: z.array(mediaTagSchema).max(20).optional(),
});
export type UpdateMediaMetaInput = z.infer<typeof updateMediaMetaSchema>;

// ─── Browsing (ADR-067) ──────────────────────────────────────

/**
 * The page size the picker and library open with, and the ceiling any caller
 * can ask for. ADR-067 §1: there is no `limit: 0`, no `Infinity` and no
 * `all: true` — the absence of an unbounded option IS the enforcement of the
 * owner's "never load the whole library" rule, so do not add one here without
 * superseding that ADR.
 */
export const MEDIA_PAGE_SIZE = 48;
export const MAX_MEDIA_PAGE_SIZE = 100;

/**
 * Mirrors `ReferenceSourceType` in the Prisma schema. Restated here rather
 * than imported because `@repo/contracts` depends on nothing (its whole job
 * is to be the shared vocabulary); `mediaSourceTypeSchema` failing to parse a
 * value the database accepts is the signal that the two drifted.
 */
export const mediaSourceTypeSchema = z.enum([
  "PAGE_VERSION",
  "MENU_ITEM",
  "CARD_TEMPLATE",
  "STYLE_PRESET",
  "LAYOUT_TEMPLATE",
  "ARTICLE",
  "COURSE",
  "BRAND",
  "SETTING",
]);
export type MediaSourceType = z.infer<typeof mediaSourceTypeSchema>;

/**
 * Query-string friendly: `kind` arrives as one value or a repeated param, and
 * `limit` as a string. Coerced and clamped here so the route handler never
 * casts (security.md #6).
 */
export const listMediaAssetsQuerySchema = z.object({
  category: mediaCategorySchema.optional(),
  folder: mediaFolderSchema.optional(),
  kind: mediaKindSchema.optional(),
  kinds: z
    .union([mediaKindSchema, z.array(mediaKindSchema).min(1).max(4)])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .optional(),
  q: z.string().trim().min(1).max(100).optional(),
  tag: mediaTagSchema.optional(),
  cursor: z.string().trim().min(1).max(200).optional(),
  limit: z.union([z.number(), z.string()]).optional().transform(clampPageSize),
  /**
   * Chrome the picker needs ONCE, when it opens — facet counts and the
   * recently-used strip — folded into the grid request so opening a picker
   * is exactly one round trip (ADR-067 §1). Tab changes, searches and page
   * loads omit it and stay small.
   */
  include: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      const raw = Array.isArray(value) ? value : (value?.split(",") ?? []);
      const wanted = new Set(raw.map((entry) => entry.trim()));
      return { facets: wanted.has("facets"), recent: wanted.has("recent") };
    }),
  /** Scopes the recently-used strip to the surface asking for it. */
  sourceType: mediaSourceTypeSchema.optional(),
});
export type ListMediaAssetsQuery = z.infer<typeof listMediaAssetsQuerySchema>;

/**
 * Always returns a bounded page size — never throws, and has no input that
 * produces "everything". `Infinity`, `0`, a negative and `"abc"` all land on
 * a real page, which is what makes ADR-067 §1's invariant structural rather
 * than a convention someone has to remember.
 */
export function clampPageSize(value: number | string | undefined): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  if (parsed === undefined || !Number.isFinite(parsed)) return MEDIA_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_MEDIA_PAGE_SIZE);
}
