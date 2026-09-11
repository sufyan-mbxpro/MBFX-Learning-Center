"use client";

// The quiz index card (design pass 2026-09-09) — `CourseCard`'s sibling.
//
// It is a sibling rather than a variant on purpose. A course card answers "is
// this the right level, and how long is it": a cover beside a copy column, a
// curriculum you can open, a duration. A quiz answers a different question —
// "how hard is this, and how did I do" — so the anatomy is portrait rather
// than landscape (three across, not two), the meter is the footer rather than
// an optional slot, and there is no disclosure at all. Forcing the two through
// one component would mean a prop for every difference and a card that is a
// compromise on both surfaces.
//
// ─── The whole card is the link ────────────────────────────────────────────
//
// `.sheen` already sets `position: relative`, so the title's stretched
// `::after` resolves against the ARTICLE and the whole card — cover included —
// navigates. There is still exactly one link to the quiz in the accessibility
// tree, and one consequence the markup must honour: the CTA is `relative z-10`
// so it sits above the overlay. A control that is not raised is present,
// focusable, and unclickable.
//
// ─── The meter is honest in both states ────────────────────────────────────
//
// With no `progress`, it shows the quiz's PASS MARK as a tick on an empty
// track — a property of the quiz, which is cached content, and which the page
// can render for a guest without reading a session. With `progress`, the same
// track fills to the learner's best score and the tick stays where it was, so
// the bar answers "did I clear the line" at a glance rather than by
// subtraction. The fill is never drawn from the pass mark alone: a 70% tick
// rendered as a 70% fill would tell every reader they were 70% done.
import { Award, ListChecks, RotateCcw, Target } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

/**
 * Which tonal Badge the category chip uses.
 *
 * The CALLER decides, exactly as it does for `CourseCard`'s difficulty:
 * @repo/ui carries no catalog and must not learn what "risk-management"
 * means. The public shelf derives one tone per category name in one place, so
 * a category is the same colour on every card it appears on.
 */
export type QuizCardTone = "success" | "info" | "warning" | "eyebrow";

export interface QuizCardLabels {
  /** CTA on a quiz the reader has not attempted. */
  start: string;
  /** CTA once they have. */
  retake: string;
  /** The meter's caption before any attempt, e.g. "Pass mark". */
  passMark: string;
  /** The meter's caption after one, e.g. "Your best". */
  yourBest: string;
  /** The verdict chip on a passed quiz. */
  passed: string;
  /** The accessible name of the meter, e.g. "Your best score". */
  meterLabel: string;
  /** Alt-equivalent for the artwork placeholder. */
  noArtwork: string;
}

export interface QuizCardProgress {
  /** Best completed score, 0-100. */
  bestPercentage: number;
  /** Already formatted for the locale, e.g. "85%". */
  bestLabel: string;
  passed: boolean;
  /** e.g. "2 attempts". Omitted, nothing renders in its place. */
  attemptsLabel?: string;
}

export function QuizCard({
  href,
  title,
  description,
  categoryLabel,
  categoryTone = "eyebrow",
  questionsLabel,
  passingScore,
  passingScoreLabel,
  coverUrl,
  progress,
  highlighted = false,
  labels,
  renderCover,
  className,
}: {
  href: string;
  title: string;
  description?: string | null;
  categoryLabel?: string | null;
  categoryTone?: QuizCardTone;
  questionsLabel: string;
  /** Where the tick sits, 0-100. */
  passingScore: number;
  /** That number formatted for the locale, e.g. "70%". */
  passingScoreLabel: string;
  coverUrl?: string | null;
  /**
   * Rendered once the learner's history is known. Absent for a guest, and
   * absent on the server render of a cached page — which is the point: the
   * card is complete without it and gains the fill when the island answers
   * (ADR-056 #1).
   */
  progress?: QuizCardProgress;
  /** Marks this card as matching the active category filter. */
  highlighted?: boolean;
  labels: QuizCardLabels;
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
  const attempted = progress !== undefined;
  const tone = !attempted ? "neutral" : progress.passed ? "success" : "warning";

  return (
    <article
      className={cn(
        // Both group names, deliberately, exactly as `CourseCard` does:
        // `group/quiz` is what the named variants below key off, and the bare
        // `group` is what the hand-written `.media-zoom` rule keys off (it
        // selects `.group:hover`, which a named-only group never matches).
        // `.sheen` supplies position/overflow/isolation, `.card-hover` lifts
        // the ring, `.hover-lift` adds the rise — all three compose.
        "group group/quiz card-hover hover-lift sheen flex h-full min-w-0 flex-col rounded-2xl bg-card ring-1 ring-foreground/10 hover:ring-primary/30",
        // The active filter's colour, carried onto the cards it produced. A
        // chip that lights up over a grid of identical cards leaves the reader
        // to trust that the grid changed; this shows it.
        highlighted && "ring-2 ring-primary/40 hover:ring-primary/50",
        className,
      )}
    >
      {/* 16:9, fixed. A grid whose cards are different heights because one
          quiz has no artwork reads as broken rather than as varied — and here
          none can be missing, because the panels are code. */}
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-t-2xl bg-muted">
        {coverUrl && renderCover ? (
          renderCover({ src: coverUrl, alt: "" })
        ) : (
          <span
            role="img"
            aria-label={labels.noArtwork}
            className="flex size-full items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-muted text-muted-foreground"
          >
            <ListChecks aria-hidden className="size-10 opacity-40" />
          </span>
        )}

        {/* A scrim under the overlaid chips. No colour is being chosen here:
            it is a black-to-transparent ramp over artwork, the same one
            `CourseCard` and `VideoTile` already use for the same reason — a
            tinted badge over a picture needs its own ground. It LIFTS on
            hover, so the artwork comes forward as the pointer arrives. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/40 transition-opacity duration-(--duration-base) ease-(--ease-out-quint) group-hover/quiz:opacity-75"
        />

        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          {categoryLabel ? (
            <Badge
              variant={categoryTone}
              className="shadow-sm backdrop-blur-sm transition-transform duration-(--duration-base) ease-(--ease-out-quint) group-hover/quiz:scale-105"
            >
              {categoryLabel}
            </Badge>
          ) : (
            <span />
          )}
          <Badge
            variant="info"
            className="shadow-sm backdrop-blur-sm transition-transform duration-(--duration-base) ease-(--ease-out-quint) group-hover/quiz:scale-105"
          >
            <ListChecks aria-hidden />
            {questionsLabel}
          </Badge>
        </div>

        {/* The verdict rides on the artwork rather than in the body, because
            it is the one thing a returning learner scans a grid for. */}
        {progress?.passed && (
          <span className="absolute bottom-2.5 start-2.5">
            <Badge variant="success" className="shadow-sm backdrop-blur-sm">
              <Award aria-hidden />
              {labels.passed}
            </Badge>
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
        <h3 className="min-w-0 text-base font-semibold text-balance">
          {/* The stretched link. `after:` paints the overlay across the whole
              card; the anchor itself is still just the title, so its
              accessible name is the quiz's name and nothing else. */}
          <a
            href={href}
            className="transition-colors duration-(--duration-base) after:absolute after:inset-0 after:z-0 after:content-[''] group-hover/quiz:text-primary-interactive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {title}
          </a>
        </h3>

        {description && <p className="line-clamp-3 text-sm text-muted-foreground">{description}</p>}

        <div className="mt-auto flex flex-col gap-3 pt-3">
          <ScoreMeter
            passingScore={passingScore}
            passingScoreLabel={passingScoreLabel}
            progress={progress}
            tone={tone}
            labels={labels}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {progress?.attemptsLabel ?? ""}
            </span>
            {/* Raised above the stretched overlay — see the header note. */}
            <Button
              size="sm"
              variant={attempted ? "outline" : "default"}
              className="glow-on-hover relative z-10"
              render={<a href={href} />}
            >
              {attempted ? (
                <RotateCcw data-icon="inline-start" aria-hidden />
              ) : (
                <ListChecks data-icon="inline-start" aria-hidden />
              )}
              {attempted ? labels.retake : labels.start}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Fill tone per state. Solid hues rather than the `-interactive` inks the
 * badges use: this is a block of colour on its own muted track, not small
 * text, so ADR-018 rule 5's small-text trap does not apply to the BAR. The
 * caption beside it is what has to be legible, and that one does take the
 * derived ink.
 */
const METER_FILL = {
  neutral: "bg-primary/70",
  success: "bg-success",
  warning: "bg-warning",
} as const;

const METER_CAPTION = {
  neutral: "text-muted-foreground",
  success: "text-success-interactive",
  warning: "text-warning-interactive",
} as const;

/**
 * The pass mark as a tick, the learner's best as a fill.
 *
 * Hand-built rather than `Progress`, for one reason that matters: the tick.
 * Base UI's Progress owns its track and indicator markup, so a threshold
 * marker cannot go inside it, and a marker painted outside would drift from
 * the fill the moment either changes. The a11y contract is reproduced
 * explicitly — `role="progressbar"` with the three aria values — and only when
 * there is a value to announce: an untaken quiz has no progress, and a
 * progressbar pinned at 0 on every card is noise in a screen reader's ear.
 * The caption carries the same fact in text either way.
 */
function ScoreMeter({
  passingScore,
  passingScoreLabel,
  progress,
  tone,
  labels,
}: {
  passingScore: number;
  passingScoreLabel: string;
  progress?: QuizCardProgress;
  tone: keyof typeof METER_FILL;
  labels: QuizCardLabels;
}) {
  const clamp = (value: number) => Math.min(100, Math.max(0, value));
  const mark = clamp(passingScore);
  const fill = progress ? clamp(progress.bestPercentage) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Target aria-hidden className="size-3.5" />
          {progress ? labels.yourBest : labels.passMark}
        </span>
        <span className={cn("font-semibold tabular-nums", METER_CAPTION[tone])}>
          {progress ? progress.bestLabel : passingScoreLabel}
        </span>
      </div>

      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
        {...(progress
          ? {
              role: "progressbar",
              "aria-label": labels.meterLabel,
              "aria-valuenow": fill,
              "aria-valuemin": 0,
              "aria-valuemax": 100,
            }
          : { "aria-hidden": true })}
      >
        <span
          className={cn(
            "absolute inset-y-0 start-0 rounded-full transition-[width] duration-(--duration-slow) ease-(--ease-out-quint)",
            METER_FILL[tone],
          )}
          style={{ width: `${fill}%` }}
        />
        {/* The pass mark. Positioned with the logical `insetInlineStart`, so it
            runs from the correct edge in RTL with no [dir] rule — a percentage
            in `left` would not. */}
        <span
          aria-hidden
          className="absolute inset-y-0 w-0.5 bg-foreground/45"
          style={{ insetInlineStart: `${mark}%` }}
        />
      </div>
    </div>
  );
}
