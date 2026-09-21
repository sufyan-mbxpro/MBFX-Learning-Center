// `/support`'s imagery (changes-33) — the ADR-047 §3 pattern, kept from the
// About section it replaces.
//
// A `null` entry is not a defect: the masthead stands as a plain
// `--secondary` band (ADR-117), so the page ships complete with no
// photography committed, and a real asset lands later by editing this one
// line.
//
// `supportHero` is one of the owner's banners (changes-33), imported to WebP
// by `apps/web/scripts/import-owner-art.mjs`. Committed output, so a clone
// needs neither the script nor the source file.

export type SupportImage = string | null;

export const SUPPORT_MEDIA = {
  supportHero: "/banners/support.webp",
} satisfies Record<string, SupportImage>;

export type SupportMediaKey = keyof typeof SUPPORT_MEDIA;
