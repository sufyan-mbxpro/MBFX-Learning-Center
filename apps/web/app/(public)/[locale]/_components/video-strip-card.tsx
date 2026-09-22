// One card in the homepage's video strip (changes-51).
//
// Small on purpose: a cover, a scrim and the title — the owner's reference
// is a row of five location tiles, not a shelf of players. So unlike
// `VideoTile` it has ONE target: the whole card links to the topic page,
// where the real player lives. A facade that swapped a 200px card for an
// iframe would be a player too small to watch.
import Image from "next/image";
import { Play } from "lucide-react";

import { Link } from "@repo/i18n/navigation";

export function VideoStripCard({
  href,
  poster,
  title,
  hasVideo,
}: {
  href: string;
  poster: string;
  title: string;
  /** A topic with a playable source gets the play mark; a guide does not. */
  hasVideo: boolean;
}) {
  return (
    <Link
      href={href}
      className="group hover-lift relative block aspect-16/10 w-full overflow-hidden rounded-md bg-secondary ring-1 ring-foreground/10 transition-shadow duration-(--duration-base) hover:ring-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Image
        src={poster}
        alt=""
        fill
        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
        className="media-zoom object-cover"
      />
      {/* The same black-to-transparent ramp `VideoTile` uses, for its reason:
          the words sit on an arbitrary cover, not on a themed surface, so the
          ink is white rather than a token that inverts with the mode. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
      />
      {hasVideo && (
        <span
          aria-hidden
          className="absolute end-2 top-2 grid size-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm"
        >
          <Play className="size-3.5 fill-current" />
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 p-3 text-center text-sm font-semibold text-balance text-white">
        <span className="line-clamp-2">{title}</span>
      </span>
    </Link>
  );
}
