// The Learn area's image slots, resolved — `NewsBackdrop`'s sibling
// (ADR-047 §3, ADR-051 §5).
//
// One component stands between the pages and `LEARN_MEDIA` so the pattern's
// guarantee is enforced in one place: a `null` entry returns `null`, the
// caller's slot renders nothing, and the masthead stands as a plain
// `--secondary` band (ADR-117) rather than a broken image. No
// page has to remember to check.
//
// `alt=""` on every piece, deliberately. These are backdrops — texture behind
// the copy, never information that exists only in the picture. Inventing a
// description for abstract artwork adds noise to a screen reader without
// adding a fact.
import Image from "next/image";

import type { LearnTrackKey } from "@repo/contracts";
import { LEARN_MEDIA, LEARN_TRACK_BANNER, type LearnMediaKey } from "../_content/learn-media.ts";

export function LearnBackdrop({
  slot,
  priority = false,
}: {
  slot: LearnMediaKey;
  /** Set on the masthead only — it is the LCP candidate on its route. */
  priority?: boolean;
}) {
  const src = LEARN_MEDIA[slot];
  if (!src) return null;

  return (
    <Image
      src={src}
      alt=""
      fill
      priority={priority}
      // SVG only (changes-33). These slots used to be generated vector
      // exclusively, and `unoptimized` was the alternative to setting
      // `dangerouslyAllowSVG` in next.config — which would relax SVG handling
      // for EVERY image the app serves, admin-entered cover URLs included, to
      // buy nothing on a few KB of vector. Now that the owner's photography
      // fills most of them, an unconditional flag would also mean shipping a
      // 1920px WebP to a phone. So the flag follows the FILE: vector stays
      // unoptimized, raster goes through the optimizer and gets its srcset.
      unoptimized={src.endsWith(".svg")}
      sizes="100vw"
      className="object-cover"
    />
  );
}

/**
 * A track's generated panel, used full-bleed as its school masthead
 * (ADR-065 §1). Same guarantee as `LearnBackdrop`: a track with no panel
 * returns `null` and the masthead stands as a plain `--secondary` band
 * (ADR-117), so a third track can be registered before its artwork exists
 * without shipping a broken image.
 */
export function LearnTrackBackdrop({
  track,
  priority = false,
}: {
  track: LearnTrackKey;
  priority?: boolean;
}) {
  const src = LEARN_TRACK_BANNER[track];
  if (!src) return null;

  return (
    <Image
      src={src}
      alt=""
      fill
      priority={priority}
      unoptimized={src.endsWith(".svg")}
      sizes="100vw"
      className="object-cover"
    />
  );
}
