"use client";

// The quiz index's grid, its category chips and its learner record (Phase 6,
// D26; design pass 2026-09-09).
//
// Client for the same reason `CourseShelf` is: under Cache Components, reading
// `searchParams` makes the page dynamic, which `architecture.md` #6 forbids on
// a public route. Every quiz is already in this payload, so narrowing the set
// is a `useState` — no request, no cache entry, and `?category=charting` is not
// a URL anyone bookmarks.
//
// Three things arrive from three different places and the file only works if
// the distinction stays clear:
//
//   CONTENT (titles, categories, pass marks) is props, from a cached page.
//   ARTWORK is the editor's uploaded cover when there is one (ADR-132), and
//     otherwise derived in code from the slug — `quizCoverUrl`, deterministic,
//     so the server render and the hydration agree.
//   THE LEARNER'S RECORD is fetched after paint by `useQuizResults`, and every
//     card is complete without it. Nothing here waits for it and nothing
//     reserves space that collapses if it never comes: the meter is on screen
//     from the first frame showing the quiz's pass mark, and gains a fill.
import { useDeferredValue, useMemo, useState } from "react";
import Image from "next/image";
import { Award, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { QuizCardView } from "@repo/contracts";
import { humanizeKey } from "@repo/utils";
import { Container } from "@repo/ui/components/container";
import { Button } from "@repo/ui/components/button";
import { ClientPagination, usePagedList } from "@repo/ui/components/client-pagination";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { ProgressBar } from "@repo/ui/components/progress-bar";
import { QuizCard } from "@repo/ui/components/quiz-card";
import { Reveal } from "@repo/ui/components/reveal";
import { SearchInput } from "@repo/ui/components/search-input";
import { Section } from "@repo/ui/components/section";
import { cn } from "@repo/ui/lib/utils";
import { isGeneratedCover, quizCoverUrl } from "../_content/learn-media.ts";
import { categoryTone, quizCardLabels } from "../_lib/quiz-labels.ts";
import { usePaginationLabels } from "../_lib/use-pagination-labels.ts";
import { applyShelfView, availableShelfViews, type ShelfView } from "../_lib/shelf-view.ts";
import { ShelfViewChips } from "./shelf-view-chips.tsx";
import { useQuizResults } from "../_lib/use-quiz-results.ts";

export function QuizShelf({ quizzes, basePath }: { quizzes: QuizCardView[]; basePath: string }) {
  const t = useTranslations("learn");
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  // ADR-139 #5 — Popular is by finished attempts, an aggregate the shelf's
  // cached payload already carries.
  const [view, setView] = useState<ShelfView>("all");
  const viewItems = useMemo(
    () => quizzes.map((quiz) => ({ ...quiz, popularity: quiz.attemptCount })),
    [quizzes],
  );
  const views = useMemo(() => availableShelfViews(viewItems), [viewItems]);
  const { status, byQuizId } = useQuizResults();

  const labels = useMemo(() => quizCardLabels(t), [t]);

  // `Quiz.category` is free text an editor typed, so it has no catalog key and
  // cannot get one. `humanizeKey` is ADR-044 #5's last resort applied to the
  // public site: "risk-management" reads "Risk Management" rather than
  // rendering a raw identifier. Counted here so a chip can say how much is
  // behind it — a filter whose size is visible is one a reader will use.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const quiz of quizzes) {
      if (quiz.category) counts.set(quiz.category, (counts.get(quiz.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => ({ key, count, label: humanizeKey(key) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [quizzes]);

  // Title and description only, as the course shelf searches title and summary:
  // a match the card cannot show reads as a wrong result.
  const needle = deferredQuery.trim().toLocaleLowerCase();
  const viewed = applyShelfView(viewItems, view);
  const visible = viewed.filter(
    (quiz) =>
      (category === null || quiz.category === category) &&
      (needle === "" ||
        quiz.title.toLocaleLowerCase().includes(needle) ||
        (quiz.description?.toLocaleLowerCase().includes(needle) ?? false)),
  );
  const filtering = category !== null || needle !== "";

  // Six a page (changes-37, ADR-121 §2), in state like the category above and
  // for the same reason. A new category starts again at page one.
  const paginationLabels = usePaginationLabels();
  const { page, pageCount, pageItems, setPage } = usePagedList(visible, {
    resetKey: `${view}|${category ?? ""}|${needle}`,
  });

  // The learner's record across the quizzes ON THIS PAGE, not across every
  // quiz they have ever taken: a "3 of 8 passed" band that counts quizzes the
  // reader cannot see from here would be arithmetic they cannot check.
  const record = useMemo(() => {
    if (status !== "ready") return null;
    const taken = quizzes.filter((quiz) => byQuizId.has(quiz.id));
    if (taken.length === 0) return null;
    return {
      passed: taken.filter((quiz) => byQuizId.get(quiz.id)?.passed).length,
      total: quizzes.length,
    };
  }, [status, quizzes, byQuizId]);

  return (
    <Section id="quizzes" spacing="md" className="scroll-mt-24">
      <Container className="flex flex-col gap-6">
        {record && (
          <Reveal variant="up">
            <div className="flex flex-col gap-3 rounded-lg border bg-card/60 p-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:gap-6">
              <span className="flex items-center gap-2 font-semibold">
                <Award aria-hidden className="size-5 text-success-interactive" />
                {t("quizzes.recordTitle")}
              </span>
              <ProgressBar
                className="min-w-0 flex-1"
                value={record.passed}
                total={record.total}
                label={t("quizzes.recordLabel")}
                countLabel={t("quizzes.recordCount", {
                  passed: record.passed,
                  total: record.total,
                })}
                percentLabel={t("course.progressPercent", {
                  percent:
                    record.total === 0 ? 0 : Math.round((record.passed / record.total) * 100),
                })}
              />
            </div>
          </Reveal>
        )}

        {/* ADR-139 #5: the top-level view, above the category chips. */}
        <ShelfViewChips views={views} value={view} onChange={setView} />

        {/* Search and topic share ONE toolbar card, the course shelf's shape
            (changes-47), so the two learn indexes narrow their lists the same
            way. Below lg it stacks. */}
        <div className="flex flex-col gap-3 rounded-lg border bg-card/60 p-4 shadow-sm backdrop-blur-sm lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
          <div className="relative min-w-64 flex-1">
            {/* SearchInput owns the glyph; pe-9 leaves room for the clear
                button beside it in this positioned box. */}
            <SearchInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={t("quizzes.searchLabel")}
              placeholder={t("quizzes.searchPlaceholder")}
              className="pe-9"
            />
            {query !== "" && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("quizzes.clearSearch")}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors duration-(--duration-base) hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>

          {/* One category is not a filter, it is a label — a chip row that can
              only ever produce the set already on screen is a dead control. */}
          {categories.length > 1 && (
            <div
              role="group"
              aria-label={t("quizzes.filterLabel")}
              className="flex flex-wrap items-center gap-1.5"
            >
              {/* The glyph marks the group in the row; the group's aria-label
                  is what names it to assistive tech. */}
              <SlidersHorizontal aria-hidden className="size-4 text-muted-foreground" />
              <Chip
                active={category === null}
                onClick={() => setCategory(null)}
                label={t("quizzes.filterAll")}
                count={quizzes.length}
              />
              {categories.map((entry) => (
                <Chip
                  key={entry.key}
                  active={category === entry.key}
                  onClick={() => setCategory(entry.key)}
                  label={entry.label}
                  count={entry.count}
                  // The chip wears the colour its cards' badges wear, so the
                  // link between "I pressed this" and "these appeared" is
                  // visible rather than inferred.
                  tone={categoryTone(entry.key)}
                />
              ))}
            </div>
          )}
        </div>

        {/* The count is announced, not just shown: filtering with the keyboard
            moves nothing into view, so a sighted-only change would be silent
            for a screen-reader user. */}
        {filtering && (
          <p aria-live="polite" className="text-end text-sm text-muted-foreground">
            {t("quizzes.resultCount", { count: visible.length })}
          </p>
        )}

        {visible.length === 0 ? (
          <Empty>
            <EmptyTitle>{t("quizzes.noneTitle")}</EmptyTitle>
            <EmptyDescription>{t("quizzes.noneBody")}</EmptyDescription>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCategory(null);
                setQuery("");
              }}
            >
              {t("quizzes.clearFilter")}
            </Button>
          </Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((quiz, index) => {
              const result = byQuizId.get(quiz.id);
              return (
                // A <ul> takes <li> children and nothing else, so the
                // reveal wrapper goes INSIDE the item rather than around it.
                // Staggered by position in the grid, capped so the last card
                // of a long shelf is not still waiting when it scrolls in.
                <li key={quiz.id} className="flex">
                  <Reveal variant="up" delay={Math.min(index, 5) * 60} className="flex w-full">
                    <QuizCard
                      className="w-full"
                      href={`${basePath}/${quiz.slug}`}
                      title={quiz.title}
                      description={quiz.description}
                      categoryLabel={quiz.category ? humanizeKey(quiz.category) : null}
                      categoryTone={quiz.category ? categoryTone(quiz.category) : "eyebrow"}
                      questionsLabel={t("quizzes.questionCount", { count: quiz.questionCount })}
                      passingScore={quiz.passingScore}
                      passingScoreLabel={t("course.progressPercent", {
                        percent: quiz.passingScore,
                      })}
                      coverUrl={quizCoverUrl(quiz.slug, quiz.coverUrl)}
                      markers={[
                        ...(quiz.isFeatured ? [{ label: t("markers.featured") }] : []),
                        ...(quiz.isPremium
                          ? [{ label: t("markers.premium"), tone: "marker-dark" as const }]
                          : []),
                      ]}
                      highlighted={category !== null && quiz.category === category}
                      progress={
                        result && {
                          bestPercentage: result.bestPercentage,
                          bestLabel: t("course.progressPercent", {
                            percent: result.bestPercentage,
                          }),
                          passed: result.passed,
                          attemptsLabel: t("quizzes.attemptsTaken", { count: result.attempts }),
                        }
                      }
                      labels={labels}
                      renderCover={({ src, alt }) => <QuizCover src={src} alt={alt} />}
                    />
                  </Reveal>
                </li>
              );
            })}
          </ul>
        )}

        <ClientPagination
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          labels={paginationLabels}
          scrollTargetId="quizzes"
        />
      </Container>
    </Section>
  );
}

/**
 * A quiz panel, faded in on decode.
 *
 * The panels are a few KB of generated vector and usually paint in the same
 * frame as the card, so this is not a loading spinner in disguise — it is what
 * stops a cold cache from popping a picture into a card that has already
 * settled. Until then the card's own `bg-muted` shows through, at the exact
 * size the image will occupy, so nothing moves either way.
 *
 * `unoptimized` for a generated panel or an SVG, not `dangerouslyAllowSVG` in
 * next.config: a vector has nothing for the optimizer to win, and the config
 * flag would relax SVG handling for EVERY image the app serves — the trade
 * `LearnBackdrop` and `NewsBackdrop` both already refused. An uploaded raster
 * cover (ADR-132) IS optimised, as a course cover is.
 */
function QuizCover({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized={src.endsWith(".svg") || isGeneratedCover(src)}
      sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw"
      onLoad={() => setLoaded(true)}
      className={cn(
        "media-zoom object-cover transition-opacity duration-(--duration-slow) ease-(--ease-out-quint)",
        loaded ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

const CHIP_ACTIVE_TONE = {
  info: "bg-info/15 text-info-interactive ring-info/40",
  success: "bg-success/15 text-success-interactive ring-success/40",
  warning: "bg-warning/18 text-warning-interactive ring-warning/40",
  eyebrow: "bg-primary/12 text-primary-interactive ring-primary/40",
} as const;

function Chip({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  /** Omitted on "All topics", which is the neutral one by definition. */
  tone?: keyof typeof CHIP_ACTIVE_TONE;
}) {
  return (
    <button
      type="button"
      // `aria-pressed`, not `aria-current`: these are toggles in a group, not
      // navigation, and nothing here changes the URL.
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium ring-1 transition duration-(--duration-base) ease-(--ease-out-quint) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? // A tone the chip shares with its cards' badges, so pressing one is
            // visibly what produced the other. "All topics" has no tone and
            // takes the primary fill, because it is the reset rather than one
            // of the set.
            cn(
              "shadow-sm",
              tone
                ? CHIP_ACTIVE_TONE[tone]
                : "bg-primary-solid text-primary-solid-foreground ring-primary",
            )
          : "bg-background text-muted-foreground ring-border hover:-translate-y-px hover:text-foreground hover:shadow-sm hover:ring-primary/25",
      )}
    >
      {label}
      <span
        // The count is decoration for the label beside it, not a second fact:
        // a screen reader reading "Charting 4" as a name is worse than
        // "Charting", and the live region already announces how many matched.
        aria-hidden
        className={cn(
          "rounded-sm px-1.5 text-xs tabular-nums",
          active ? "bg-foreground/10" : "bg-muted",
        )}
      >
        {count}
      </span>
    </button>
  );
}
