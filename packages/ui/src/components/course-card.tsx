"use client";

// The `/learn` shelf card (changes-11 §9.2, card anatomy in §9.5; design pass
// 2026-09-09).
//
// Client, for exactly one reason: **D30's inline curriculum expansion.** The
// lesson list is already in the payload (`getLearnIndex` carries titles and
// slugs, never bodies), so expanding is a `useState` — fetching on expand
// would put a request in the path of a hover-speed interaction and could not
// be cached with the page.
//
// The layout front-loads the decision, following the FOREX.com reference: the
// title and CTA share the first row, difficulty and lesson count are BADGES
// rather than prose, and the summary sits under them. A reader scanning a
// shelf is answering "is this the right level and how long is it", and badges
// answer that without being read as a sentence.
//
// ─── The whole card is the link (design pass 2026-09-09) ───────────────────
//
// It used to be that only the title and the CTA navigated, so a click on the
// cover — the largest, most obviously clickable thing on the card — did
// nothing. The card now carries a STRETCHED LINK: the title's own anchor
// paints a transparent `::after` over the header region, which is why there
// is still exactly one link to the course in the accessibility tree and no
// nested anchors. Two consequences the markup has to honour, and does:
//
//   1. The overlay resolves against the nearest POSITIONED ancestor, so the
//      header row is `relative` and the expanded lesson list — a sibling
//      below it — stays clickable per row rather than being swallowed.
//   2. Every other control inside that row (the CTA, the disclosure) is
//      `relative z-10`, above the overlay. A control that is not raised is
//      unreachable, so anything added here must be raised too.
//
// An EXTERNAL course (D15) reads "Open course" and carries `ExternalBadge`; it
// is still a real page on our site, not a redirect (plan §11), so the card
// links to our course page and the outbound link lives there.
import { useId, useState } from "react";
import { ChevronDown, ChevronUp, Clock, GraduationCap, Layers, PlayCircle } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  CurriculumList,
  type CurriculumLabels,
  type CurriculumSection,
} from "@repo/ui/components/curriculum-list";
import { ExternalBadge } from "@repo/ui/components/external-badge";
import { cn } from "@repo/ui/lib/utils";

export interface CourseCardLabels extends CurriculumLabels {
  /** The CTA on an ordinary course, e.g. "Start". */
  start: string;
  /** The CTA on an external course, e.g. "Open course". */
  openExternal: string;
  showLessons: string;
  hideLessons: string;
  noArtwork: string;
}

/**
 * Which tonal Badge the level chip uses.
 *
 * A presentational choice the CALLER makes, because @repo/ui carries no
 * catalog and must not learn what "BEGINNER" means (code-style.md #2). The
 * public learn surfaces map difficulty → tone in one place
 * (`_lib/learn-labels.ts`), so the same level is the same colour everywhere.
 */
export type CourseLevelTone = "success" | "info" | "warning" | "eyebrow";

export function CourseCard({
  href,
  title,
  summary,
  difficultyLabel,
  difficultyTone = "eyebrow",
  lessonsLabel,
  durationLabel,
  videoLabel,
  coverUrl,
  isExternal = false,
  sections,
  labels,
  /**
   * Rendered in place of the default CTA. The progress island passes a
   * "Continue" button here once it knows the reader has started (ADR-056 #1) —
   * the card itself never reads a session.
   */
  cta,
  /**
   * Rendered under the summary, above the curriculum disclosure. The `/learn`
   * shelf's "pick up where you left off" band puts a progress bar here
   * (changes-11 PR 5.4); a card with no footer is unchanged, so this cannot
   * alter the ordinary shelf.
   */
  footer,
  /** Optional image renderer, so the app can pass `next/image` without
   * @repo/ui taking a dependency on Next (architecture.md #10). */
  renderCover,
  className,
}: {
  href: string;
  title: string;
  summary?: string | null;
  difficultyLabel: string;
  difficultyTone?: CourseLevelTone;
  lessonsLabel: string;
  durationLabel?: string | null;
  /** "2 videos", or null when the course has none. Omitted, no chip renders. */
  videoLabel?: string | null;
  coverUrl?: string | null;
  isExternal?: boolean;
  sections: CurriculumSection[];
  labels: CourseCardLabels;
  cta?: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Required for a cover to appear at all — there is deliberately NO bare
   * `<img>` fallback. @repo/ui must not depend on Next (architecture.md #10),
   * and a fallback would silently opt every cover on the shelf out of
   * `next/image`, which plan §13 requires with explicit `sizes`. Making the
   * renderer the only path means a caller that forgets it sees the placeholder
   * and notices, rather than shipping unoptimised images nobody spots.
   */
  renderCover?: (args: { src: string; alt: string }) => React.ReactNode;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  const hasLessons = sections.some((section) => section.lessons.length > 0);

  return (
    <article
      className={cn(
        // `sheen` sets position/overflow/isolation itself, so the light sweep
        // is clipped by the card's own radius without the call site
        // re-declaring any of it. `card-hover` lifts the ring, `hover-lift`
        // adds the rise — the two compose by design (globals.css).
        // Both group names, deliberately: `group/card` is what the named
        // `group-hover/card:` variants below key off, and the bare `group` is
        // what the hand-written `.media-zoom` rule in globals.css keys off
        // (it selects `.group:hover`, which a named-only group never matches).
        // A caller that puts `media-zoom` on its cover image gets the zoom
        // from a hover anywhere on the card because of this pair.
        "group group/card card-hover hover-lift sheen flex min-w-0 flex-col rounded-2xl bg-card ring-1 ring-foreground/10 hover:ring-primary/30",
        className,
      )}
    >
      {/* The stretched link's containing block. Everything inside it is part
          of the click target; everything below it is not. */}
      <div className="relative flex flex-col gap-4 sm:flex-row">
        {/* 16:9, fixed — a shelf whose cards are different heights because one
            course has no cover reads as broken rather than as varied. The
            placeholder occupies the same box. */}
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-t-2xl bg-muted sm:aspect-square sm:w-44 sm:rounded-s-2xl sm:rounded-e-none">
          {coverUrl && renderCover ? (
            renderCover({ src: coverUrl, alt: "" })
          ) : (
            <span
              role="img"
              aria-label={labels.noArtwork}
              className="flex size-full items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-muted text-muted-foreground"
            >
              <GraduationCap aria-hidden className="size-10 opacity-40" />
            </span>
          )}

          {/* A scrim under the level chip only — the chip sits on whatever the
              cover happens to be doing at that corner, and a tinted badge over
              a photograph needs its own ground. No colour is being chosen
              here: it is a black-to-transparent ramp over artwork, the same
              one VideoTile already uses for the same reason. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent"
          />
          <span className="absolute top-2.5 start-2.5">
            <Badge
              variant={difficultyTone}
              className="uppercase shadow-sm backdrop-blur-sm transition-transform duration-(--duration-base) ease-(--ease-out-quint) group-hover/card:scale-105"
            >
              {difficultyLabel}
            </Badge>
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 ps-0 max-sm:ps-4 max-sm:pt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="min-w-0 text-base font-semibold">
              {/* The stretched link. `after:` paints the overlay; the anchor
                  itself is still just the title, so its accessible name is the
                  course name and nothing else. */}
              <a
                href={href}
                className="transition-colors duration-(--duration-base) after:absolute after:inset-0 after:z-0 after:content-[''] group-hover/card:text-primary-interactive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {title}
              </a>
            </h3>
            {/* Raised above the overlay — see the header note. */}
            <div className="relative z-10">
              {cta ?? (
                <Button
                  size="sm"
                  variant={isExternal ? "outline" : "default"}
                  className="glow-on-hover"
                  render={<a href={href} />}
                >
                  {isExternal ? labels.openExternal : labels.start}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">
              <Layers aria-hidden />
              {lessonsLabel}
            </Badge>
            {durationLabel && (
              <Badge variant="outline">
                <Clock aria-hidden />
                {durationLabel}
              </Badge>
            )}
            {videoLabel && (
              <Badge variant="info">
                <PlayCircle aria-hidden />
                {videoLabel}
              </Badge>
            )}
            {isExternal && (
              <ExternalBadge label={labels.externalBadge} newTabLabel={labels.opensInNewTab} />
            )}
          </div>

          {summary && <p className="line-clamp-2 text-sm text-muted-foreground">{summary}</p>}

          {footer}

          {/* D30. Hidden entirely when the course has no published lessons —
              a disclosure that opens onto nothing is worse than none. */}
          {hasLessons && (
            <div className="relative z-10 mt-auto pt-1">
              <Button
                variant="ghost"
                size="xs"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded ? (
                  <ChevronUp data-icon="inline-start" aria-hidden />
                ) : (
                  <ChevronDown data-icon="inline-start" aria-hidden />
                )}
                {expanded ? labels.hideLessons : labels.showLessons}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Unmounted rather than hidden when collapsed: the list is already in
          the RSC payload, so there is nothing to re-fetch, and keeping a dozen
          collapsed lists in the DOM on a shelf of courses costs more than it
          saves. */}
      {hasLessons && expanded && (
        <div id={panelId} className="rounded-b-2xl border-t bg-muted/30 px-2 py-2">
          <CurriculumList sections={sections} labels={labels} variant="compact" />
        </div>
      )}
    </article>
  );
}
