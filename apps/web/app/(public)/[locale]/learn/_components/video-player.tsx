"use client";

// The video topic's player (changes-16 PR 8, ADR-068 §4).
//
// ─── The source switch, and why it lives here rather than in the page ──────
//
// A `VideoSourceView` is already resolved by the time it reaches this file:
// `@repo/core`'s `videos.ts` decided which branch a stored row is and DROPPED
// any row it could not make safe (an external URL no provider recognises, an
// upload whose asset is gone). So this component never parses a URL, never
// sees a raw one, and has no fallback branch for "something else" — the type
// has two cases and both are rendered.
//
// **An upload is a same-origin `<video>`; an embed is a `VideoFacade`.** They
// are genuinely different elements with different privacy properties, which is
// why this is a switch rather than one component with a prop:
//
//   - The upload streams from `/uploads/[file]`, which already serves Range
//     requests, so the browser can seek without downloading the whole object.
//     `preload="metadata"` fetches the duration and the first frame and stops.
//   - The embed renders a facade — a poster and a play button — and injects
//     the provider's iframe only on click. Nothing from YouTube, Vimeo or
//     Dailymotion loads until the reader asks for it, so an unplayed page sets
//     no third-party cookie and makes no third-party request (ADR-015 #9).
//
// ─── One player, or a list ─────────────────────────────────────────────────
//
// Most topics carry one recording and it renders full width. A topic with
// several gets them stacked with their own titles, because a video's title is
// display-only (ADR-068 §4) and there is nowhere else for it to appear.
import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import type { VideoSourceView } from "@repo/contracts";
import { cn } from "@repo/ui/lib/utils";

import { VideoFacade } from "../../_components/video-facade.tsx";

export function VideoPlayer({
  videos,
  labels,
}: {
  videos: VideoSourceView[];
  labels: { play: string; poster: string };
}) {
  if (videos.length === 0) return null;

  return (
    <div className="flex flex-col gap-8">
      {videos.map((video, index) => (
        <figure key={index} className="flex flex-col gap-3">
          {video.kind === "embed" ? (
            <VideoFacade
              embedUrl={video.embedUrl}
              thumbnailUrl={video.thumbnailUrl}
              title={video.title ?? labels.play}
              playLabel={labels.play}
            />
          ) : (
            <UploadedVideo src={video.src} posterUrl={video.posterUrl} labels={labels} />
          )}
          {/* Only when the editor gave the recording a name. A caption that
              repeated the page's own title would be noise on a page that has
              exactly one video, which is most of them. */}
          {video.title && (
            <figcaption className="text-sm text-muted-foreground">{video.title}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

/**
 * A self-hosted recording.
 *
 * Its own facade rather than `controls` on a bare `<video>` from the first
 * frame, for one reason that is not aesthetic: with no poster, a `<video>`
 * element renders a black box until it has metadata, and `preload="metadata"`
 * on a page with three of them is three requests before the reader has asked
 * for anything. Holding the poster until click keeps the page at zero media
 * bytes, exactly as the embed facade does — so both branches of the switch
 * behave the same way from the reader's side.
 *
 * Once clicked it IS a plain `<video controls autoPlay>`: no custom controls,
 * so keyboard operation, captions, picture-in-picture and the platform's own
 * accessibility affordances are the browser's, not ours.
 */
function UploadedVideo({
  src,
  posterUrl,
  labels,
}: {
  src: string;
  posterUrl: string | null;
  labels: { play: string; poster: string };
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      // No <track>: an editor-uploaded recording has no caption file to point
      // one at, and an empty track element is worse than none — it advertises
      // captions that do not exist. The topic's written body is the text
      // alternative today; real captions are Module 14's, with the rest of the
      // a11y gate.
      <video
        src={src}
        poster={posterUrl ?? undefined}
        controls
        autoPlay
        playsInline
        preload="metadata"
        className="aspect-video w-full overflow-hidden rounded-lg border bg-black"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative aspect-video w-full overflow-hidden rounded-lg border bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt=""
          fill
          sizes="(min-width: 1024px) 48rem, 100vw"
          className="object-cover"
        />
      ) : (
        <span
          role="img"
          aria-label={labels.poster}
          className="absolute inset-0 bg-gradient-to-br from-primary/10 via-muted to-muted"
        />
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-black/25 transition-colors duration-(--duration-base) group-hover:bg-black/15"
      />
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          "transition-transform duration-(--duration-base) ease-(--ease-out-quint) group-hover:scale-105",
        )}
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-background/90 text-primary-interactive shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm">
          {/* `ms-1`, not `ml-1`: a triangle's optical centre is not its
              bounding box's, and the nudge has to flip in RTL (code-style #3). */}
          <Play aria-hidden className="ms-1 size-7 fill-current" />
        </span>
      </span>
      <span className="sr-only">{labels.play}</span>
    </button>
  );
}
