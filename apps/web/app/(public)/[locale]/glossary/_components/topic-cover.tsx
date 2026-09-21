// A glossary topic's picture (ADR-133) — the editor's upload when there is one,
// the glossary's own topic artwork when there is not.
//
// One component for both places the picture appears (the topic card and the
// topic page's masthead), so the fallback rule lives here and not twice. A
// topic nobody gave a cover still has one, and a deleted asset arrives from the
// loader as `null` and falls back too, never to a broken image.
//
// `alt=""`: on the card it sits beside the topic's own name, and on the
// masthead it is texture under a scrim. It carries nothing the words do not.
import Image from "next/image";

import { GLOSSARY_MEDIA } from "../_content/glossary-media.ts";

export function TopicCover({
  coverUrl,
  sizes,
  priority = false,
  className,
}: {
  coverUrl: string | null;
  /** Required: a card and a full-bleed masthead want very different variants. */
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const src = coverUrl ?? GLOSSARY_MEDIA.topicsBanner;
  if (!src) return null;

  return (
    <Image
      src={src}
      alt=""
      fill
      priority={priority}
      // Follows the FILE (changes-33): generated vector art skips the
      // optimiser, an uploaded raster goes through it.
      unoptimized={src.endsWith(".svg")}
      sizes={sizes}
      className={className ?? "object-cover"}
    />
  );
}
