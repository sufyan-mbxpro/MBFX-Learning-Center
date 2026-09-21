import Image from "next/image";

import { SUPPORT_MEDIA, type SupportMediaKey } from "../_content/support-media.ts";

/**
 * `/support`'s hero backdrop (changes-33).
 *
 * One component between the page and `SUPPORT_MEDIA` so ADR-047 §3's
 * guarantee is enforced in exactly one place: a `null` entry returns `null`
 * and the masthead stands as a plain `--secondary` band (ADR-117) rather
 * than a broken image. The page never has to check.
 *
 * `alt=""` deliberately. It is texture behind a headline, under a scrim —
 * it carries nothing the copy beside it does not, and inventing a description
 * for it would add noise to a screen reader without adding a fact.
 */
export function SupportBackdrop({ slot }: { slot: SupportMediaKey }) {
  const src = SUPPORT_MEDIA[slot];
  if (!src) return null;

  return <Image src={src} alt="" fill priority sizes="100vw" className="object-cover" />;
}
