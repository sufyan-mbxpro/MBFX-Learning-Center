"use client";

// The learning showcase's video tile.
//
// A facade, exactly like `news/_components/video-facade.tsx` (ADR-015 #9):
// poster only until someone presses play, at which point the iframe is
// injected. A homepage carrying six videos costs six inline SVGs and zero
// third-party requests until a visitor asks for one.
//
// Why not just reuse VideoFacade: that one is the INLINE-IN-AN-ARTICLE
// treatment — a bordered box with a centred play glyph, sized to a prose
// column, and it always has a video. This one is a showcase tile with copy
// laid over the poster, hover choreography, and a third state VideoFacade
// has no concept of ("no recording yet"). Same mechanism, different job. The
// mechanism that matters — never put a raw URL in `src` — is upstream of
// both: `parseVideoUrl` derives `embedUrl` on the server and a tile with no
// parse result never receives one.
import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

export function VideoTile({
  embedUrl,
  poster,
  title,
  description,
  level,
  playLabel,
  soonLabel,
}: {
  /** Pre-derived by `parseVideoUrl` on the server; null means no recording yet. */
  embedUrl: string | null;
  poster: string;
  title: string;
  description: string;
  level: string;
  playLabel: string;
  soonLabel: string;
}) {
  const [playing, setPlaying] = useState(false);
  const playable = embedUrl !== null;

  // Once playing, the tile IS the player. Same 16:9 box the poster occupied,
  // so the rail does not reflow around it.
  if (playing && embedUrl) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-secondary ring-1 ring-foreground/10">
        <iframe
          src={`${embedUrl}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }

  const media = (
    <>
      <Image
        src={poster}
        alt=""
        fill
        sizes="(max-width: 640px) 86vw, (max-width: 1024px) 64vw, 46vw"
        className={cn("object-cover", playable && "media-zoom")}
      />
      {/* Legibility scrim. A gradient over the poster's own dark ground, so
          the copy below sits on ink rather than on whatever the motif happens
          to be doing at that corner. Not a colour decision — no token is
          being chosen here, it is a black-to-transparent ramp over artwork
          that is already dark by construction. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent"
      />
    </>
  );

  const copy = (
    <span className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-5 text-start">
      <Badge variant="pill" className="bg-white/15 text-white backdrop-blur-sm">
        {level}
      </Badge>
      {/* text-white, not a token: this ink sits on the scrim above, not on
          any themed surface, so --foreground would invert with the mode and
          become invisible on the same dark artwork in light mode. */}
      <span className="text-base font-semibold text-balance text-white">{title}</span>
      <span className="line-clamp-2 text-sm text-pretty text-white/75">{description}</span>
    </span>
  );

  // No recording yet: a finished tile, deliberately inert. No `group`, so
  // none of the hover choreography fires — a tile that reacts to the pointer
  // and then does nothing promises an interaction it does not have.
  if (!playable) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-secondary ring-1 ring-foreground/10">
        {media}
        <span className="absolute top-4 end-4">
          <Badge variant="pill" className="bg-black/50 text-white backdrop-blur-sm">
            {soonLabel}
          </Badge>
        </span>
        {copy}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={playLabel}
      className="group hover-lift sheen relative block aspect-video w-full overflow-hidden rounded-2xl bg-secondary text-start ring-1 ring-foreground/10 transition-[box-shadow] duration-(--duration-base) hover:ring-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {media}
      {/* The play control. `--primary` as a large filled disc is exactly what
          ADR-018 rule 5 reserves it for, and `--primary-foreground` is the
          ink ADR-003 contrast-checks against it. */}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg backdrop-blur-sm transition-transform duration-(--duration-base) ease-(--ease-out-quint) group-hover:scale-110 group-focus-visible:scale-110">
          {/* Nudged along the inline axis so the triangle looks centred in
              the disc; `ms-` and not `ml-`, so it nudges the other way in RTL
              where the glyph is mirrored. */}
          <Play aria-hidden className="ms-1 size-7 fill-current rtl:-scale-x-100" />
        </span>
      </span>
      {copy}
    </button>
  );
}
