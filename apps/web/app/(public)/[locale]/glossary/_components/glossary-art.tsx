// The glossary's image slots, resolved — `LearnBackdrop`'s sibling
// (ADR-047 §3, ADR-051 §5).
//
// One component stands between the pages and `GLOSSARY_MEDIA` so the pattern's
// guarantee is enforced in one place: a `null` entry returns `null`, the
// caller's slot goes undefined, and `PageHero` falls back to its own tone. No
// page has to remember to check.
//
// `alt=""` on every piece, deliberately. These are backdrops — texture behind
// the copy, never information that exists only in the picture. Inventing a
// description for abstract artwork adds noise to a screen reader without
// adding a fact.
import Image from "next/image";

import { GLOSSARY_MEDIA, type GlossaryMediaKey } from "../_content/glossary-media.ts";

export function GlossaryBackdrop({
  slot,
  priority = false,
}: {
  slot: GlossaryMediaKey;
  /** Set on the masthead only — it is the LCP candidate on its route. */
  priority?: boolean;
}) {
  const src = GLOSSARY_MEDIA[slot];
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
