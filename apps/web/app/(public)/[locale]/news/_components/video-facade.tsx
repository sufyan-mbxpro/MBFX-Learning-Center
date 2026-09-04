"use client";

// Video facade (ADR-015 #9): thumbnail + play button only — the real
// iframe (youtube-nocookie / player.vimeo / dailymotion embed) is injected
// on click, so a page with a featured video costs nothing until played.
// The embed URL arrives pre-derived by @repo/utils parseVideoUrl; raw URLs
// are never trusted here.
import { useState } from "react";
import Image from "next/image";

export function VideoFacade({
  embedUrl,
  thumbnailUrl,
  title,
  playLabel,
}: {
  embedUrl: string;
  thumbnailUrl: string | null;
  title: string;
  playLabel: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border">
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

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={playLabel}
      className="group relative block aspect-video w-full overflow-hidden rounded-lg border bg-muted"
    >
      {thumbnailUrl && (
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-background/80 transition-transform group-hover:scale-110">
          {/* Play triangle — decorative, the button carries the label. */}
          <svg aria-hidden viewBox="0 0 24 24" className="ms-1 size-8 fill-foreground">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
