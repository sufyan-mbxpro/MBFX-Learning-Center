"use client";

// The learning showcase's video tile.
//
// A facade, exactly like `video-facade.tsx` beside it (ADR-015 #9):
// poster only until someone presses play, at which point the iframe is
// injected. A homepage carrying six videos costs six inline SVGs and zero
// third-party requests until a visitor asks for one.
//
// Why not just reuse VideoFacade: that one is the INLINE-IN-AN-ARTICLE
// treatment — a bordered box with a centred play glyph, sized to a prose
// column, and it always has a video. This one is a showcase tile with copy
// laid over the poster and hover choreography. Same mechanism, different job.
// The mechanism that matters — never put a raw URL in `src` — is upstream of
// both: `@repo/core` resolves every stored video to a `VideoSourceView` on the
// server and a tile with no resolved source never receives one.
//
// ─── Two targets, for the reason ADR-068 §7 gives ─────────────────────────
//
// Since changes-28 (ADR-092) every tile stands for a real `VideoTopic` with a
// page of its own, so PLAYING and NAVIGATING are two different destinations —
// the distinction `VideoCard` already draws on the videos shelf. A playable
// tile is therefore a full-bleed play BUTTON with the title anchor sitting
// above it, not one control doing both jobs. They are siblings, never nested:
// an <a> inside a <button> is invalid, and an overlay that swallows the title
// is the bug ADR-068 §7 was written about.
//
// A topic with no recording is NOT a hole and no longer says "coming soon".
// It is a written guide that exists today, so the whole tile is one ordinary
// link to it and there is no second target to protect.
import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

export function VideoTile({
  embedUrl,
  poster,
  href,
  title,
  description,
  level,
  playLabel,
  guideLabel,
  openLabel,
}: {
  /** Pre-resolved on the server; null means this topic carries no recording. */
  embedUrl: string | null;
  poster: string;
  /** The topic's own page — where the title, and an unplayable tile, lead. */
  href: string;
  title: string;
  description: string | null;
  /** The category chip. Null on an unfiled topic — then no chip renders,
   *  because a chip reading "Uncategorised" is a label for the database's
   *  benefit, not the reader's. */
  level: string | null;
  playLabel: string;
  /** The corner badge on a tile that cannot play in place: "Read the guide"
   *  when there is no recording at all, "Watch" when there is one the rail's
   *  facade cannot host. */
  guideLabel: string;
  /** Accessible name for the whole-tile link on an unplayable topic. */
  openLabel: string;
}) {
  const [playing, setPlaying] = useState(false);
  const playable = embedUrl !== null;

  // Once playing, the tile IS the player. Same 16:9 box the poster occupied,
  // so the rail does not reflow around it.
  if (playing && embedUrl) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-secondary ring-1 ring-foreground/10">
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
        className="media-zoom object-cover"
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

  const shell =
    "group hover-lift sheen relative block aspect-video w-full overflow-hidden rounded-lg bg-secondary ring-1 ring-foreground/10 transition-shadow duration-(--duration-base) hover:ring-primary/40";

  // No recording: one ordinary link over the whole tile. `text-white` and not
  // a token throughout the copy below — this ink sits on the scrim above, not
  // on any themed surface, so `--foreground` would invert with the mode and
  // vanish against the same dark artwork in light mode.
  if (!playable) {
    return (
      <a
        href={href}
        aria-label={openLabel}
        className={cn(
          shell,
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        {media}
        <span className="absolute end-4 top-4">
          <Badge variant="pill" className="bg-black/50 text-white backdrop-blur-sm">
            {guideLabel}
          </Badge>
        </span>
        <span className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-5 text-start">
          {level && (
            <Badge variant="pill" className="bg-white/15 text-white backdrop-blur-sm">
              {level}
            </Badge>
          )}
          <span className="text-base font-semibold text-balance text-white">{title}</span>
          {description && (
            <span className="line-clamp-2 text-sm text-pretty text-white/75">{description}</span>
          )}
        </span>
      </a>
    );
  }

  return (
    <article className={shell}>
      {media}

      {/* Target one: the whole tile plays. Underneath the copy layer, so the
          title anchor above it keeps its own hit area. */}
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label={playLabel}
        className="absolute inset-0 z-0 cursor-pointer focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
      />

      {/* The play control. `--primary` as a large filled disc is exactly what
          ADR-018 rule 5 reserves it for, and `--primary-foreground` is the
          ink ADR-003 contrast-checks against it. Inert: the button above owns
          the whole surface, so this is decoration on top of it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg backdrop-blur-sm transition-transform duration-(--duration-base) ease-(--ease-out-quint) group-hover:scale-110 group-focus-within:scale-110">
          {/* Nudged along the inline axis so the triangle looks centred in
              the disc; `ms-` and not `ml-`, so it nudges the other way in RTL
              where the glyph is mirrored. */}
          <Play aria-hidden className="ms-1 size-6 fill-current rtl:-scale-x-100" />
        </span>
      </span>

      {/* Target two: the copy, with the title linking to the topic's page.
          `pointer-events-none` on the block and `-auto` on the anchor, so the
          words that are not the title still play the video. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-2 p-5 text-start">
        {level && (
          <Badge variant="pill" className="bg-white/15 text-white backdrop-blur-sm">
            {level}
          </Badge>
        )}
        <a
          href={href}
          className="pointer-events-auto text-base font-semibold text-balance text-white underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {title}
        </a>
        {description && (
          <span className="line-clamp-2 text-sm text-pretty text-white/75">{description}</span>
        )}
      </span>
    </article>
  );
}
