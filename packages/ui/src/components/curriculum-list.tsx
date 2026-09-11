// A course's sections and lessons (changes-11 §9.2).
//
// Two variants, one component, because they are the same list at two
// densities and keeping them apart would mean two places to fix a state
// marker:
//
//   `full`    the course page — sections as an accordion, summaries shown
//   `compact` the D30 card expansion — a flat list, titles and reading time
//
// Every lesson renders with a `LessonStateIcon` from first paint, defaulting
// to "not started". The progress island swaps real state in on hydrate
// (ADR-056 #1), and because the marker already occupies its space there is no
// layout shift when it does — that is the whole reason the server renders a
// state it knows to be provisional.
//
// Server-renderable: no hooks, no client boundary. The `full` variant is built
// on `Accordion`, which is a client component, so a page using it crosses the
// boundary there and not here.
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

function LessonRow({
  lesson,
  labels,
  compact,
}: {
  lesson: CurriculumLesson;
  labels: CurriculumLabels;
  compact: boolean;
}) {
  const state = lesson.state ?? "not-started";
  const locked = state === "locked";

  const body = (
    <>
      <LessonStateIcon state={state} label={labels.states[state]} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("font-medium", compact ? "text-sm" : "text-sm sm:text-base")}>
            {lesson.title}
          </span>
          {lesson.isExternal && (
            <ExternalBadge label={labels.externalBadge} newTabLabel={labels.opensInNewTab} />
          )}
          {lesson.isOptional && (
            <span className="text-xs text-muted-foreground">{labels.optionalBadge}</span>
          )}
        </span>
        {!compact && lesson.summary && (
          <span className="line-clamp-2 text-sm text-muted-foreground">{lesson.summary}</span>
        )}
      </span>
      {lesson.durationLabel && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {lesson.durationLabel}
        </span>
      )}
    </>
  );

  // A locked lesson is not a link. Rendering one that navigates to a 404 (or
  // worse, to content the reader should not have) would make the marker a
  // decoration rather than a rule.
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
  variant?: "full" | "compact";
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
          <LessonRow key={lesson.id} lesson={lesson} labels={labels} compact />
        ))}
      </ul>
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
            <ul className="flex flex-col pb-2">
              {section.lessons.map((lesson) => (
                <LessonRow key={lesson.id} lesson={lesson} labels={labels} compact={false} />
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
