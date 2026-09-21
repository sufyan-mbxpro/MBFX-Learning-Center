import Image from "next/image";

import { TOOLS_MEDIA, type ToolsMediaKey } from "../_content/tools-media.ts";

/**
 * The tools index masthead's backdrop (changes-33) — the ADR-047 §3 pattern,
 * seventh instance.
 *
 * A `null` entry returns `null` and the masthead stands as a plain
 * `--secondary` band (ADR-117) rather than a broken image. The page never
 * has to check.
 *
 * `alt=""`: texture behind a headline, under a scrim. It carries nothing the
 * heading beside it does not.
 */
export function ToolsBackdrop({ slot }: { slot: ToolsMediaKey }) {
  const src = TOOLS_MEDIA[slot];
  if (!src) return null;

  return <Image src={src} alt="" fill priority sizes="100vw" className="object-cover" />;
}
