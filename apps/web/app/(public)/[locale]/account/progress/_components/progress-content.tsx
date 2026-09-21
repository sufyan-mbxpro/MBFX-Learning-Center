// `/account/progress`'s per-learner body (ADR-125 §1): courses with resume,
// quiz attempts and recent reading. Reads the session inside the page's
// `<Suspense>`, as ADR-123 §1 set out for the account's pages.
//
// changes-42 gave it four things the owner asked for:
//
//   • A SUMMARY row of whole-history totals, each on its own tone, so the page
//     answers "how am I doing" before the reader scrolls. Counted in core, not
//     read off the lists below, which are capped.
//   • COLOURED section headings: every band's glyph sits on a tile in that
//     band's tone, and the tone matches its summary tile, so the eye can find
//     "quizzes" in both places by colour alone.
//   • SAME-SIZE course cards: cover, title, progress, final assessment, footer,
//     in that order on every card, with the variable-length parts clamped and
//     the footer pushed to the bottom, so a row of three lines up.
//   • A PAGER on every history band, rather than a hard cut at twenty rows.
//
// And the course card now carries the course's FINAL ASSESSMENT, with the
// learner's best score: a course with a final quiz is not complete until it is
// passed (ADR-056 #7), so a card that showed only lessons would say "12 of 12"
// about a course the learner has not finished.
import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  Award,
  BookOpen,
  BookOpenCheck,
  CircleCheck,
  CircleX,
  GraduationCap,
  ListChecks,
  Newspaper,
  PlayCircle,
  Trophy,
} from "lucide-react";
import { ACCOUNT_PROGRESS_PATH, type AccountCourseView } from "@repo/contracts";
import { loadLearnerActivity, loadLearnerProfile } from "@repo/core";
import { Link, redirect } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { EmptyState } from "@repo/ui/components/empty";
import { ProgressBar } from "@repo/ui/components/progress-bar";
import { Section } from "@repo/ui/components/section";
import { cn } from "@repo/ui/lib/utils";
import { courseCoverUrl, isGeneratedCover } from "../../../learn/_content/learn-media.ts";
import { AccountMasthead } from "../../_components/account-masthead.tsx";
import { requireLearnerSession } from "../../_lib/learner-session.ts";
import { PagedList } from "./paged-list.tsx";
import { DATE_FORMAT_OPTIONS } from "@repo/utils";

/**
 * One tone per band. The tile, the heading glyph and the summary figure of a
 * band share it; nothing else on the page uses a tone as decoration.
 */
type Tone = "primary" | "success" | "info" | "warning";

const TONE_TILE: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary-interactive ring-primary/20",
  success: "bg-success/10 text-success-interactive ring-success/20",
  info: "bg-info/10 text-info-interactive ring-info/20",
  warning: "bg-warning/10 text-warning-interactive ring-warning/20",
};

const TONE_BAR: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
};

export async function ProgressContent({ locale }: { locale: string }) {
  const { userId } = await requireLearnerSession(locale, ACCOUNT_PROGRESS_PATH);

  const [profile, activity, t, format] = await Promise.all([
    loadLearnerProfile(userId),
    loadLearnerActivity(userId, locale),
    getTranslations({ locale, namespace: "account" }),
    getFormatter({ locale }),
  ]);
  if (!profile) redirect({ href: "/sign-in", locale });
  const { courses, quizAttempts, reads, lessonReads, summary } = activity;

  const date = (iso: string) => format.dateTime(new Date(iso), DATE_FORMAT_OPTIONS);
  const percent = (value: number) => format.number(value / 100, { style: "percent" });
  const current = courses.find((course) => !course.isCompleted && course.resume) ?? null;

  const summaryTiles: { key: string; tone: Tone; icon: React.ReactNode; value: number }[] = [
    {
      key: "coursesStarted",
      tone: "primary",
      icon: <GraduationCap />,
      value: summary.coursesStarted,
    },
    { key: "coursesCompleted", tone: "success", icon: <Trophy />, value: summary.coursesCompleted },
    {
      key: "lessonsCompleted",
      tone: "info",
      icon: <BookOpenCheck />,
      value: summary.lessonsCompleted,
    },
    { key: "quizzesPassed", tone: "success", icon: <Award />, value: summary.quizzesPassed },
    { key: "articlesRead", tone: "warning", icon: <Newspaper />, value: summary.articlesRead },
  ];

  return (
    <>
      <AccountMasthead profile={profile!} locale={locale} titleKey="progressTitle" />

      <Section spacing="md">
        <Container className="flex flex-col gap-12">
          {/* ── Summary ───────────────────────────────────────── */}
          <section aria-labelledby="account-summary" className="flex flex-col gap-4">
            <h2 id="account-summary" className="sr-only">
              {t("summary.title")}
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {summaryTiles.map((tile) => (
                <li
                  key={tile.key}
                  className="relative flex h-full flex-col gap-3 overflow-hidden rounded-lg border bg-card p-4"
                >
                  <span
                    aria-hidden
                    className={cn("absolute inset-x-0 top-0 h-1", TONE_BAR[tile.tone])}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md ring-1 [&_svg]:size-4.5",
                      TONE_TILE[tile.tone],
                    )}
                  >
                    {tile.icon}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-2xl font-semibold tabular-nums">
                      {format.number(tile.value)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`summary.${tile.key}`)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Continue learning ─────────────────────────────── */}
          <section aria-labelledby="account-learning" className="flex flex-col gap-4">
            <SectionTitle
              id="account-learning"
              tone="primary"
              icon={<GraduationCap />}
              count={courses.length}
            >
              {t("learning.title")}
            </SectionTitle>

            {courses.length === 0 ? (
              <EmptyState
                icon={<BookOpen aria-hidden />}
                title={t("learning.emptyTitle")}
                description={t("learning.emptyBody")}
                action={
                  <Button variant="outline" render={<Link href="/learn" />}>
                    {t("learning.browse")}
                  </Button>
                }
              />
            ) : (
              <>
                {current && current.resume && (
                  <article className="grid grid-cols-1 overflow-hidden rounded-lg border border-primary/25 bg-card md:grid-cols-3">
                    <CourseCover
                      url={courseCoverUrl(current.coverUrl, current.track)}
                      className="aspect-16/10 md:aspect-auto"
                    />
                    <div className="flex flex-col gap-4 p-6 md:col-span-2">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-medium tracking-caps text-primary-interactive uppercase">
                          {t("learning.resumeEyebrow")}
                        </p>
                        <h3 className="text-xl font-semibold">
                          <Link href={current.href} className="hover:underline">
                            {current.title}
                          </Link>
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {t("learning.nextLesson", { lesson: current.resume.title })}
                        </p>
                      </div>
                      <ProgressBar
                        value={current.lessonsCompleted}
                        total={current.lessonsTotal}
                        label={t("learning.progressLabel", { course: current.title })}
                        countLabel={t("learning.lessonCount", {
                          done: current.lessonsCompleted,
                          total: current.lessonsTotal,
                        })}
                        percentLabel={percent(current.percent)}
                      />
                      <div>
                        <Button render={<Link href={current.resume.href} />}>
                          <PlayCircle aria-hidden /> {t("learning.resume")}
                        </Button>
                      </div>
                    </div>
                  </article>
                )}

                {/* Every started course, the one above included: "Your courses"
                    is the RECORD, and a course dropping out of it because it
                    happens to be the one being resumed reads as a lost course. */}
                <h3 className="text-base font-semibold">{t("learning.coursesTitle")}</h3>
                <PagedList
                  id="account-courses"
                  className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                  items={courses.map((course) => (
                    <CourseRecord
                      key={course.courseId}
                      course={course}
                      labels={{
                        completed: t("learning.completed"),
                        progress: t("learning.progressLabel", { course: course.title }),
                        count: t("learning.lessonCount", {
                          done: course.lessonsCompleted,
                          total: course.lessonsTotal,
                        }),
                        percent: percent(course.percent),
                        lastActive: t("learning.lastActive", { date: date(course.lastActiveAt) }),
                        action: course.resume ? t("learning.resume") : t("learning.review"),
                        quizEyebrow: t("learning.finalQuiz"),
                        quizState: course.finalQuiz
                          ? course.finalQuiz.passed
                            ? t("learning.finalQuizPassed", {
                                score: percent(course.finalQuiz.bestPercentage),
                              })
                            : course.finalQuiz.attempts > 0
                              ? t("learning.finalQuizTried", {
                                  score: percent(course.finalQuiz.bestPercentage),
                                  count: course.finalQuiz.attempts,
                                })
                              : t("learning.finalQuizNone")
                          : t("learning.finalQuizAbsent"),
                        quizAction: t("learning.finalQuizTake"),
                        quizActionAria: t("learning.finalQuizTakeAria", {
                          quiz: course.finalQuiz?.title ?? "",
                        }),
                      }}
                    />
                  ))}
                />
              </>
            )}
          </section>

          {/* ── Lessons read (ADR-134) ────────────────────────────
              Every lesson opened while signed in, most recent first. Rendered
              only when there is one: "Continue learning" above already carries
              the empty state for a learner who has not started. */}
          {lessonReads.length > 0 && (
            <section aria-labelledby="account-lessons" className="flex flex-col gap-4">
              <SectionTitle
                id="account-lessons"
                tone="info"
                icon={<BookOpenCheck />}
                count={lessonReads.length}
              >
                {t("lessonReads.title")}
              </SectionTitle>
              <PagedList
                id="account-lesson-list"
                className="divide-y rounded-lg border bg-card"
                items={lessonReads.map((read) => (
                  <li key={read.lessonId} className="flex items-center gap-3 px-4 py-3">
                    {read.isCompleted ? (
                      <CircleCheck
                        aria-hidden
                        className="size-5 shrink-0 text-success-interactive"
                      />
                    ) : (
                      <BookOpen aria-hidden className="size-5 shrink-0 text-info-interactive" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Link
                        href={read.href}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {read.title}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">
                        {t("lessonReads.meta", {
                          course: read.courseTitle,
                          date: date(read.viewedAt),
                        })}
                      </span>
                    </div>
                    {read.isCompleted ? (
                      <Badge variant="success">{t("learning.completed")}</Badge>
                    ) : (
                      <Badge variant="info">{t("lessonReads.inProgress")}</Badge>
                    )}
                  </li>
                ))}
              />
            </section>
          )}

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            {/* ── Recent quiz attempts ───────────────────────────── */}
            <section aria-labelledby="account-quizzes" className="flex flex-col gap-4">
              <SectionTitle
                id="account-quizzes"
                tone="success"
                icon={<ListChecks />}
                count={quizAttempts.length}
              >
                {t("quizzes.title")}
              </SectionTitle>
              {quizAttempts.length === 0 ? (
                <EmptyState title={t("quizzes.emptyTitle")} description={t("quizzes.emptyBody")} />
              ) : (
                <PagedList
                  id="account-quiz-list"
                  className="divide-y rounded-lg border bg-card"
                  items={quizAttempts.map((attempt) => (
                    <li key={attempt.attemptId} className="flex items-center gap-3 px-4 py-3">
                      {attempt.passed ? (
                        <CircleCheck
                          aria-hidden
                          className="size-5 shrink-0 text-success-interactive"
                        />
                      ) : (
                        <CircleX
                          aria-hidden
                          className="size-5 shrink-0 text-destructive-interactive"
                        />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link
                          href={attempt.href}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {attempt.title}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {date(attempt.completedAt)}
                        </span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {percent(attempt.percentage)}
                      </span>
                      <Badge variant={attempt.passed ? "success" : "danger"}>
                        {attempt.passed ? t("quizzes.passed") : t("quizzes.notPassed")}
                      </Badge>
                    </li>
                  ))}
                />
              )}
            </section>

            {/* ── Recent reading ─────────────────────────────────── */}
            <section aria-labelledby="account-reading" className="flex flex-col gap-4">
              <SectionTitle
                id="account-reading"
                tone="warning"
                icon={<Newspaper />}
                count={reads.length}
              >
                {t("reading.title")}
              </SectionTitle>
              {reads.length === 0 ? (
                <EmptyState
                  title={t("reading.emptyTitle")}
                  description={t("reading.emptyBody")}
                  action={
                    <Button variant="outline" render={<Link href="/news" />}>
                      {t("reading.browse")}
                    </Button>
                  }
                />
              ) : (
                <PagedList
                  id="account-reading-list"
                  className="divide-y rounded-lg border bg-card"
                  items={reads.map((read) => (
                    <li key={read.articleId} className="flex items-center gap-3 px-4 py-3">
                      <Newspaper aria-hidden className="size-5 shrink-0 text-warning-interactive" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link
                          href={read.href}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {read.title}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {t("reading.readOn", { date: date(read.readAt) })}
                        </span>
                      </div>
                      <Badge variant={read.kind === "ANALYSIS" ? "info" : "warning"}>
                        {read.kind === "ANALYSIS" ? t("reading.analysis") : t("reading.news")}
                      </Badge>
                    </li>
                  ))}
                />
              )}
            </section>
          </div>
        </Container>
      </Section>
    </>
  );
}

/**
 * The band heading: a glyph on a tile in the band's tone, the title, and how
 * many rows the band holds. The count is the LOADED rows, which is what the
 * pager below it pages through.
 */
function SectionTitle({
  id,
  tone,
  icon,
  count,
  children,
}: {
  id: string;
  tone: Tone;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b pb-3">
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md ring-1 [&_svg]:size-4.5",
          TONE_TILE[tone],
        )}
      >
        {icon}
      </span>
      <h2 id={id} className="text-lg font-semibold">
        {children}
      </h2>
      {count !== undefined && count > 0 && (
        <Badge variant="pill" className="ms-auto tabular-nums">
          {count}
        </Badge>
      )}
    </div>
  );
}

/**
 * One started course. Every card has the same five rows in the same order,
 * and the two that vary in length (the title and the assessment line) are
 * clamped, so cards in a row are the same height.
 */
function CourseRecord({
  course,
  labels,
}: {
  course: AccountCourseView;
  labels: {
    completed: string;
    progress: string;
    count: string;
    percent: string;
    lastActive: string;
    action: string;
    quizEyebrow: string;
    quizState: string;
    quizAction: string;
    quizActionAria: string;
  };
}) {
  const quiz = course.finalQuiz;
  return (
    <li className="flex h-full flex-col overflow-hidden rounded-lg border bg-card">
      <div className="relative">
        <CourseCover url={courseCoverUrl(course.coverUrl, course.track)} className="aspect-16/9" />
        {course.isCompleted && (
          <Badge variant="marker" className="absolute start-3 top-3">
            {labels.completed}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Link
          href={course.href}
          className="line-clamp-2 min-h-10 text-sm font-semibold hover:underline"
        >
          {course.title}
        </Link>
        <ProgressBar
          value={course.lessonsCompleted}
          total={course.lessonsTotal}
          label={labels.progress}
          countLabel={labels.count}
          percentLabel={labels.percent}
        />
        {/* Present on every card, a course without an assessment included, so
            the row does not appear and disappear across a grid. */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-2 text-xs",
            quiz?.passed
              ? "bg-success/10 text-success-interactive"
              : quiz
                ? "bg-warning/10 text-warning-interactive"
                : "bg-muted text-muted-foreground",
          )}
        >
          <Award aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{labels.quizEyebrow}</span> · {labels.quizState}
          </span>
          {quiz && !quiz.passed && (
            <Link
              href={quiz.href}
              aria-label={labels.quizActionAria}
              className="shrink-0 font-semibold underline-offset-4 hover:underline"
            >
              {labels.quizAction}
            </Link>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
          <span className="truncate">{labels.lastActive}</span>
          <Link
            href={course.resume?.href ?? course.href}
            className="shrink-0 font-medium text-primary-interactive hover:underline"
          >
            {labels.action}
          </Link>
        </div>
      </div>
    </li>
  );
}

function CourseCover({ url, className }: { url: string | null; className?: string }) {
  if (!url) return <div aria-hidden className={cn("bg-muted", className)} />;
  return (
    <div className={cn("relative bg-muted", className)}>
      <Image
        src={url}
        alt=""
        fill
        sizes="(min-width: 1024px) 24rem, (min-width: 768px) 50vw, 100vw"
        className="object-cover"
        unoptimized={url.endsWith(".svg") || isGeneratedCover(url)}
      />
    </div>
  );
}
