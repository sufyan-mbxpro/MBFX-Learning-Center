// A course's sections and lessons (changes-11 §9.2, redesigned changes-24).
//
// THREE variants, one component, because they are the same list at three
// densities and keeping them apart would mean three places to fix a state
// marker:
//
//   `full`    the course page — sections as an accordion, lessons drawn as a
//             TIMELINE: a play mark per lesson, joined by a connector, the
//             whole row one stretched link (ADR-082 #1)
//   `rail`    the lesson page's 18rem sidebar and its mobile Sheet — the same
//             list at rail width, where the reading time sits UNDER the title
//             instead of beside it (ADR-082 #2)
//   `compact` the D30 card expansion — a flat list, titles and reading time
//
// **Why `rail` exists rather than `full` shrinking.** `full` puts the title
// and the duration on one line. In a 16rem column that left the title about
// 78px of it, so "Technical Analysis Toolkit: Indicators That Matter" came out
// one word per line and a two-lesson section stood taller than the article
// beside it. A layout that only works above some width is a variant, not a
// breakpoint: the caller says which surface it is and the component stops
// guessing. `rail` renders no card of its own — the caller supplies the
// chrome, because it is also used bare inside a Sheet.
//
// Every lesson renders with a `LessonStateIcon` from first paint, defaulting
// to "not started". The progress island swaps real state in on hydrate
// (ADR-056 #1), and because the marker already occupies its space there is no
// layout shift when it does — that is the whole reason the server renders a
// state it knows to be provisional.
//
// Server-renderable: no hooks, no client boundary. `full` and `rail` are built
// on `Accordion`, which is a client component, so a page using either crosses
// the boundary there and not here.
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";
import { ExternalBadge } from "@repo/ui/components/external-badge";
import { LessonStateIcon, type LessonState } from "@repo/ui/components/lesson-state-icon";
import { cn } from "@repo/ui/lib/utils";

export interface CurriculumLesson {
  id: string;
  /** Already resolved by the caller — this component builds no URLs. */
  href: string;
  title: string;
  summary?: string | null;
  /** Pre-formatted, e.g. "4-min read". The component does no i18n. */
  durationLabel?: string | null;
  state?: LessonState;
  /**
   * The lesson the reader is ON, which is not the same question as its state:
   * the progress island can mark several lessons `in-progress`, and exactly
   * one of them is this page. Drives `aria-current="page"` and the rail's
   * highlight.
   */
  isCurrent?: boolean;
  /** Renders the external marker instead of a normal lesson link (D15). */
  isExternal?: boolean;
  isOptional?: boolean;
}

export interface CurriculumSection {
  id: string;
  title: string;
  description?: string | null;
  /** Pre-formatted, e.g. "5 lessons". */
  countLabel?: string;
  lessons: CurriculumLesson[];
}

export interface CurriculumLabels {
  /** State names for `LessonStateIcon`, keyed by state. */
  states: Record<LessonState, string>;
  externalBadge: string;
  opensInNewTab: string;
  optionalBadge: string;
}

export type CurriculumVariant = "full" | "rail" | "compact";

/** The reading time and the badges, in the order every variant shows them. */
function LessonMeta({
  lesson,
  labels,
  className,
}: {
  lesson: CurriculumLesson;
  labels: CurriculumLabels;
  className?: string;
}) {
  if (!lesson.isExternal && !lesson.isOptional && !lesson.durationLabel) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {lesson.durationLabel && (
        <span className="text-2xs text-muted-foreground tabular-nums">{lesson.durationLabel}</span>
      )}
      {lesson.isExternal && (
        <ExternalBadge label={labels.externalBadge} newTabLabel={labels.opensInNewTab} />
      )}
      {lesson.isOptional && (
        <span className="text-2xs text-muted-foreground">{labels.optionalBadge}</span>
      )}
    </span>
  );
}

/**
 * The `full` variant's row: a timeline node whose marker is the play
 * affordance, and whose whole box is the link.
 *
 * **The marker sits OUTSIDE the anchor on purpose.** The reader is being
 * offered a play button, so the play button has to be clickable — and the way
 * to do that without nesting anchors or building a second target is the
 * stretched-link construction `CourseCard` and `QuizCard` already document:
 * the `<li>` is the positioned host, the title anchor paints `after:inset-0`
 * over it, and everything that overlay covers (marker, connector, summary) is
 * part of one click target and ONE entry in the accessibility tree.
 * Consequence: nothing between the anchor and the `<li>` may be positioned, or
 * the overlay silently shrinks to that box. `curriculum-list.test.tsx` guards
 * both halves.
 */
function TimelineRow({
  lesson,
  labels,
  isLast,
}: {
  lesson: CurriculumLesson;
  labels: CurriculumLabels;
  isLast: boolean;
}) {
  const state = lesson.state ?? "not-started";
  const locked = state === "locked";

  return (
    <li className={cn("group relative flex gap-3 sm:gap-4", locked && "opacity-70")}>
      <span className="flex flex-col items-center">
        <LessonStateIcon
          state={state}
          label={labels.states[state]}
          size="lg"
          className={cn(
            "transition-colors duration-(--duration-base)",
            // The invitation, on the one state that is an invitation. A
            // completed or locked marker keeps its own tone — turning every
            // node brand-coloured on hover would erase the state it reports.
            state === "not-started" &&
              "group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary-interactive",
          )}
        />
        {/* The connector. `flex-1` stretches it to whatever the row's content
            makes the column, so a two-line title and a one-line title both
            join up. The last node has nothing to join to. */}
        {!isLast && <span aria-hidden className="w-px flex-1 bg-border" />}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1 pb-5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {locked ? (
            // A locked lesson is not a link. Rendering one that navigates to a
            // 404 (or worse, to content the reader should not have) would make
            // the marker a decoration rather than a rule.
            <span aria-disabled className="text-sm font-medium sm:text-base">
              {lesson.title}
            </span>
          ) : (
            <a
              href={lesson.href}
              aria-current={lesson.isCurrent ? "page" : undefined}
              className="text-sm font-medium no-underline transition-colors duration-(--duration-base) group-hover:text-primary-interactive after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50 sm:text-base"
            >
              {lesson.title}
            </a>
          )}
        </span>
        {lesson.summary && (
          <span className="line-clamp-2 text-sm text-muted-foreground">{lesson.summary}</span>
        )}
        <LessonMeta lesson={lesson} labels={labels} />
      </span>
    </li>
  );
}

/** The `rail` variant's row: marker, title, then the meta on its own line. */
function RailRow({ lesson, labels }: { lesson: CurriculumLesson; labels: CurriculumLabels }) {
  const state = lesson.state ?? "not-started";
  const locked = state === "locked";

  const body = (
    <>
      <LessonStateIcon state={state} label={labels.states[state]} className="mt-0.5" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm leading-snug font-medium">{lesson.title}</span>
        <LessonMeta lesson={lesson} labels={labels} />
      </span>
    </>
  );

  return (
    <li>
      {locked ? (
        <span aria-disabled className="flex items-start gap-2.5 px-3 py-2 opacity-70">
          {body}
        </span>
      ) : (
        <a
          href={lesson.href}
          aria-current={lesson.isCurrent ? "page" : undefined}
          className={cn(
            "relative flex items-start gap-2.5 px-3 py-2 no-underline transition-colors duration-(--duration-base) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            // The reader's own position, marked with a tint AND an edge bar —
            // `aria-current` covers the screen reader, the bar covers the
            // glance, and neither is colour alone.
            lesson.isCurrent
              ? "bg-primary/10 font-semibold text-primary-interactive before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:bg-primary"
              : "hover:bg-muted/70",
          )}
        >
          {body}
        </a>
      )}
    </li>
  );
}

/** The `compact` variant's row: one line, no summary, duration at the end. */
function CompactRow({ lesson, labels }: { lesson: CurriculumLesson; labels: CurriculumLabels }) {
  const state = lesson.state ?? "not-started";
  const locked = state === "locked";

  const body = (
    <>
      <LessonStateIcon state={state} label={labels.states[state]} />
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{lesson.title}</span>
        {lesson.isExternal && (
          <ExternalBadge label={labels.externalBadge} newTabLabel={labels.opensInNewTab} />
        )}
        {lesson.isOptional && (
          <span className="text-xs text-muted-foreground">{labels.optionalBadge}</span>
        )}
      </span>
      {lesson.durationLabel && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {lesson.durationLabel}
        </span>
      )}
    </>
  );

  return (
    <li>
      {locked ? (
        <span aria-disabled className="flex items-center gap-3 rounded-lg px-3 py-2.5 opacity-70">
          {body}
        </span>
      ) : (
        <a
          href={lesson.href}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-(--duration-base) hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {body}
        </a>
      )}
    </li>
  );
}

export function CurriculumList({
  sections,
  labels,
  variant = "full",
  /** Sections opened on first paint — the course page opens the one holding
   * the next lesson (§9.3); the compact variant ignores it. */
  defaultOpenSectionIds,
  className,
}: {
  sections: CurriculumSection[];
  labels: CurriculumLabels;
  variant?: CurriculumVariant;
  defaultOpenSectionIds?: string[];
  className?: string;
}) {
  if (variant === "compact") {
    // Flat: on a card, a section header per two lessons is more chrome than
    // content, and the reader is deciding whether to open the course at all.
    const lessons = sections.flatMap((section) => section.lessons);
    return (
      <ul className={cn("flex flex-col", className)}>
        {lessons.map((lesson) => (
          <CompactRow key={lesson.id} lesson={lesson} labels={labels} />
        ))}
      </ul>
    );
  }

  if (variant === "rail") {
    return (
      <Accordion defaultValue={defaultOpenSectionIds ?? []} className={className}>
        {sections.map((section) => (
          <AccordionItem key={section.id} value={section.id} className="border-b last:border-b-0">
            {/* `hover:no-underline`: the Accordion's own hover underline is
                right for a prose disclosure and wrong for a section title that
                wraps to four lines in a rail, where it underlines all four at
                once. The count moves UNDER the title for the same reason —
                beside it, it was eating a third of the column. */}
            <AccordionTrigger className="gap-2 px-3 py-2.5 hover:no-underline">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-start">
                <span className="text-sm leading-snug font-semibold">{section.title}</span>
                {section.countLabel && (
                  <span className="text-2xs font-medium tracking-caps text-muted-foreground uppercase">
                    {section.countLabel}
                  </span>
                )}
              </span>
            </AccordionTrigger>
            {/* The separation the header was missing: a rule and a recessed
                ground, so the lessons read as the section's CONTENTS rather
                than as more headings. */}
            <AccordionContent className="border-t bg-muted/30 pb-0 [&_a]:no-underline">
              <ul className="flex flex-col py-1">
                {section.lessons.map((lesson) => (
                  <RailRow key={lesson.id} lesson={lesson} labels={labels} />
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }

  return (
    <Accordion
      defaultValue={defaultOpenSectionIds ?? []}
      className={cn("flex flex-col gap-2", className)}
    >
      {sections.map((section) => (
        <AccordionItem
          key={section.id}
          value={section.id}
          className="rounded-xl border bg-card px-4"
        >
          <AccordionTrigger>
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-start">
              <span className="font-medium">{section.title}</span>
              {section.description && (
                <span className="text-sm text-muted-foreground">{section.description}</span>
              )}
            </span>
            {section.countLabel && (
              <span className="me-2 shrink-0 text-xs text-muted-foreground tabular-nums">
                {section.countLabel}
              </span>
            )}
          </AccordionTrigger>
          {/* AccordionContent underlines every descendant anchor by default —
              right for prose, wrong for a list of rows where the whole row is
              the target. */}
          <AccordionContent className="[&_a]:no-underline">
            {/* Ordered, and now drawn that way: the timeline is the curriculum
                saying "in this sequence", which a bare <ul> only implied. */}
            <ol className="flex flex-col pb-1">
              {section.lessons.map((lesson, index) => (
                <TimelineRow
                  key={lesson.id}
                  lesson={lesson}
                  labels={labels}
                  isLast={index === section.lessons.length - 1}
                />
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
