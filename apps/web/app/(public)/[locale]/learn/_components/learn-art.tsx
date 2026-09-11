// The Learn area's image slots, resolved — `NewsBackdrop`'s sibling
// (ADR-047 §3, ADR-051 §5).
//
// One component stands between the pages and `LEARN_MEDIA` so the pattern's
// guarantee is enforced in one place: a `null` entry returns `null`, the
// caller's slot goes undefined, and `PageHero` falls back to its own tone. No
// page has to remember to check.
//
// `alt=""` on every piece, deliberately. These are backdrops — texture behind
// the copy, never information that exists only in the picture. Inventing a
// description for abstract artwork adds noise to a screen reader without
// adding a fact.
import Image from "next/image";

import type { LearnTrackKey } from "@repo/contracts";
import { LEARN_MEDIA, LEARN_TRACK_MEDIA, type LearnMediaKey } from "../_content/learn-media.ts";

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
      // `unoptimized`, not `dangerouslyAllowSVG` in next.config: a few KB of
      // generated vector has nothing for the optimizer to win, and the config
      // flag would relax SVG handling for EVERY image the app serves,
      // admin-entered cover URLs included, to buy that nothing. Same trade
      // `NewsBackdrop` documents.
      unoptimized
      sizes="100vw"
      className="object-cover"
    />
  );
}

/**
 * A track's generated panel, used full-bleed as its school masthead
 * (ADR-065 §1). Same guarantee as `LearnBackdrop`: a track with no panel
 * returns `null` and `PageHero` falls back to its tone, so a third track can
 * be registered before its artwork exists without shipping a broken image.
 */
export function LearnTrackBackdrop({
  track,
  priority = false,
}: {
  track: LearnTrackKey;
  priority?: boolean;
}) {
  const src = LEARN_TRACK_MEDIA[track];
  if (!src) return null;

  return (
    <Image
      src={src}
      alt=""
      fill
      priority={priority}
      unoptimized
      sizes="100vw"
      className="object-cover"
    />
  );
}
