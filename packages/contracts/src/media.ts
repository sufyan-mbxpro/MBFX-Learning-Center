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

export const updateMediaMetaSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  altText: z.string().trim().max(500).nullable().optional(),
  folder: z.string().trim().max(300).regex(/^\//, "must be an absolute folder path").optional(),
  tags: z.array(mediaTagSchema).max(20).optional(),
});
export type UpdateMediaMetaInput = z.infer<typeof updateMediaMetaSchema>;

export const listMediaAssetsQuerySchema = z.object({
  kind: mediaKindSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
export type ListMediaAssetsQuery = z.infer<typeof listMediaAssetsQuerySchema>;
