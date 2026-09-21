import { describe, expect, it } from "vitest";
import type {
  CourseAnalyticsRow,
  LessonAnalyticsRow,
  QuizAnalyticsRow,
} from "./learn-analytics.ts";
import { filterLearnAnalytics, sectionsOf } from "./learn-analytics-filter.ts";

const course = (courseId: string, track: string): CourseAnalyticsRow => ({
  courseId,
  title: courseId,
  track,
  started: 0,
  completed: 0,
  completionRate: 0,
  lessonCount: 0,
  averageLessonsCompleted: 0,
});

const lesson = (lessonId: string, courseId: string, sectionId: string): LessonAnalyticsRow => ({
  lessonId,
  title: lessonId,
  courseId,
  courseTitle: courseId,
  sectionId,
  sectionTitle: `${sectionId} title`,
  reached: 0,
  completed: 0,
  completionRate: 0,
  droppedOff: 0,
  helpful: 0,
  notHelpful: 0,
});

const quiz = (
  quizId: string,
  track: string,
  courseIds: string[],
  sectionIds: string[] = [],
): QuizAnalyticsRow => ({
  quizId,
  title: quizId,
  track,
  courseIds,
  sectionIds,
  attempts: 0,
  learners: 0,
  passed: 0,
  passRate: 0,
  averagePercentage: 0,
});

const data = {
  courses: [course("fx-1", "forex"), course("fx-2", "forex"), course("cr-1", "crypto")],
  lessons: [
    lesson("l1", "fx-1", "s1"),
    lesson("l2", "fx-1", "s2"),
    lesson("l3", "fx-2", "s3"),
    lesson("l4", "cr-1", "s4"),
  ],
  quizzes: [
    quiz("q-lesson", "forex", ["fx-1"], ["s1"]),
    quiz("q-final", "forex", ["fx-1"]),
    quiz("q-shared", "forex", ["fx-1", "fx-2"], ["s3"]),
    quiz("q-alone", "forex", []),
    quiz("q-crypto", "crypto", ["cr-1"], ["s4"]),
  ],
};

const ids = <T>(rows: T[], key: keyof T) => rows.map((row) => row[key]);

describe("filterLearnAnalytics", () => {
  it("returns everything, and no scope, when nothing is chosen", () => {
    const result = filterLearnAnalytics(data, {});
    expect(result.courses).toHaveLength(3);
    expect(result.lessons).toHaveLength(4);
    expect(result.quizzes).toHaveLength(5);
    expect(result.scope).toBeUndefined();
  });

  it("narrows a school to its courses, their lessons and every quiz of that track", () => {
    const result = filterLearnAnalytics(data, { track: "forex" });
    expect(ids(result.courses, "courseId")).toEqual(["fx-1", "fx-2"]);
    expect(ids(result.lessons, "lessonId")).toEqual(["l1", "l2", "l3"]);
    // A quiz no course uses still belongs to its school.
    expect(ids(result.quizzes, "quizId")).toEqual(["q-lesson", "q-final", "q-shared", "q-alone"]);
    expect(result.scope?.courseIds).toEqual(["fx-1", "fx-2"]);
  });

  it("keeps every quiz a course uses — a lesson's, the final one, a shared one — and no other", () => {
    const result = filterLearnAnalytics(data, { courseId: "fx-1" });
    expect(ids(result.lessons, "lessonId")).toEqual(["l1", "l2"]);
    expect(ids(result.quizzes, "quizId")).toEqual(["q-lesson", "q-final", "q-shared"]);
    expect(result.scope).toEqual({
      courseIds: ["fx-1"],
      quizIds: ["q-lesson", "q-final", "q-shared"],
    });
  });

  it("narrows a section (module) to its own lessons and quizzes", () => {
    const result = filterLearnAnalytics(data, { courseId: "fx-1", sectionId: "s1" });
    expect(ids(result.lessons, "lessonId")).toEqual(["l1"]);
    expect(ids(result.quizzes, "quizId")).toEqual(["q-lesson"]);
  });

  it("ignores a section that is not in the chosen course", () => {
    const result = filterLearnAnalytics(data, { courseId: "fx-1", sectionId: "s4" });
    expect(ids(result.lessons, "lessonId")).toEqual(["l1", "l2"]);
  });

  it("returns nothing for a course outside the chosen school", () => {
    const result = filterLearnAnalytics(data, { track: "crypto", courseId: "fx-1" });
    expect(result.courses).toEqual([]);
    expect(result.lessons).toEqual([]);
    expect(result.quizzes).toEqual([]);
  });
});

describe("sectionsOf", () => {
  it("lists one course's sections once each", () => {
    expect(sectionsOf(data.lessons, "fx-1")).toEqual([
      { id: "s1", title: "s1 title" },
      { id: "s2", title: "s2 title" },
    ]);
  });
});
