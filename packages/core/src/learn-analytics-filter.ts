// Narrowing the learning-analytics rows to one school, course or section
// (changes-48 #4). Pure, and kept out of `learn-analytics.ts` so it can be
// unit-tested without a database.
//
// The three lists do not narrow the same way, and the difference is the point:
//
// - a COURSE belongs to one track;
// - a LESSON belongs to one section of one course;
// - a QUIZ is standalone (ADR-058 #1 — consumers hold the FK), so it belongs to
//   a track and is USED by any number of courses and sections. Filtering by a
//   course keeps every quiz that course uses, including its final quiz, and a
//   quiz nothing uses appears only under its track, never under a course.
import type {
  CourseAnalyticsRow,
  LearnAnalyticsScope,
  LessonAnalyticsRow,
  QuizAnalyticsRow,
} from "./learn-analytics.ts";

export interface LearnAnalyticsFilter {
  track?: string;
  courseId?: string;
  /** Honoured only inside `courseId` — a section is never picked on its own. */
  sectionId?: string;
}

export interface FilteredLearnAnalytics {
  courses: CourseAnalyticsRow[];
  lessons: LessonAnalyticsRow[];
  quizzes: QuizAnalyticsRow[];
  /** What the summary should count, or undefined for the whole platform. */
  scope: LearnAnalyticsScope | undefined;
}

export function filterLearnAnalytics(
  data: {
    courses: readonly CourseAnalyticsRow[];
    lessons: readonly LessonAnalyticsRow[];
    quizzes: readonly QuizAnalyticsRow[];
  },
  filter: LearnAnalyticsFilter,
): FilteredLearnAnalytics {
  const { track, courseId } = filter;
  // A section id that is not in the chosen course is a stale URL, not a filter.
  const sectionId =
    courseId &&
    filter.sectionId &&
    data.lessons.some((row) => row.courseId === courseId && row.sectionId === filter.sectionId)
      ? filter.sectionId
      : undefined;

  if (!track && !courseId) {
    return {
      courses: [...data.courses],
      lessons: [...data.lessons],
      quizzes: [...data.quizzes],
      scope: undefined,
    };
  }

  const courses = data.courses.filter(
    (row) => (!track || row.track === track) && (!courseId || row.courseId === courseId),
  );
  const courseIds = new Set(courses.map((row) => row.courseId));
  const lessons = data.lessons.filter(
    (row) => courseIds.has(row.courseId) && (!sectionId || row.sectionId === sectionId),
  );
  const quizzes = data.quizzes.filter((row) => {
    if (sectionId) return row.sectionIds.includes(sectionId);
    if (courseId) return row.courseIds.some((id) => courseIds.has(id));
    return row.track === track;
  });

  return {
    courses,
    lessons,
    quizzes,
    scope: { courseIds: [...courseIds], quizIds: quizzes.map((row) => row.quizId) },
  };
}

/** The sections (modules) of one course that have a lesson in the rows, in first-seen order. */
export function sectionsOf(
  lessons: readonly LessonAnalyticsRow[],
  courseId: string,
): { id: string; title: string }[] {
  const seen = new Map<string, string>();
  for (const row of lessons) {
    if (row.courseId === courseId && !seen.has(row.sectionId)) {
      seen.set(row.sectionId, row.sectionTitle);
    }
  }
  return [...seen].map(([id, title]) => ({ id, title }));
}
