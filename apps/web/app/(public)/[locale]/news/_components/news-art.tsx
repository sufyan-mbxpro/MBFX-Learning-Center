// The /news listing's image slots, resolved — `AboutArt`'s sibling
// (ADR-047 §3, ADR-051 §5).
//
// One component stands between the page and `NEWS_MEDIA` so the pattern's
// guarantee is enforced in one place: a `null` entry returns `null`, the
// caller's slot goes undefined, and the primitive falls back to its own
// panel. No section has to remember to check.
//
// `alt=""` on every piece, deliberately. These are backdrops — texture
// behind the copy, never information that exists only in the picture.
// Inventing a description for abstract artwork adds noise to a screen reader
// without adding a fact. If a slot ever holds a photograph that CARRIES
// meaning it needs a real alt string from the catalog, and this component
// needs an `alt` prop.
import Image from "next/image";

import { NEWS_MEDIA, type NewsMediaKey } from "../_content/news-media.ts";

/**
 * Full-bleed artwork for `PageHero`'s `backdrop` slot and the topics band.
 *
 * Not `AboutArt` with a prop, for the reason that component already gives:
 * everything `ImageReveal` contributes — the aspect box, the rounded
 * corners, the entrance wipe — is wrong for a background.
 */
export function NewsBackdrop({
  slot,
  priority = false,
}: {
  slot: NewsMediaKey;
  /** Set on the masthead only; the topics band is well below the fold. */
  priority?: boolean;
}) {
  const src = NEWS_MEDIA[slot];
  if (!src) return null;

  return (
    <Image
      src={src}
      alt=""
      fill
      priority={priority}
      // `unoptimized`, not `dangerouslyAllowSVG` in next.config: a few KB of
      // generated vector has nothing for the optimizer to win, and the config
      // flag would relax SVG handling for EVERY image the app serves,
      // admin-entered cover URLs included, to buy that nothing.
      unoptimized
      sizes="100vw"
      className="object-cover"
    />
  );
}
