// changes-11 Phase 5 required tests (ADR-056) against a real MariaDB.
//
// Testcontainers rather than a mocked Prisma, and here that is not a style
// preference: the two properties this file exists to prove — the unique
// constraint making completion idempotent, and the row lock keeping the
// denormalised counter honest under concurrency — are database behaviours. A
// mock would pass while production drifted.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ContentStatus } from "@repo/db";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type * as CoursesModule from "./courses.ts";
import type * as SectionsModule from "./course-sections.ts";
import type * as LessonsModule from "./lessons.ts";
import type * as ProgressModule from "./progress.ts";
import type * as FeedbackModule from "./lesson-feedback.ts";
import type * as AnalyticsModule from "./learn-analytics.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let courses: typeof CoursesModule;
let sections: typeof SectionsModule;
let lessons: typeof LessonsModule;
let progress: typeof ProgressModule;
let feedback: typeof FeedbackModule;
let analytics: typeof AnalyticsModule;

let editor: Subject;
/** Two learners, because half of what is under test is that they cannot see each other. */
let alice: string;
let bob: string;

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_test")
    .withUsername("test")
    .withUserPassword("test")
    .start();

  const url = container.getConnectionUri().replace(/^mariadb:/, "mysql:");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = url;
  db = (await import("@repo/db")).db;
  courses = await import("./courses.ts");
  sections = await import("./course-sections.ts");
  lessons = await import("./lessons.ts");
  progress = await import("./progress.ts");
  feedback = await import("./lesson-feedback.ts");
  analytics = await import("./learn-analytics.ts");

  const staff = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: "progress-editor@x.com",
      name: "Editor",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
  editor = {
    id: staff.id,
    userType: "STAFF",
    roleKeys: [],
    maxRoleLevel: 60,
    allowed: new Set([
      "courses.view",
      "courses.create",
      "courses.update",
      "courses.publish",
      "lessons.view",
      "lessons.create",
      "lessons.update",
      "lessons.publish",
    ]),
    denied: new Set(),
  };

  const learners = await Promise.all(
    ["alice", "bob"].map((name) =>
      db.user.create({
        data: {
          id: crypto.randomUUID(),
          email: `${name}@learner.test`,
          name,
          status: "ACTIVE",
          userType: "LEARNER",
        },
      }),
    ),
  );
  alice = learners[0]!.id;
  bob = learners[1]!.id;

  await db.locale.create({
    data: {
      code: "en",
      name: "English",
      nativeName: "English",
      direction: "LTR",
      isDefault: true,
      isActive: true,
      sortOrder: 1,
    },
  });
}, 180_000);

afterAll(async () => {
  await db.$disconnect();
  await container.stop();
});

// ─── Fixtures ────────────────────────────────────────────────

let seq = 0;

/**
 * A published course with one published section and `lessonCount` published
 * lessons, all required unless `optionalFrom` says otherwise.
 */
async function makeCourse(options?: {
  lessons?: number;
  /** Index (0-based) from which lessons are `isRequired: false`. */
  optionalFrom?: number;
  publish?: boolean;
}): Promise<{ courseId: string; lessonIds: string[] }> {
  seq += 1;
  const count = options?.lessons ?? 1;
  const courseId = await courses.createCourse(editor, {
    track: "forex",
    title: `Progress course ${seq}`,
  });
  const sectionId = await sections.createSection(editor, courseId, "Section One");

  const lessonIds: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const lessonId = await lessons.createLesson(editor, {
      sectionId,
      title: `Progress lesson ${seq}.${index}`,
    });
    await lessons.saveLesson(editor, {
      lessonId,
      meta: {},
      translation: {
        locale: "en",
        title: `Progress lesson ${seq}.${index}`,
        content: "<p>Body.</p>",
      },
      attachments: [],
    });
    if (options?.optionalFrom !== undefined && index >= options.optionalFrom) {
      await db.lesson.update({ where: { id: lessonId }, data: { isRequired: false } });
    }
    lessonIds.push(lessonId);
  }

  if (options?.publish !== false) {
    await db.courseSection.update({ where: { id: sectionId }, data: { isPublished: true } });
    await db.course.update({
      where: { id: courseId },
      data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
    });
    await db.lesson.updateMany({
      where: { id: { in: lessonIds } },
      data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
    });
    await db.$transaction(async (tx) => {
      await courses.recomputeLessonCount(tx, courseId);
    });
  }

  return { courseId, lessonIds };
}

// ─── Idempotency and the counter (ADR-056 #2) ────────────────

describe("marking a lesson complete", () => {
  it("is idempotent: two writes produce one row and a counter of one", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 3 });

    await progress.markLessonComplete(alice, lessonIds[0]!);
    const view = await progress.markLessonComplete(alice, lessonIds[0]!);

    const rows = await db.lessonProgress.count({ where: { userId: alice, courseId } });
    expect(rows).toBe(1);
    expect(view.lessonsCompleted).toBe(1);

    const enrollment = await db.courseEnrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: alice, courseId } },
    });
    expect(enrollment.lessonsCompleted).toBe(1);
  });

  it("keeps `lessonsCompleted` equal to the distinct completed lessons under concurrency", async () => {
    // The regression this file exists for. Without the row lock in
    // `withEnrollmentLock`, each of these transactions counts one completed
    // lesson and writes 1, leaving a counter of 1 where the answer is 5.
    const { courseId, lessonIds } = await makeCourse({ lessons: 5 });

    await Promise.all(lessonIds.map((lessonId) => progress.markLessonComplete(bob, lessonId)));

    const distinct = await db.lessonProgress.count({
      where: { userId: bob, courseId, status: "COMPLETED" },
    });
    const enrollment = await db.courseEnrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: bob, courseId } },
    });

    expect(distinct).toBe(5);
    expect(enrollment.lessonsCompleted).toBe(5);
  });

  it("moves lastLessonId, which is what 'Continue learning' returns to", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 3 });

    await progress.touchLesson(alice, lessonIds[0]!);
    await progress.markLessonComplete(alice, lessonIds[0]!);
    const view = await progress.touchLesson(alice, lessonIds[1]!);

    expect(view.lastLessonId).toBe(lessonIds[1]);
    const summaries = await progress.getLearnerDashboard(alice);
    expect(summaries.find((row) => row.courseId === courseId)?.lastLessonId).toBe(lessonIds[1]);
  });

  it("does not downgrade a completed lesson when the learner revisits it", async () => {
    // `touchLesson`'s empty `update` clause, stated as behaviour: rereading a
    // finished lesson is a visit, not an un-completion.
    const { lessonIds } = await makeCourse({ lessons: 2 });

    await progress.markLessonComplete(alice, lessonIds[0]!);
    const view = await progress.touchLesson(alice, lessonIds[0]!);

    expect(view.lessons.find((row) => row.lessonId === lessonIds[0])?.state).toBe("completed");
    expect(view.lessonsCompleted).toBe(1);
  });

  it("un-completes on request, and the counter follows", async () => {
    const { lessonIds } = await makeCourse({ lessons: 2 });

    await progress.markLessonComplete(alice, lessonIds[0]!);
    const view = await progress.markLessonIncomplete(alice, lessonIds[0]!);

    expect(view.lessonsCompleted).toBe(0);
    // The row survives as IN_PROGRESS: the learner HAS opened the lesson, and
    // deleting the row would claim otherwise on the next page load.
    expect(view.lessons.find((row) => row.lessonId === lessonIds[0])?.state).toBe("in-progress");
  });
});

// ─── Course completion (ADR-056 #7) ──────────────────────────

describe("course completion", () => {
  it("completes when every REQUIRED lesson is done, even with an optional one left", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 3, optionalFrom: 2 });

    await progress.markLessonComplete(alice, lessonIds[0]!);
    const beforeLast = await progress.getCourseProgress(alice, courseId);
    expect(beforeLast.isCompleted).toBe(false);

    const view = await progress.markLessonComplete(alice, lessonIds[1]!);

    expect(view.isCompleted).toBe(true);
    expect(view.completedAt).not.toBeNull();
    // Two of three lessons: completion is about the REQUIRED set, the counter
    // is about everything published. They are different questions and the view
    // answers both.
    expect(view.lessonsCompleted).toBe(2);
    expect(view.lessonsTotal).toBe(3);
  });

  it("does not complete while a required lesson is outstanding", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 2 });
    await progress.markLessonComplete(bob, lessonIds[0]!);

    const view = await progress.getCourseProgress(bob, courseId);
    expect(view.isCompleted).toBe(false);
    expect(view.completedAt).toBeNull();
  });

  it("keeps the ORIGINAL completion date when a completed course is revisited", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 1 });
    const first = await progress.markLessonComplete(alice, lessonIds[0]!);
    expect(first.completedAt).not.toBeNull();

    const again = await progress.touchLesson(alice, lessonIds[0]!);
    expect(again.completedAt).toBe(first.completedAt);

    const enrollment = await db.courseEnrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: alice, courseId } },
    });
    expect(enrollment.completedAt?.toISOString()).toBe(first.completedAt);
  });

  it("falls back out of completion when a new required lesson is published", async () => {
    // Not a bug — the course genuinely is not finished any more, and telling
    // the learner otherwise would be the lie. It is the mirror image of
    // ADR-056 #6: EDITING a lesson never un-completes it (below); ADDING one
    // reopens the course.
    const { courseId, lessonIds } = await makeCourse({ lessons: 1 });
    await progress.markLessonComplete(alice, lessonIds[0]!);

    const section = await db.courseSection.findFirstOrThrow({ where: { courseId } });
    const extra = await lessons.createLesson(editor, { sectionId: section.id, title: "Late" });
    await db.lesson.update({
      where: { id: extra },
      data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
    });

    const view = await progress.touchLesson(alice, lessonIds[0]!);
    expect(view.isCompleted).toBe(false);
  });

  it("does not call an empty course complete", async () => {
    const { courseId } = await makeCourse({ lessons: 0 });
    // Nothing to complete, so nothing IS complete. Congratulating a learner
    // for opening an empty course is worse than showing no state at all.
    await db.courseEnrollment.create({ data: { userId: alice, courseId } });
    const view = await progress.getCourseProgress(alice, courseId);
    expect(view.isCompleted).toBe(false);
  });
});

// ─── The final assessment (ADR-084 #2, #8) ───────────────────

/**
 * A publishable quiz with one question, and one passing attempt on demand.
 *
 * Built through Prisma for the reason `learn.integration.test.ts`'s twin is:
 * the states under test are the ones an editor leaves behind, and `saveQuiz`
 * exists to prevent most of them.
 */
async function makeQuiz(options?: { published?: boolean; questions?: number }): Promise<string> {
  seq += 1;
  const quiz = await db.quiz.create({
    data: {
      track: "forex",
      passingScore: 70,
      status: options?.published === false ? ContentStatus.DRAFT : ContentStatus.PUBLISHED,
      publishedAt: options?.published === false ? null : new Date(),
      translations: { create: { locale: "en", title: `Quiz ${seq}`, slug: `p-quiz-${seq}` } },
    },
  });
  for (let index = 0; index < (options?.questions ?? 1); index += 1) {
    await db.quizQuestion.create({
      data: {
        quizId: quiz.id,
        sortOrder: index,
        correctAnswer: 0,
        translations: { create: { locale: "en", prompt: `Q${index}`, options: ["a", "b"] } },
      },
    });
  }
  return quiz.id;
}

async function recordAttempt(
  userId: string,
  quizId: string,
  percentage: number,
  passed: boolean,
  attemptNumber: number,
): Promise<void> {
  await db.quizAttempt.create({
    data: {
      quizId,
      userId,
      attemptNumber,
      score: percentage,
      percentage,
      passed,
      answers: {},
      grades: {},
      completedAt: new Date(),
    },
  });
}

describe("requiredOutstanding — what the assessment card unlocks on", () => {
  // The reason this is a counted field rather than `completed >= total`:
  // both counters include the optional lesson, so the arithmetic version
  // never reaches zero on this course and the card never unlocks.
  it("ignores optional lessons", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 3, optionalFrom: 2 });

    const start = await progress.getCourseProgress(alice, courseId);
    expect(start.requiredOutstanding).toBe(2);

    await progress.markLessonComplete(alice, lessonIds[0]!);
    await progress.markLessonComplete(alice, lessonIds[1]!);

    const done = await progress.getCourseProgress(alice, courseId);
    expect(done.requiredOutstanding).toBe(0);
    expect(done.lessonsCompleted).toBeLessThan(done.lessonsTotal);
  });

  it("counts back up when a new required lesson is published", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 1 });
    await progress.markLessonComplete(alice, lessonIds[0]!);
    expect((await progress.getCourseProgress(alice, courseId)).requiredOutstanding).toBe(0);

    const section = await db.courseSection.findFirstOrThrow({
      where: { courseId },
      select: { id: true },
    });
    const extra = await lessons.createLesson(editor, {
      sectionId: section.id,
      title: "Late arrival",
    });
    await lessons.saveLesson(editor, {
      lessonId: extra,
      meta: {},
      translation: { locale: "en", title: "Late arrival", content: "<p>x</p>" },
      attachments: [],
    });
    await db.lesson.update({
      where: { id: extra },
      data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
    });

    expect((await progress.getCourseProgress(alice, courseId)).requiredOutstanding).toBe(1);
  });
});

describe("the final quiz and completion", () => {
  it("holds a course back until its final quiz is passed, then reports the score", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 1 });
    const quizId = await makeQuiz();
    await db.course.update({ where: { id: courseId }, data: { finalQuizId: quizId } });

    const afterLessons = await progress.markLessonComplete(alice, lessonIds[0]!);
    expect(afterLessons.requiredOutstanding).toBe(0);
    expect(afterLessons.isCompleted).toBe(false);
    expect(afterLessons.finalQuiz).toEqual({ passed: false, bestPercentage: 0, attempts: 0 });

    // Two attempts: passed on the first, worse on the second. "Passed" is ANY
    // passing attempt, and the best score is the best of them.
    await recordAttempt(alice, quizId, 90, true, 1);
    await recordAttempt(alice, quizId, 40, false, 2);
    const view = await progress.touchLesson(alice, lessonIds[0]!);

    expect(view.isCompleted).toBe(true);
    expect(view.finalQuiz).toEqual({ passed: true, bestPercentage: 90, attempts: 2 });
  });

  // ADR-084 #8. Before this, un-publishing a final quiz left every enrolled
  // learner's course permanently incompletable, with nothing on screen saying
  // why — the requirement survived, the way to satisfy it did not.
  it("stops blocking when the final quiz is no longer reachable", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 1 });
    const quizId = await makeQuiz();
    await db.course.update({ where: { id: courseId }, data: { finalQuizId: quizId } });

    await progress.markLessonComplete(bob, lessonIds[0]!);
    expect((await progress.getCourseProgress(bob, courseId)).isCompleted).toBe(false);

    await db.quiz.update({ where: { id: quizId }, data: { status: ContentStatus.DRAFT } });
    const unblocked = await progress.touchLesson(bob, lessonIds[0]!);

    expect(unblocked.isCompleted).toBe(true);
    // And the card is absent rather than locked: the same null that hides it
    // is the null that stopped it blocking.
    expect(unblocked.finalQuiz).toBeNull();

    // Re-publishing it puts the requirement back. That is correct — the
    // course genuinely is not finished any more — and it is the same
    // behaviour as publishing a new required lesson.
    await db.quiz.update({
      where: { id: quizId },
      data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
    });
    const reblocked = await progress.touchLesson(bob, lessonIds[0]!);
    expect(reblocked.isCompleted).toBe(false);
    expect(reblocked.finalQuiz).toEqual({ passed: false, bestPercentage: 0, attempts: 0 });
  });

  it("treats a questionless final quiz as unreachable", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 1 });
    const quizId = await makeQuiz({ questions: 0 });
    await db.course.update({ where: { id: courseId }, data: { finalQuizId: quizId } });

    const view = await progress.markLessonComplete(alice, lessonIds[0]!);
    expect(view.isCompleted).toBe(true);
    expect(view.finalQuiz).toBeNull();
  });
});

// ─── Scoping and visibility (ADR-056 #1, security.md #7) ─────

describe("scoping", () => {
  it("never returns one learner's progress to another", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 2 });
    await progress.markLessonComplete(alice, lessonIds[0]!);

    const bobsView = await progress.getCourseProgress(bob, courseId);
    expect(bobsView.lessons).toHaveLength(0);
    expect(bobsView.lessonsCompleted).toBe(0);

    const bobsDashboard = await progress.getLearnerDashboard(bob);
    expect(bobsDashboard.some((row) => row.courseId === courseId)).toBe(false);
  });

  it("refuses to record progress against an unpublished lesson", async () => {
    const { lessonIds } = await makeCourse({ lessons: 1, publish: false });
    await expect(progress.markLessonComplete(alice, lessonIds[0]!)).rejects.toThrow(
      progress.LessonNotAccessibleError,
    );
  });

  it("refuses a lesson in a gated course, and cannot be used to detect one", async () => {
    // ADR-012: AUTHENTICATED/PREMIUM content is absent from the public rule
    // entirely, so this is the same error a nonexistent id produces — which is
    // the point. The route turns both into 404.
    const { courseId, lessonIds } = await makeCourse({ lessons: 1 });
    await db.course.update({ where: { id: courseId }, data: { visibility: "PREMIUM" } });

    await expect(progress.markLessonComplete(alice, lessonIds[0]!)).rejects.toThrow(
      progress.LessonNotAccessibleError,
    );
    await expect(progress.markLessonComplete(alice, "no-such-lesson")).rejects.toThrow(
      progress.LessonNotAccessibleError,
    );
    await expect(progress.getCourseProgress(alice, courseId)).rejects.toThrow(
      progress.CourseNotAccessibleError,
    );
  });

  it("editing a lesson does not un-complete it (ADR-056 #6)", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 1 });
    await progress.markLessonComplete(alice, lessonIds[0]!);

    await lessons.saveLesson(editor, {
      lessonId: lessonIds[0]!,
      meta: {},
      translation: { locale: "en", title: "Rewritten", content: "<p>All new.</p>" },
      attachments: [],
    });

    const view = await progress.getCourseProgress(alice, courseId);
    expect(view.lessons.find((row) => row.lessonId === lessonIds[0])?.state).toBe("completed");
    expect(view.isCompleted).toBe(true);
  });

  it("orders the dashboard by most recent activity", async () => {
    const older = await makeCourse({ lessons: 1 });
    const newer = await makeCourse({ lessons: 1 });

    await progress.touchLesson(bob, older.lessonIds[0]!);
    await progress.touchLesson(bob, newer.lessonIds[0]!);

    const summaries = await progress.getLearnerDashboard(bob);
    const positions = [
      summaries.findIndex((row) => row.courseId === newer.courseId),
      summaries.findIndex((row) => row.courseId === older.courseId),
    ];
    expect(positions[0]).toBeGreaterThanOrEqual(0);
    expect(positions[0]).toBeLessThan(positions[1]!);
  });
});

// ─── Lesson feedback (ADR-056 #8) ────────────────────────────

describe("lesson feedback", () => {
  it("keeps one row per signed-in learner and updates it when they change their mind", async () => {
    const { lessonIds } = await makeCourse({ lessons: 1 });
    const lessonId = lessonIds[0]!;

    await feedback.recordLessonFeedback({ lessonId, userId: alice, helpful: true });
    await feedback.recordLessonFeedback({ lessonId, userId: alice, helpful: false });

    const rows = await db.lessonFeedback.findMany({ where: { lessonId, userId: alice } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.helpful).toBe(false);
  });

  it("accumulates anonymous votes, because NULLs are distinct in the unique index", async () => {
    const { lessonIds } = await makeCourse({ lessons: 1 });
    const lessonId = lessonIds[0]!;

    await feedback.recordLessonFeedback({ lessonId, userId: null, helpful: true });
    await feedback.recordLessonFeedback({ lessonId, userId: null, helpful: true });

    const rows = await db.lessonFeedback.count({ where: { lessonId, userId: null } });
    expect(rows).toBe(2);
  });

  it("tallies helpful and not-helpful separately, including lessons with no votes", async () => {
    const { lessonIds } = await makeCourse({ lessons: 2 });
    const [voted, silent] = lessonIds as [string, string];

    await feedback.recordLessonFeedback({ lessonId: voted, userId: alice, helpful: true });
    await feedback.recordLessonFeedback({ lessonId: voted, userId: bob, helpful: false });
    await feedback.recordLessonFeedback({ lessonId: voted, userId: null, helpful: false });

    const tallies = await feedback.tallyLessonFeedback([voted, silent]);
    expect(tallies).toEqual([
      { lessonId: voted, helpful: 1, notHelpful: 2 },
      { lessonId: silent, helpful: 0, notHelpful: 0 },
    ]);
  });

  it("refuses a vote on a lesson the public rule hides", async () => {
    const { lessonIds } = await makeCourse({ lessons: 1, publish: false });
    await expect(
      feedback.recordLessonFeedback({ lessonId: lessonIds[0]!, userId: null, helpful: true }),
    ).rejects.toThrow(feedback.LessonFeedbackNotAccessibleError);
  });

  it("takes a learner's votes with them when the account is deleted", async () => {
    // The one place this deviates from ADR-056 #8's sketch (a bare `userId`
    // column): the FK cascade is why a deleted learner leaves no attributable
    // rows behind.
    const { lessonIds } = await makeCourse({ lessons: 1 });
    const doomed = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `doomed-${seq}@learner.test`,
        name: "Doomed",
        status: "ACTIVE",
        userType: "LEARNER",
      },
    });
    await feedback.recordLessonFeedback({
      lessonId: lessonIds[0]!,
      userId: doomed.id,
      helpful: true,
    });

    await db.user.delete({ where: { id: doomed.id } });
    expect(await db.lessonFeedback.count({ where: { userId: doomed.id } })).toBe(0);
  });
});

// ─── Analytics (Phase 9) ─────────────────────────────────────
//
// Deliberately in THIS file rather than its own: every number the analytics
// service reports is an aggregate over the rows these tests already create, so
// asserting them here proves they read the same rows the rest of the suite
// wrote — which is the only thing that could go wrong.

describe("learning analytics", () => {
  it("counts a started course, its completion, and the mean lessons done", async () => {
    const { courseId, lessonIds } = await makeCourse({ lessons: 2 });
    await progress.markLessonComplete(alice, lessonIds[0]!);
    await progress.markLessonComplete(alice, lessonIds[1]!);
    await progress.touchLesson(bob, lessonIds[0]!);

    const rows = await analytics.loadCourseAnalytics();
    const row = rows.find((entry) => entry.courseId === courseId);

    expect(row).toBeDefined();
    // Two learners opened it; one finished.
    expect(row!.started).toBe(2);
    expect(row!.completed).toBe(1);
    expect(row!.completionRate).toBe(50);
    expect(row!.lessonCount).toBe(2);
    // (2 + 0) / 2 — bob touched a lesson without completing it.
    expect(row!.averageLessonsCompleted).toBe(1);
  });

  it("reports drop-off as opened-and-not-completed", async () => {
    const { lessonIds } = await makeCourse({ lessons: 2 });
    // alice finishes the first and stalls on the second; bob only opens it.
    await progress.markLessonComplete(alice, lessonIds[0]!);
    await progress.touchLesson(alice, lessonIds[1]!);
    await progress.touchLesson(bob, lessonIds[1]!);

    const rows = await analytics.loadLessonAnalytics();
    const stalled = rows.find((row) => row.lessonId === lessonIds[1]);

    expect(stalled!.reached).toBe(2);
    expect(stalled!.completed).toBe(0);
    // The number the screen exists for. It is only computable because
    // LessonProgress keeps an IN_PROGRESS row rather than recording
    // completions alone.
    expect(stalled!.droppedOff).toBe(2);
  });

  it("ranks least-helpful lessons by NET score, not ratio", async () => {
    const { lessonIds } = await makeCourse({ lessons: 2 });
    const [oneBadVote, genuinelyBad] = lessonIds as [string, string];

    // A single early "no" is a 0% ratio and means nothing.
    await feedback.recordLessonFeedback({ lessonId: oneBadVote, userId: alice, helpful: false });
    // A real problem: more no than yes, on more votes.
    await feedback.recordLessonFeedback({ lessonId: genuinelyBad, userId: alice, helpful: false });
    await feedback.recordLessonFeedback({ lessonId: genuinelyBad, userId: bob, helpful: false });
    await feedback.recordLessonFeedback({ lessonId: genuinelyBad, userId: null, helpful: false });

    const rows = await analytics.loadLeastHelpfulLessons(20);
    const worst = rows.findIndex((row) => row.lessonId === genuinelyBad);
    const mild = rows.findIndex((row) => row.lessonId === oneBadVote);

    expect(worst).toBeGreaterThanOrEqual(0);
    expect(mild).toBeGreaterThanOrEqual(0);
    // A ratio ranking would tie these at 0%; net puts the real problem first.
    expect(worst).toBeLessThan(mild);
    expect(rows[worst]!.net).toBe(-3);
  });

  it("summarises without counting an abandoned attempt as activity", async () => {
    const before = await analytics.loadLearnAnalyticsSummary();
    expect(before.enrolments).toBeGreaterThan(0);
    expect(before.activeLearners).toBeGreaterThan(0);
    expect(before.lessonsCompleted).toBeGreaterThan(0);
    // The final-quiz block above left two COMPLETED attempts behind, which is
    // what makes the next assertion mean something: the table is not empty, so
    // a count that ignored `completedAt` would not read as zero either.
    expect(before.quizAttempts).toBeGreaterThan(0);

    // A learner who opens a quiz and walks away. `quizAttempts` filters on
    // `completedAt`, so this row must not move the number the screen shows —
    // an abandoned attempt is not activity, and counting it would inflate
    // engagement with the learners who bounced.
    const quizId = await makeQuiz();
    await db.quizAttempt.create({
      data: {
        quizId,
        userId: alice,
        attemptNumber: 1,
        score: 0,
        percentage: 0,
        passed: false,
        answers: {},
        grades: {},
        completedAt: null,
      },
    });

    const after = await analytics.loadLearnAnalyticsSummary();
    expect(after.quizAttempts).toBe(before.quizAttempts);
  });
});
