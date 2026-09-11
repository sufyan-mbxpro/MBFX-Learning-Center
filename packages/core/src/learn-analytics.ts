// Learning analytics (changes-11 Phase 9).
//
// Every number here is an aggregate over rows Phases 5 and 6 already write —
// `CourseEnrollment`, `LessonProgress`, `QuizAttempt`, `LessonFeedback`. No new
// table, no event log, no counter column: ADR-056 #2 rejected an event log
// because none of the questions asked here need event history, and this file is
// the evidence for that claim. If a question ever arrives that a fold over
// events would answer and these will not, THAT is the trigger to revisit it.
//
// **Read-only, and gated at the call site on `analytics.view`.** Nothing in
// this file mutates, so there is no `requirePermission` here — the screen that
// calls it is the boundary (security.md #1 governs mutations; a read screen
// gates itself).
//
// One deliberate omission: **per-question quiz analytics.** ADR-058 #5 stores
// answers as JSON on the attempt, which serves the review screen and cannot be
// aggregated in SQL. "Most frequently missed questions" is the named trigger
// for adding `QuizAttemptAnswer`, and it is the one row of §51 absent below.
import { ContentStatus, LessonProgressStatus, db } from "@repo/db";
import { pickTranslation, type LocaleFallbackInfo } from "@repo/i18n";

interface LocaleContext {
  locales: LocaleFallbackInfo[];
  defaultLocale: string;
}

async function localeContext(): Promise<LocaleContext> {
  const locales = await db.locale.findMany({
    select: { code: true, fallbackCode: true, isDefault: true },
  });
  return {
    locales: locales.map((l) => ({ code: l.code, fallbackCode: l.fallbackCode })),
    defaultLocale: locales.find((l) => l.isDefault)?.code ?? "en",
  };
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

// ─── Courses ─────────────────────────────────────────────────

export interface CourseAnalyticsRow {
  courseId: string;
  title: string;
  /** Learners with a `CourseEnrollment` row — i.e. who opened a lesson. */
  started: number;
  completed: number;
  /** Percentage of starters who finished. */
  completionRate: number;
  lessonCount: number;
  /** Mean completed lessons across everyone who started. */
  averageLessonsCompleted: number;
}

/**
 * One row per course, over every enrollment.
 *
 * "Started" is an enrollment row, which Phase 5 creates on the first touch of
 * any lesson — so it means "opened something", not "pressed a button". That is
 * the honest reading and the only one available: there is no separate enrol
 * action for a learner to take.
 */
export async function loadCourseAnalytics(): Promise<CourseAnalyticsRow[]> {
  const { locales, defaultLocale } = await localeContext();

  const courses = await db.course.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      lessonCount: true,
      translations: { select: { locale: true, title: true } },
    },
  });

  const enrollments = await db.courseEnrollment.groupBy({
    by: ["courseId"],
    _count: { _all: true },
    _sum: { lessonsCompleted: true },
  });
  const completions = await db.courseEnrollment.groupBy({
    by: ["courseId"],
    where: { completedAt: { not: null } },
    _count: { _all: true },
  });

  const startedBy = new Map(enrollments.map((row) => [row.courseId, row._count._all]));
  const sumBy = new Map(enrollments.map((row) => [row.courseId, row._sum.lessonsCompleted ?? 0]));
  const completedBy = new Map(completions.map((row) => [row.courseId, row._count._all]));

  return courses
    .map((course) => {
      const started = startedBy.get(course.id) ?? 0;
      const completed = completedBy.get(course.id) ?? 0;
      const t = pickTranslation(course.translations, defaultLocale, defaultLocale, locales);
      return {
        courseId: course.id,
        title: t?.title ?? "",
        started,
        completed,
        completionRate: rate(completed, started),
        lessonCount: course.lessonCount,
        averageLessonsCompleted:
          started === 0 ? 0 : Math.round(((sumBy.get(course.id) ?? 0) / started) * 10) / 10,
      };
    })
    .sort((a, b) => b.started - a.started);
}

// ─── Lessons ─────────────────────────────────────────────────

export interface LessonAnalyticsRow {
  lessonId: string;
  title: string;
  courseTitle: string;
  reached: number;
  completed: number;
  completionRate: number;
  /**
   * Reached and NOT completed. **This is the drop-off number**, and it is the
   * reason `LessonProgress` keeps an `IN_PROGRESS` row rather than only
   * recording completions: without the row, a lesson nobody finishes and a
   * lesson nobody opens look identical.
   */
  droppedOff: number;
  helpful: number;
  notHelpful: number;
}

export async function loadLessonAnalytics(): Promise<LessonAnalyticsRow[]> {
  const { locales, defaultLocale } = await localeContext();

  const lessons = await db.lesson.findMany({
    where: { deletedAt: null, status: ContentStatus.PUBLISHED },
    select: {
      id: true,
      translations: { select: { locale: true, title: true } },
      section: {
        select: { course: { select: { translations: { select: { locale: true, title: true } } } } },
      },
    },
  });

  const reached = await db.lessonProgress.groupBy({
    by: ["lessonId"],
    _count: { _all: true },
  });
  const completed = await db.lessonProgress.groupBy({
    by: ["lessonId"],
    where: { status: LessonProgressStatus.COMPLETED },
    _count: { _all: true },
  });
  const feedback = await db.lessonFeedback.groupBy({
    by: ["lessonId", "helpful"],
    _count: { _all: true },
  });

  const reachedBy = new Map(reached.map((row) => [row.lessonId, row._count._all]));
  const completedBy = new Map(completed.map((row) => [row.lessonId, row._count._all]));
  const helpfulBy = new Map<string, { yes: number; no: number }>();
  for (const row of feedback) {
    const entry = helpfulBy.get(row.lessonId) ?? { yes: 0, no: 0 };
    if (row.helpful) entry.yes = row._count._all;
    else entry.no = row._count._all;
    helpfulBy.set(row.lessonId, entry);
  }

  return (
    lessons
      .map((lesson) => {
        const reachedCount = reachedBy.get(lesson.id) ?? 0;
        const completedCount = completedBy.get(lesson.id) ?? 0;
        const votes = helpfulBy.get(lesson.id) ?? { yes: 0, no: 0 };
        const t = pickTranslation(lesson.translations, defaultLocale, defaultLocale, locales);
        const courseT = pickTranslation(
          lesson.section.course.translations,
          defaultLocale,
          defaultLocale,
          locales,
        );
        return {
          lessonId: lesson.id,
          title: t?.title ?? "",
          courseTitle: courseT?.title ?? "",
          reached: reachedCount,
          completed: completedCount,
          completionRate: rate(completedCount, reachedCount),
          droppedOff: reachedCount - completedCount,
          helpful: votes.yes,
          notHelpful: votes.no,
        };
      })
      // Worst drop-off first: the screen exists to answer "where do learners
      // stop", so the answer should not need sorting by hand.
      .sort((a, b) => b.droppedOff - a.droppedOff)
  );
}

/**
 * The lessons readers liked least (D28's whole justification).
 *
 * Ranked by NET score rather than ratio, and the difference matters: a lesson
 * with 1 no and 0 yes has a 0% ratio and tells you nothing, while one with 40
 * no and 12 yes is a genuine problem. A minimum vote count is the usual fix and
 * it is the wrong one here — it hides new lessons, which are exactly the ones
 * worth catching early. Net score degrades gracefully instead.
 */
export interface UnhelpfulLessonRow {
  lessonId: string;
  title: string;
  courseTitle: string;
  helpful: number;
  notHelpful: number;
  net: number;
}

export async function loadLeastHelpfulLessons(limit = 10): Promise<UnhelpfulLessonRow[]> {
  const rows = await loadLessonAnalytics();
  return rows
    .filter((row) => row.notHelpful > 0)
    .map((row) => ({
      lessonId: row.lessonId,
      title: row.title,
      courseTitle: row.courseTitle,
      helpful: row.helpful,
      notHelpful: row.notHelpful,
      net: row.helpful - row.notHelpful,
    }))
    .sort((a, b) => a.net - b.net)
    .slice(0, limit);
}

// ─── Quizzes ─────────────────────────────────────────────────

export interface QuizAnalyticsRow {
  quizId: string;
  title: string;
  attempts: number;
  /** Distinct learners, which is not the same as attempts once retakes exist. */
  learners: number;
  passed: number;
  passRate: number;
  averagePercentage: number;
}

export async function loadQuizAnalytics(): Promise<QuizAnalyticsRow[]> {
  const { locales, defaultLocale } = await localeContext();

  const quizzes = await db.quiz.findMany({
    where: { deletedAt: null },
    select: { id: true, translations: { select: { locale: true, title: true } } },
  });

  // Completed attempts only. An abandoned attempt has a score of 0 and would
  // drag every average down while telling us nothing about the quiz.
  const attempts = await db.quizAttempt.groupBy({
    by: ["quizId"],
    where: { completedAt: { not: null } },
    _count: { _all: true },
    _avg: { percentage: true },
  });
  const passes = await db.quizAttempt.groupBy({
    by: ["quizId"],
    where: { completedAt: { not: null }, passed: true },
    _count: { _all: true },
  });
  const learners = await db.quizAttempt.findMany({
    where: { completedAt: { not: null } },
    select: { quizId: true, userId: true },
    distinct: ["quizId", "userId"],
  });

  const attemptsBy = new Map(attempts.map((row) => [row.quizId, row._count._all]));
  const averageBy = new Map(attempts.map((row) => [row.quizId, row._avg.percentage ?? 0]));
  const passedBy = new Map(passes.map((row) => [row.quizId, row._count._all]));
  const learnersBy = new Map<string, number>();
  for (const row of learners) {
    learnersBy.set(row.quizId, (learnersBy.get(row.quizId) ?? 0) + 1);
  }

  return quizzes
    .map((quiz) => {
      const attemptCount = attemptsBy.get(quiz.id) ?? 0;
      const passedCount = passedBy.get(quiz.id) ?? 0;
      const t = pickTranslation(quiz.translations, defaultLocale, defaultLocale, locales);
      return {
        quizId: quiz.id,
        title: t?.title ?? "",
        attempts: attemptCount,
        learners: learnersBy.get(quiz.id) ?? 0,
        passed: passedCount,
        passRate: rate(passedCount, attemptCount),
        averagePercentage: Math.round(averageBy.get(quiz.id) ?? 0),
      };
    })
    .sort((a, b) => b.attempts - a.attempts);
}

// ─── The headline ────────────────────────────────────────────

export interface LearnAnalyticsSummary {
  enrolments: number;
  activeLearners: number;
  coursesCompleted: number;
  lessonsCompleted: number;
  quizAttempts: number;
  feedbackVotes: number;
}

/**
 * `activeLearners` counts distinct learners with any enrollment — not "active
 * in the last 30 days". A window would need a date filter this screen has no
 * control for yet, and a number whose window is invisible is a number nobody
 * can interpret.
 */
export async function loadLearnAnalyticsSummary(): Promise<LearnAnalyticsSummary> {
  const [enrolments, learners, coursesCompleted, lessonsCompleted, quizAttempts, feedbackVotes] =
    await Promise.all([
      db.courseEnrollment.count(),
      db.courseEnrollment.findMany({ select: { userId: true }, distinct: ["userId"] }),
      db.courseEnrollment.count({ where: { completedAt: { not: null } } }),
      db.lessonProgress.count({ where: { status: LessonProgressStatus.COMPLETED } }),
      db.quizAttempt.count({ where: { completedAt: { not: null } } }),
      db.lessonFeedback.count(),
    ]);

  return {
    enrolments,
    activeLearners: learners.length,
    coursesCompleted,
    lessonsCompleted,
    quizAttempts,
    feedbackVotes,
  };
}
