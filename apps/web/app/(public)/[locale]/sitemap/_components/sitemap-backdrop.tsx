import Image from "next/image";

import { SITEMAP_MEDIA, type SitemapMediaKey } from "../_content/sitemap-media.ts";

/**
 * `/sitemap`'s hero backdrop (changes-39), `SupportBackdrop`'s twin.
 *
 * A `null` entry returns `null`, so the page can decide the masthead's tone
 * from the registry without ever rendering a broken image. `alt=""` because it
 * is texture behind a headline, under a scrim.
 */
export function SitemapBackdrop({ slot }: { slot: SitemapMediaKey }) {
  const src = SITEMAP_MEDIA[slot];
  if (!src) return null;

  return <Image src={src} alt="" fill priority sizes="100vw" className="object-cover" />;
}
