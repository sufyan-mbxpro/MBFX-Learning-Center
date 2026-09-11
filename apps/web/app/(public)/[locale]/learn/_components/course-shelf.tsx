"use client";

// The `/learn` shelf and its filters (changes-11 PR 4.1, D26; design pass
// 2026-09-09).
//
// The filters are CLIENT state, and D26 is explicit about why: under Cache
// Components, reading `searchParams` makes the page dynamic, which
// architecture.md #6 forbids on public routes. Every course is already in this
// payload, so narrowing the set is a `useState` — it costs no request and no
// cache entry, and `/learn?difficulty=beginner` is not a URL we want anyway
// (nobody bookmarks a difficulty).
//
// **This is the difference from /news's filters, and it is deliberate.** The
// news archive filters by NAVIGATING (`/news/category/x` is a real, indexable,
// linkable page with its own articles) because a category there is a
// destination. A difficulty is not: there is no useful page called "everything
// beginner", the whole shelf is thirty cards rather than thirty thousand, and
// a round trip to hide four of them would be slower and less cacheable than
// hiding them here. Same visual vocabulary as the news toolbar — chips, a
// search box, a result count, an empty state with a way out — over a
// different mechanism, chosen per surface.
//
// The whole shelf lives in one client component rather than a filter island
// above server-rendered bands, because the filters have to remove entire TRACK
// BANDS: filtering to Advanced when only Forex has an advanced course must
// leave one band, not two with one empty. A server band cannot know that.
import { useDeferredValue, useMemo, useState } from "react";
import Image from "next/image";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { CourseCard, type CourseCardLabels } from "@repo/ui/components/course-card";
import type { CourseLevelTone } from "@repo/ui/components/course-card";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import { ProgressBar } from "@repo/ui/components/progress-bar";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { cn } from "@repo/ui/lib/utils";
import type { CurriculumSection } from "@repo/ui/components/curriculum-list";
import { useLearnerDashboard } from "./progress-provider.tsx";

export interface ShelfCourse {
  id: string;
  href: string;
  title: string;
  summary: string | null;
  difficulty: string;
  difficultyLabel: string;
  difficultyTone: CourseLevelTone;
  lessonsLabel: string;
  durationLabel: string | null;
  videoLabel: string | null;
  coverUrl: string | null;
  /** True when `coverUrl` is a generated track panel rather than an upload. */
  coverIsGenerated: boolean;
  isExternal: boolean;
  sections: CurriculumSection[];
}

export interface ShelfTrack {
  track: string;
  title: string;
  description: string;
  courses: ShelfCourse[];
}

export interface ShelfLabels extends CourseCardLabels {
  filterLabel: string;
  filterAll: string;
  /** Difficulty key → label, for the chip row. */
  difficulties: Record<string, string>;
  noneTitle: string;
  noneBody: string;
  clearFilter: string;
}

/** The chip order is the progression a learner moves through, not alphabetical. */
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export function CourseShelf({ tracks, labels }: { tracks: ShelfTrack[]; labels: ShelfLabels }) {
  // The toolbar reads its own strings rather than taking them through
  // `labels`. `labels` exists because @repo/ui carries no catalog and its
  // components must be handed finished strings; this file is app code and can
  // just translate. It also has to: the result count is a plural whose
  // argument is client state, and a function prop cannot cross the RSC
  // boundary — passing `(count) => string` from the page would fail to
  // serialize rather than fail a type check.
  const t = useTranslations("learn");
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [track, setTrack] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // The list re-filters at typing speed on a payload this size, but
  // `useDeferredValue` keeps the input itself responsive if a shelf ever grows
  // past what one keystroke can re-render comfortably.
  const deferredQuery = useDeferredValue(query);

  const visible = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase();
    return (
      tracks
        .filter((group) => track === null || group.track === track)
        .map((group) => ({
          ...group,
          courses: group.courses.filter((course) => {
            if (difficulty !== null && course.difficulty !== difficulty) return false;
            if (needle === "") return true;
            // Title and summary only. Searching the lesson titles too would
            // surface a course whose match the card cannot show, which reads
            // as a wrong result rather than a deep one.
            return (
              course.title.toLocaleLowerCase().includes(needle) ||
              (course.summary?.toLocaleLowerCase().includes(needle) ?? false)
            );
          }),
        }))
        // A band with nothing left in it is dropped, exactly as `loadLearnIndex`
        // drops an empty track server-side — the same rule applied to the same
        // shape, so the filtered page and the unfiltered one behave alike.
        .filter((group) => group.courses.length > 0)
    );
  }, [tracks, track, difficulty, deferredQuery]);

  // Only offer a chip for a level that actually has courses: a filter that can
  // only ever produce an empty result is a dead control.
  const offered = DIFFICULTIES.filter((key) =>
    tracks.some((group) => group.courses.some((course) => course.difficulty === key)),
  );

  const filtering = difficulty !== null || track !== null || query.trim() !== "";
  const shownCount = visible.reduce((sum, group) => sum + group.courses.length, 0);

  function clearAll() {
    setDifficulty(null);
    setTrack(null);
    setQuery("");
  }

  return (
    <>
      <ContinueBand tracks={tracks} labels={labels} />

      {/* The toolbar, and the anchor the masthead's "Browse courses" scrolls
          to — landing on the controls rather than mid-grid means the reader
          arrives able to narrow, not just to scroll. `scroll-mt` clears the
          sticky site header. */}
      <Section id="courses" spacing="sm" className="scroll-mt-24">
        <Container className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card/60 p-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:gap-4">
            <div className="relative flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={t("filters.searchLabel")}
                placeholder={t("filters.searchPlaceholder")}
                className="ps-9 pe-9"
              />
              {query !== "" && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("filters.clearSearch")}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors duration-(--duration-base) hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </div>

            {tracks.length > 1 && (
              <ChipGroup label={t("filters.trackLabel")}>
                <FilterChip
                  active={track === null}
                  onClick={() => setTrack(null)}
                  label={t("filters.allTracks")}
                />
                {tracks.map((group) => (
                  <FilterChip
                    key={group.track}
                    active={track === group.track}
                    onClick={() => setTrack(group.track)}
                    label={group.title}
                  />
                ))}
              </ChipGroup>
            )}
          </div>

          {offered.length > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ChipGroup label={labels.filterLabel}>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <SlidersHorizontal aria-hidden className="size-4" />
                  {labels.filterLabel}
                </span>
                <FilterChip
                  active={difficulty === null}
                  onClick={() => setDifficulty(null)}
                  label={labels.filterAll}
                />
                {offered.map((key) => (
                  <FilterChip
                    key={key}
                    active={difficulty === key}
                    onClick={() => setDifficulty(key)}
                    label={labels.difficulties[key] ?? key}
                  />
                ))}
              </ChipGroup>

              {/* The count is announced, not just shown: filtering with the
                  keyboard moves nothing into view, so a sighted change alone
                  would be silent for a screen-reader user. */}
              {filtering && (
                <p aria-live="polite" className="text-sm text-muted-foreground">
                  {t("filters.resultCount", { count: shownCount })}
                </p>
              )}
            </div>
          )}
        </Container>
      </Section>

      {visible.length === 0 ? (
        <Section spacing="md">
          <Container>
            <Empty>
              <EmptyTitle>{labels.noneTitle}</EmptyTitle>
              <EmptyDescription>{labels.noneBody}</EmptyDescription>
              <Button variant="outline" size="sm" onClick={clearAll}>
                {labels.clearFilter}
              </Button>
            </Empty>
          </Container>
        </Section>
      ) : (
        visible.map((group, index) => (
          <Section
            key={group.track}
            spacing="md"
            tone={index % 2 === 1 ? "muted" : "default"}
            className="relative isolate overflow-hidden"
          >
            <Container className="flex flex-col gap-6">
              <Reveal variant="up">
                <SectionHeading title={group.title} lead={group.description} />
              </Reveal>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.courses.map((course, cardIndex) => (
                  // Staggered by position in the band, capped so the last card
                  // of a long shelf is not still waiting when it scrolls in.
                  <Reveal
                    key={course.id}
                    variant="up"
                    delay={Math.min(cardIndex, 5) * 60}
                    className="flex"
                  >
                    <ShelfCard course={course} labels={labels} />
                  </Reveal>
                ))}
              </div>
            </Container>
          </Section>
        ))
      )}
    </>
  );
}

/**
 * One card, so the shelf, the "continue" band and any later surface build the
 * same thing from a `ShelfCourse` — including the cover rules, which are the
 * part most likely to drift.
 */
function ShelfCard({
  course,
  labels,
  cta,
  footer,
}: {
  course: ShelfCourse;
  labels: ShelfLabels;
  cta?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <CourseCard
      className="w-full"
      href={course.href}
      title={course.title}
      summary={course.summary}
      difficultyLabel={course.difficultyLabel}
      difficultyTone={course.difficultyTone}
      lessonsLabel={course.lessonsLabel}
      durationLabel={course.durationLabel}
      videoLabel={course.videoLabel}
      coverUrl={course.coverUrl}
      isExternal={course.isExternal}
      sections={course.sections}
      labels={labels}
      cta={cta}
      footer={footer}
      // plan §13: covers go through next/image with explicit `sizes`. The card
      // is half-width from lg and full-width below, and the image column is
      // capped at 176px from sm. `media-zoom` is the shared hover treatment;
      // the card carries the bare `group` class it keys off.
      renderCover={({ src, alt }) => (
        <Image
          src={src}
          alt={alt}
          fill
          // A generated track panel is a few KB of vector with nothing for the
          // optimizer to win, and routing it through the optimizer would need
          // `dangerouslyAllowSVG` for every admin-entered URL too. An uploaded
          // cover is optimized normally.
          unoptimized={course.coverIsGenerated}
          sizes="(min-width: 640px) 176px, 100vw"
          className="media-zoom object-cover"
        />
      )}
    />
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      // `aria-pressed` rather than `aria-current`: these are toggles in a
      // group, not navigation, and nothing here changes the URL.
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-[background-color,color,box-shadow,transform] duration-(--duration-base) ease-(--ease-out-quint) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "bg-primary text-primary-foreground shadow-sm ring-primary"
          : "bg-background text-muted-foreground ring-border hover:-translate-y-px hover:text-foreground hover:shadow-sm hover:ring-primary/25",
      )}
    >
      {label}
    </button>
  );
}

/**
 * "Pick up where you left off" (changes-11 PR 5.4).
 *
 * Rendered from the SHELF's own data, narrowed by the learner's enrollment
 * summaries. The API returns counters and ids and no content at all
 * (ADR-056 #2) — every title, cover and href here was already in the cached
 * page payload, so a per-learner response never has to carry any.
 *
 * It appears only for a signed-in reader who has actually started something,
 * and it is ADDITIVE: the same courses still appear in their track bands
 * below. Removing them from the shelf would make the page's contents depend
 * on who is reading it, which is exactly what the caching model forbids —
 * this band adds a client-rendered shortcut, it does not rewrite the shelf.
 */
const CONTINUE_LIMIT = 3;

function ContinueBand({ tracks, labels }: { tracks: ShelfTrack[]; labels: ShelfLabels }) {
  const t = useTranslations("learn");
  const { status, enrollments } = useLearnerDashboard();

  const byId = useMemo(() => {
    const map = new Map<string, ShelfCourse>();
    for (const group of tracks) for (const course of group.courses) map.set(course.id, course);
    return map;
  }, [tracks]);

  if (status !== "ready") return null;

  const started = enrollments
    .map((enrollment) => {
      const course = byId.get(enrollment.courseId);
      // An enrollment whose course is not on this shelf (unpublished since,
      // or filtered out of the locale) is dropped rather than rendered as a
      // card with no title.
      return course ? { enrollment, course } : null;
    })
    .filter((row): row is { enrollment: (typeof enrollments)[number]; course: ShelfCourse } =>
      Boolean(row),
    )
    .slice(0, CONTINUE_LIMIT);

  if (started.length === 0) return null;

  return (
    <Section spacing="md">
      <Container className="flex flex-col gap-6">
        <SectionHeading
          title={t("progress.yourCoursesTitle")}
          lead={t("progress.yourCoursesIntro")}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {started.map(({ enrollment, course }) => {
            const resume =
              course.sections
                .flatMap((section) => section.lessons)
                .find((lesson) => lesson.id === enrollment.lastLessonId)?.href ?? course.href;

            return (
              <ShelfCard
                key={course.id}
                course={course}
                labels={labels}
                cta={
                  <Button size="sm" className="glow-on-hover" render={<a href={resume} />}>
                    {enrollment.isCompleted ? t("progress.review") : t("progress.continue")}
                  </Button>
                }
                footer={
                  <ProgressBar
                    value={enrollment.lessonsCompleted}
                    total={enrollment.lessonsTotal}
                    label={t("course.progressLabel")}
                    countLabel={t("progress.cardProgress", {
                      done: enrollment.lessonsCompleted,
                      total: enrollment.lessonsTotal,
                    })}
                    percentLabel={t("course.progressPercent", { percent: enrollment.percent })}
                  />
                }
              />
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
