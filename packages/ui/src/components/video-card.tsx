"use client";

// The video index card (changes-16 PR 7/10, ADR-068 §7) — `QuizCard`'s
// sibling, and its deliberate opposite in the one way that matters.
//
// ─── This card is NOT a stretched link ─────────────────────────────────────
//
// `CourseCard` paints a stretched `::after` over its header row and `QuizCard`
// over the whole card. This one does neither, and that is a decision rather
// than an omission (ADR-068 §7).
//
// A video card carries a play affordance over its thumbnail, and **playing is
// not navigating** — it is a second target with a different destination. One
// stretched link with a play button inside it has exactly two outcomes, both
// bad: the button sits under the overlay and cannot be reached by a pointer,
// or it punches a hole in the overlay and the card stops behaving like one
// link. So the title is an ordinary anchor, the play control is its own
// control with its own accessible name, and both are in the tab order.
//
// `video-card.test.tsx` asserts the inverse of `quiz-card.test.tsx`: no
// `after:inset-0` anywhere in the card, two named controls, no nesting.
//
// The cost is real and accepted: the body of the card is not clickable. A
// reader clicks the title or the play button, not the whitespace beside them.
// That is the price of the thumbnail having its own job.
import { Film, Play } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

/**
 * Which tonal Badge the category chip uses.
 *
 * The CALLER decides, exactly as it does for `QuizCard` and `CourseCard`:
 * @repo/ui carries no catalog and must not learn what "getting-started"
 * means. The public shelf derives one tone per category in one place, so a
 * category is the same colour on every card it appears on.
 */
export type VideoCardTone = "success" | "info" | "warning" | "eyebrow";

export interface VideoCardLabels {
  /** Accessible name of the play control, e.g. "Watch". */
  play: string;
  /** Alt-equivalent for the artwork placeholder. */
  noArtwork: string;
  /** Shown when the topic has no attached video — a written guide. */
  readGuide: string;
}

export function VideoCard({
  href,
  /**
   * Where the play control goes. Usually `href` plus the player's fragment:
   * the same page, arrived at with intent to watch. Absent when the topic
   * carries no video, and then no play control renders at all — an affordance
   * that cannot deliver is worse than none.
   */
  watchHref,
  title,
  description,
  categoryLabel,
  categoryTone = "eyebrow",
  videoCountLabel,
  coverUrl,
  highlighted = false,
  labels,
  renderCover,
  className,
}: {
  href: string;
  watchHref?: string | null;
  title: string;
  description?: string | null;
  categoryLabel?: string | null;
  categoryTone?: VideoCardTone;
  /** e.g. "3 videos". Absent on a topic with none. */
  videoCountLabel?: string | null;
  coverUrl?: string | null;
  /** Marks this card as matching the active category. */
  highlighted?: boolean;
  labels: VideoCardLabels;
  /**
   * Optional image renderer, so the app can pass `next/image` without
   * @repo/ui taking a dependency on Next (architecture.md #10). Required for
   * artwork to appear at all — there is deliberately no bare `<img>`
   * fallback, for the reason `CourseCard` documents: it would opt every cover
   * on the shelf out of `next/image` silently.
   */
  renderCover?: (args: { src: string; alt: string }) => React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        // Both group names, exactly as `QuizCard` does: `group/video` is what
        // the named variants below key off, and the bare `group` is what the
        // hand-written `.media-zoom` rule keys off (it selects `.group:hover`,
        // which a named-only group never matches).
        //
        // `.sheen` is here for its overflow and isolation, NOT to anchor a
        // stretched overlay — there is none. It still supplies the positioning
        // context the thumbnail's absolute children resolve against.
        "group group/video card-hover hover-lift sheen flex h-full min-w-0 flex-col rounded-2xl bg-card ring-1 ring-foreground/10 hover:ring-primary/30",
        highlighted && "ring-2 ring-primary/40 hover:ring-primary/50",
        className,
      )}
    >
      {/* 16:9, fixed — the shape of the player this thumbnail stands in for,
          so pressing play never reflows the grid. */}
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-t-2xl bg-muted">
        {coverUrl && renderCover ? (
          renderCover({ src: coverUrl, alt: "" })
        ) : (
          <span
            role="img"
            aria-label={labels.noArtwork}
            className="flex size-full items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-muted text-muted-foreground"
          >
            <Film aria-hidden className="size-10 opacity-40" />
          </span>
        )}

        {/* A scrim under the overlaid chips and the play button. No colour is
            chosen here: it is a black-to-transparent ramp over artwork, the
            same one `QuizCard` and `VideoTile` use, because a tinted badge
            over a picture needs its own ground. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/40 transition-opacity duration-(--duration-base) ease-(--ease-out-quint) group-hover/video:opacity-75"
        />

        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          {categoryLabel ? (
            <Badge
              variant={categoryTone}
              className="shadow-sm backdrop-blur-sm transition-transform duration-(--duration-base) ease-(--ease-out-quint) group-hover/video:scale-105"
            >
              {categoryLabel}
            </Badge>
          ) : (
            <span />
          )}
          {videoCountLabel ? (
            <Badge
              variant="info"
              className="shadow-sm backdrop-blur-sm transition-transform duration-(--duration-base) ease-(--ease-out-quint) group-hover/video:scale-105"
            >
              <Film aria-hidden />
              {videoCountLabel}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-background/85 shadow-sm backdrop-blur-sm">
              {labels.readGuide}
            </Badge>
          )}
        </div>

        {/* The second target. Centred over the thumbnail the way a player's
            own control is, so it reads as "play this" rather than as another
            way to open the page. It is a real link with its own accessible
            name — not an icon inside the title's hit area. */}
        {watchHref && (
          <a
            href={watchHref}
            aria-label={labels.play}
            className="absolute inset-0 z-10 flex items-center justify-center focus-visible:outline-none"
          >
            <span
              className={cn(
                "flex size-14 items-center justify-center rounded-full bg-background/85 text-primary-interactive shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm",
                "transition-transform duration-(--duration-base) ease-(--ease-out-quint)",
                "group-hover/video:scale-110 group-focus-within/video:scale-110",
              )}
            >
              {/* Inline-start-nudged rather than centred: a triangle's optical
                  centre is not its bounding box's. `ms-`, not `ml-`, so RTL
                  needs no rule of its own (code-style #3). */}
              <Play aria-hidden className="ms-0.5 size-6 fill-current" />
            </span>
          </a>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
        <h3 className="min-w-0 text-base font-semibold text-balance">
          {/* An ordinary anchor. No `after:inset-0` — see the header note. */}
          <a
            href={href}
            className="transition-colors duration-(--duration-base) group-hover/video:text-primary-interactive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {title}
          </a>
        </h3>

        {description && <p className="line-clamp-3 text-sm text-muted-foreground">{description}</p>}
      </div>
    </article>
  );
}
