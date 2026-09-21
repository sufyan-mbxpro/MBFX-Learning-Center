// `/sitemap`'s imagery (changes-39) — the ADR-047 §3 pattern the support page
// uses.
//
// A `null` entry is not a defect: the masthead falls back to the `brand` band
// with its ambient motif (ADR-117), so removing the picture is one line here.
//
// `banner` is the owner's own artwork, imported to WebP by
// `apps/web/scripts/import-owner-art.mjs`. Committed output, so a clone needs
// neither the script nor the source file.

export type SitemapImage = string | null;

export const SITEMAP_MEDIA = {
  banner: "/banners/sitemap.webp",
} satisfies Record<string, SitemapImage>;

export type SitemapMediaKey = keyof typeof SITEMAP_MEDIA;
