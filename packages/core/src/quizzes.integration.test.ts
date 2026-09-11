// changes-11 Phase 6 required tests (ADR-058) against a real MariaDB.
//
// The two properties worth the container: that the correct answer is absent
// from the public payload, and that passing a quiz moves the SAME denormalised
// counter a manual completion moves. Both are cross-table facts a mocked
// Prisma would assert about itself.
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
import type * as QuizzesModule from "./quizzes.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let courses: typeof CoursesModule;
let sections: typeof SectionsModule;
let lessons: typeof LessonsModule;
let progress: typeof ProgressModule;
let quizzes: typeof QuizzesModule;

let editor: Subject;
/** Has every lessons.* key EXCEPT publish — ADR-058 #8's gate, tested. */
let assistant: Subject;
let learner: string;

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
  quizzes = await import("./quizzes.ts");

  const staff = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: "quiz-editor@x.com",
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
  assistant = {
    ...editor,
    allowed: new Set(["courses.update", "lessons.create", "lessons.update"]),
  };

  learner = (
    await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: "quiz-learner@x.com",
        name: "Learner",
        status: "ACTIVE",
        userType: "LEARNER",
      },
    })
  ).id;

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

interface QuizSpec {
  track?: "forex" | "crypto";
  passingScore?: number;
  maxAttempts?: number | null;
  showAnswersAfter?: "NEVER" | "AFTER_SUBMIT" | "AFTER_PASS";
  isStandalone?: boolean;
  publish?: boolean;
  questions?: {
    type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
    options: string[];
    correctAnswer: number | number[];
  }[];
}

async function makeQuiz(spec: QuizSpec = {}) {
  seq += 1;
  const quizId = await quizzes.createQuiz(editor, {
    title: `Quiz ${seq}`,
    track: spec.track ?? "forex",
  });
  const questions = spec.questions ?? [
    { type: "SINGLE_CHOICE" as const, options: ["a", "b", "c"], correctAnswer: 1 },
    { type: "TRUE_FALSE" as const, options: ["True", "False"], correctAnswer: 0 },
  ];

  await quizzes.saveQuiz(editor, {
    quizId,
    meta: {
      passingScore: spec.passingScore ?? 50,
      maxAttempts: spec.maxAttempts ?? null,
      showAnswersAfter: spec.showAnswersAfter ?? "AFTER_SUBMIT",
      isStandalone: spec.isStandalone ?? true,
      category: null,
    },
    translation: { locale: "en", title: `Quiz ${seq}` },
    questions: questions.map((question, index) => ({
      type: question.type,
      sortOrder: index,
      points: 1,
      prompt: `Question ${index}`,
      options: question.options,
      explanations: question.options.map((_, o) => (o === 0 ? `Because ${o}` : "")),
      correctAnswer: question.correctAnswer,
    })),
  });

  if (spec.publish !== false) {
    await quizzes.setQuizStatus(editor, quizId, ContentStatus.IN_REVIEW);
    await quizzes.setQuizStatus(editor, quizId, ContentStatus.SEO_REVIEW);
    await quizzes.setQuizStatus(editor, quizId, ContentStatus.APPROVED);
    await quizzes.setQuizStatus(editor, quizId, ContentStatus.PUBLISHED);
  }

  const detail = await quizzes.getQuizAdmin(quizId, "en");
  return { quizId, questionIds: (detail?.questions ?? []).map((question) => question.id) };
}

/** A published course with one published lesson, optionally QUIZ_PASS. */
async function makeCourse(options?: { quizId?: string; completionRule?: "MANUAL" | "QUIZ_PASS" }) {
  seq += 1;
  const courseId = await courses.createCourse(editor, {
    track: "forex",
    title: `Quiz course ${seq}`,
  });
  const sectionId = await sections.createSection(editor, courseId, "Section");
  const lessonId = await lessons.createLesson(editor, { sectionId, title: `Lesson ${seq}` });
  await lessons.saveLesson(editor, {
    lessonId,
    meta: {
      ...(options?.completionRule ? { completionRule: options.completionRule } : {}),
      ...(options?.quizId !== undefined ? { quizId: options.quizId } : {}),
    },
    translation: { locale: "en", title: `Lesson ${seq}`, content: "<p>Body.</p>" },
    attachments: [],
  });

  await db.courseSection.update({ where: { id: sectionId }, data: { isPublished: true } });
  await db.course.update({
    where: { id: courseId },
    data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
  });
  await db.lesson.update({
    where: { id: lessonId },
    data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
  });
  await db.$transaction(async (tx) => {
    await courses.recomputeLessonCount(tx, courseId);
  });

  return { courseId, lessonId };
}

/** A second learner, for the tests that have to prove a read is scoped. */
async function makeLearner(): Promise<string> {
  seq += 1;
  const row = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `quiz-learner-${seq}@x.com`,
      name: `Learner ${seq}`,
      status: "ACTIVE",
      userType: "LEARNER",
    },
  });
  return row.id;
}

/** Answer every question correctly (or not) and submit. */
async function takeQuiz(quizId: string, questionIds: string[], answers: (number | number[])[]) {
  const attempt = await quizzes.startQuizAttempt(learner, quizId);
  for (const [index, questionId] of questionIds.entries()) {
    await quizzes.recordQuizAnswer(learner, attempt.id, questionId, answers[index]!);
  }
  return quizzes.submitQuizAttempt(learner, attempt.id, "en");
}

// ─── The correct answer never leaves (ADR-058 #2) ────────────

describe("the public quiz payload", () => {
  it("carries no correctAnswer key, in the serialized payload, for any question type", async () => {
    const { quizId } = await makeQuiz({
      questions: [
        { type: "SINGLE_CHOICE", options: ["a", "b"], correctAnswer: 1 },
        { type: "MULTIPLE_CHOICE", options: ["a", "b", "c"], correctAnswer: [0, 2] },
        { type: "TRUE_FALSE", options: ["True", "False"], correctAnswer: 0 },
      ],
    });
    const translation = await db.quizTranslation.findFirstOrThrow({ where: { quizId } });

    const view = await quizzes.loadQuizBySlug("en", translation.slug);
    expect(view).not.toBeNull();
    expect(view!.questions).toHaveLength(3);

    // Serialized, not shape-checked: a property added by a future refactor
    // would slip past `expect(view.questions[0].correctAnswer).toBeUndefined()`
    // if it were nested, and this catches it anywhere in the tree.
    const json = JSON.stringify(view);
    expect(json).not.toContain("correctAnswer");
    expect(json).not.toContain("explanations");
  });

  it("drops a question with fewer than two options rather than rendering it dead", async () => {
    const { quizId } = await makeQuiz();
    const translation = await db.quizTranslation.findFirstOrThrow({ where: { quizId } });
    const question = await db.quizQuestion.findFirstOrThrow({ where: { quizId } });
    await db.quizQuestionTranslation.updateMany({
      where: { questionId: question.id },
      data: { options: ["only one"] },
    });

    const view = await quizzes.loadQuizBySlug("en", translation.slug);
    expect(view!.questions.some((q) => q.id === question.id)).toBe(false);
  });

  it("lists standalone quizzes only, and never an empty one", async () => {
    const listed = await makeQuiz({ isStandalone: true });
    const attached = await makeQuiz({ isStandalone: false });
    const empty = await quizzes.createQuiz(editor, { title: "Empty", track: "forex" });
    await db.quiz.update({
      where: { id: empty },
      data: { status: ContentStatus.PUBLISHED, isStandalone: true, publishedAt: new Date() },
    });

    const cards = await quizzes.loadStandaloneQuizzes("en");
    const ids = cards.map((card) => card.id);
    expect(ids).toContain(listed.quizId);
    expect(ids).not.toContain(attached.quizId);
    // Published but with no questions: not takeable, so listing it would put a
    // dead card on the index.
    expect(ids).not.toContain(empty);
  });
});

// ─── Grading and scoring (ADR-058 #3) ────────────────────────

describe("grading", () => {
  it("treats MULTIPLE_CHOICE as set equality — a subset and a superset both score zero", () => {
    const correct = [0, 2];
    expect(quizzes.isAnswerCorrect("MULTIPLE_CHOICE", correct, [0, 2])).toBe(true);
    expect(quizzes.isAnswerCorrect("MULTIPLE_CHOICE", correct, [2, 0])).toBe(true);
    expect(quizzes.isAnswerCorrect("MULTIPLE_CHOICE", correct, [0])).toBe(false);
    expect(quizzes.isAnswerCorrect("MULTIPLE_CHOICE", correct, [0, 1, 2])).toBe(false);
  });

  it("scores from what the server recorded, and the submit call carries no score", async () => {
    const { quizId, questionIds } = await makeQuiz({ passingScore: 100 });
    const result = await takeQuiz(quizId, questionIds, [1, 0]);

    expect(result.score).toBe(2);
    expect(result.totalPoints).toBe(2);
    expect(result.percentage).toBe(100);
    expect(result.passed).toBe(true);

    const stored = await db.quizAttempt.findUniqueOrThrow({ where: { id: result.attemptId } });
    expect(stored.score).toBe(2);
    expect(stored.completedAt).not.toBeNull();
  });

  it("fails an attempt below the pass mark", async () => {
    const { quizId, questionIds } = await makeQuiz({ passingScore: 100 });
    const result = await takeQuiz(quizId, questionIds, [0, 0]);
    expect(result.score).toBe(1);
    expect(result.passed).toBe(false);
  });

  it("resumes the open attempt rather than starting a second one", async () => {
    const { quizId, questionIds } = await makeQuiz();
    const first = await quizzes.startQuizAttempt(learner, quizId);
    await quizzes.recordQuizAnswer(learner, first.id, questionIds[0]!, 1);
    const second = await quizzes.startQuizAttempt(learner, quizId);

    expect(second.id).toBe(first.id);
    // The answer already given comes back, so a refresh mid-quiz is not a
    // restart.
    expect(second.answers[questionIds[0]!]).toBe(1);
  });

  it("enforces maxAttempts server-side", async () => {
    const { quizId, questionIds } = await makeQuiz({ maxAttempts: 1 });
    await takeQuiz(quizId, questionIds, [1, 0]);
    await expect(quizzes.startQuizAttempt(learner, quizId)).rejects.toThrow(
      quizzes.AttemptLimitReachedError,
    );
  });

  it("refuses to record an answer against a submitted attempt", async () => {
    const { quizId, questionIds } = await makeQuiz();
    const attempt = await quizzes.startQuizAttempt(learner, quizId);
    await quizzes.submitQuizAttempt(learner, attempt.id, "en");
    await expect(quizzes.recordQuizAnswer(learner, attempt.id, questionIds[0]!, 1)).rejects.toThrow(
      quizzes.AttemptAlreadySubmittedError,
    );
  });

  it("scopes every attempt to its owner", async () => {
    const other = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `intruder-${seq}@x.com`,
        name: "Intruder",
        status: "ACTIVE",
        userType: "LEARNER",
      },
    });
    const { quizId, questionIds } = await makeQuiz();
    const attempt = await quizzes.startQuizAttempt(learner, quizId);

    // Not "denied" — it does not resolve, which is the same answer a
    // nonexistent id gets (security.md #7).
    await expect(
      quizzes.recordQuizAnswer(other.id, attempt.id, questionIds[0]!, 1),
    ).rejects.toThrow(quizzes.AttemptNotFoundError);
    await expect(quizzes.submitQuizAttempt(other.id, attempt.id, "en")).rejects.toThrow(
      quizzes.AttemptNotFoundError,
    );
  });

  it("refuses an unpublished quiz, indistinguishably from one that does not exist", async () => {
    const { quizId } = await makeQuiz({ publish: false });
    await expect(quizzes.startQuizAttempt(learner, quizId)).rejects.toThrow(
      quizzes.QuizNotAccessibleError,
    );
    await expect(quizzes.startQuizAttempt(learner, "no-such-quiz")).rejects.toThrow(
      quizzes.QuizNotAccessibleError,
    );
  });
});

// ─── showAnswersAfter (ADR-058 #4) ───────────────────────────

describe("answer visibility", () => {
  it("NEVER withholds per-answer correctness AND the review", async () => {
    const { quizId, questionIds } = await makeQuiz({ showAnswersAfter: "NEVER" });
    const attempt = await quizzes.startQuizAttempt(learner, quizId);

    const feedback = await quizzes.recordQuizAnswer(learner, attempt.id, questionIds[0]!, 1);
    // Recorded, not judged: a live right/wrong counter would make NEVER a lie.
    expect(feedback.correct).toBeNull();

    const result = await quizzes.submitQuizAttempt(learner, attempt.id, "en");
    expect(result.review).toBeNull();
    // And the score is still computed from the server's own grade.
    expect(result.score).toBe(1);
  });

  it("AFTER_PASS withholds the review from a failed attempt and returns it on a pass", async () => {
    const failing = await makeQuiz({ showAnswersAfter: "AFTER_PASS", passingScore: 100 });
    const failed = await takeQuiz(failing.quizId, failing.questionIds, [0, 0]);
    expect(failed.passed).toBe(false);
    expect(failed.review).toBeNull();

    const passing = await makeQuiz({ showAnswersAfter: "AFTER_PASS", passingScore: 50 });
    const passed = await takeQuiz(passing.quizId, passing.questionIds, [1, 0]);
    expect(passed.passed).toBe(true);
    expect(passed.review).not.toBeNull();
    expect(passed.review![0]!.correctAnswer).toBe(1);
  });

  it("AFTER_SUBMIT returns the review with the editor's explanations", async () => {
    const { quizId, questionIds } = await makeQuiz({ showAnswersAfter: "AFTER_SUBMIT" });
    const result = await takeQuiz(quizId, questionIds, [0, 0]);

    expect(result.review).not.toBeNull();
    const first = result.review![0]!;
    expect(first.correct).toBe(false);
    expect(first.given).toBe(0);
    expect(first.correctAnswer).toBe(1);
    expect(first.explanations[0]).toBe("Because 0");
  });

  it("getAttemptReview refuses an attempt still in progress", async () => {
    const { quizId } = await makeQuiz();
    const attempt = await quizzes.startQuizAttempt(learner, quizId);
    expect(await quizzes.getAttemptReview(learner, attempt.id, "en")).toBeNull();
  });
});

// ─── Completion (ADR-058 #6, ADR-056 #7) ─────────────────────

describe("passing a quiz", () => {
  it("completes a QUIZ_PASS lesson by writing the same row a manual completion writes", async () => {
    const quiz = await makeQuiz({ passingScore: 50 });
    const course = await makeCourse({ quizId: quiz.quizId, completionRule: "QUIZ_PASS" });

    const before = await progress.getCourseProgress(learner, course.courseId);
    expect(before.lessonsCompleted).toBe(0);

    await takeQuiz(quiz.quizId, quiz.questionIds, [1, 0]);

    const after = await progress.getCourseProgress(learner, course.courseId);
    expect(after.lessonsCompleted).toBe(1);
    expect(after.lessons.find((row) => row.lessonId === course.lessonId)?.state).toBe("completed");
    expect(after.isCompleted).toBe(true);

    // The SAME row, not a derived state: the counter and the curriculum agree
    // because there is one writer (ADR-058 #6).
    const row = await db.lessonProgress.findUniqueOrThrow({
      where: { userId_lessonId: { userId: learner, lessonId: course.lessonId } },
    });
    expect(row.status).toBe("COMPLETED");
  });

  it("does not complete a QUIZ_PASS lesson when the attempt failed", async () => {
    const quiz = await makeQuiz({ passingScore: 100 });
    const course = await makeCourse({ quizId: quiz.quizId, completionRule: "QUIZ_PASS" });

    await takeQuiz(quiz.quizId, quiz.questionIds, [0, 0]);

    const view = await progress.getCourseProgress(learner, course.courseId);
    expect(view.lessonsCompleted).toBe(0);
  });

  it("holds a course incomplete until its FINAL quiz is passed, then completes it", async () => {
    const quiz = await makeQuiz({ passingScore: 50 });
    const course = await makeCourse();
    await db.course.update({
      where: { id: course.courseId },
      data: { finalQuizId: quiz.quizId },
    });

    // Every lesson done, quiz unpassed → NOT complete. This is ADR-056 #7's
    // second conjunct, which was hardcoded `true` until Phase 6.
    await progress.markLessonComplete(learner, course.lessonId);
    const beforeQuiz = await progress.getCourseProgress(learner, course.courseId);
    expect(beforeQuiz.lessonsCompleted).toBe(1);
    expect(beforeQuiz.isCompleted).toBe(false);

    await takeQuiz(quiz.quizId, quiz.questionIds, [1, 0]);

    const afterQuiz = await progress.getCourseProgress(learner, course.courseId);
    expect(afterQuiz.isCompleted).toBe(true);
    // No lesson row was written for the final quiz — it has no lesson to hang
    // one on, which is exactly why it stays a live check.
    expect(afterQuiz.lessonsCompleted).toBe(1);
  });

  it("does not enrol a learner in a course just because they passed its final quiz", async () => {
    const quiz = await makeQuiz({ passingScore: 50 });
    const course = await makeCourse();
    await db.course.update({
      where: { id: course.courseId },
      data: { finalQuizId: quiz.quizId },
    });

    await takeQuiz(quiz.quizId, quiz.questionIds, [1, 0]);

    const enrollment = await db.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: learner, courseId: course.courseId } },
    });
    expect(enrollment).toBeNull();
  });

  it("does not let a QUIZ_PASS lesson whose quiz was deleted block the course", async () => {
    // ADR-058's named consequence. `Lesson.quizId` is SetNull, so deleting a
    // quiz leaves a lesson nothing can satisfy; counting it as required would
    // make the course impossible to finish because of an editor's delete.
    const quiz = await makeQuiz();
    const course = await makeCourse({ quizId: quiz.quizId, completionRule: "QUIZ_PASS" });

    // A second, ordinary required lesson — so the course has something that
    // CAN be completed. Without one there is nothing completable at all, and
    // "not complete" would be the right answer for a different reason
    // (`requiredTotal > 0`), which would make this test pass while proving
    // nothing.
    const section = await db.courseSection.findFirstOrThrow({
      where: { courseId: course.courseId },
    });
    const normal = await lessons.createLesson(editor, {
      sectionId: section.id,
      title: "Ordinary lesson",
    });
    await lessons.saveLesson(editor, {
      lessonId: normal,
      meta: {},
      translation: { locale: "en", title: "Ordinary lesson", content: "<p>Body.</p>" },
      attachments: [],
    });
    await db.lesson.update({
      where: { id: normal },
      data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
    });

    await db.quiz.delete({ where: { id: quiz.quizId } });
    const orphaned = await db.lesson.findUniqueOrThrow({ where: { id: course.lessonId } });
    expect(orphaned.quizId).toBeNull();

    await progress.markLessonComplete(learner, normal);

    const view = await progress.getCourseProgress(learner, course.courseId);
    // The orphaned lesson is still NOT completed — nothing wrote a row for it.
    expect(view.lessons.find((row) => row.lessonId === course.lessonId)).toBeUndefined();
    // And the course completes anyway, because an unsatisfiable lesson stops
    // blocking rather than sealing the course shut forever.
    expect(view.isCompleted).toBe(true);
  });
});

// ─── The learner's record (design pass 2026-09-09) ───────────
//
// What the quiz INDEX's per-card meters read. It is a summary and must stay
// one: counters keyed by quiz id, never content (ADR-056 #2).

describe("getQuizProgressForUser", () => {
  it("returns nothing for a learner who has finished nothing", async () => {
    const fresh = await makeLearner();
    expect(await quizzes.getQuizProgressForUser(fresh)).toEqual([]);
  });

  it("reports the BEST completed attempt, not the latest", async () => {
    const quiz = await makeQuiz({ passingScore: 50, maxAttempts: null });
    // 100%, then 50%. A "latest" reading would show the learner going
    // backwards for taking a second look at a quiz they had already aced.
    await takeQuiz(quiz.quizId, quiz.questionIds, [1, 0]);
    await takeQuiz(quiz.quizId, quiz.questionIds, [1, 1]);

    const row = (await quizzes.getQuizProgressForUser(learner)).find(
      (entry) => entry.quizId === quiz.quizId,
    );
    expect(row?.bestPercentage).toBe(100);
    expect(row?.attempts).toBe(2);
  });

  it("keeps `passed` once it is earned, even if a later attempt fails", async () => {
    const quiz = await makeQuiz({ passingScore: 100, maxAttempts: null });
    await takeQuiz(quiz.quizId, quiz.questionIds, [1, 0]); // 100% — a pass
    await takeQuiz(quiz.quizId, quiz.questionIds, [0, 1]); // 0%

    const row = (await quizzes.getQuizProgressForUser(learner)).find(
      (entry) => entry.quizId === quiz.quizId,
    );
    expect(row?.passed).toBe(true);
    expect(row?.bestPercentage).toBe(100);
  });

  it("ignores an attempt that was started and abandoned", async () => {
    // `percentage` defaults to 0 and stays there until submit. Counting an
    // open attempt would show "best 0%" to someone who opened a tab and left.
    const quiz = await makeQuiz();
    const abandoner = await makeLearner();
    await quizzes.startQuizAttempt(abandoner, quiz.quizId);

    expect(await quizzes.getQuizProgressForUser(abandoner)).toEqual([]);
  });

  it("is scoped to the caller — one learner never sees another's scores", async () => {
    const quiz = await makeQuiz();
    await takeQuiz(quiz.quizId, quiz.questionIds, [1, 0]);

    const stranger = await makeLearner();
    expect(await quizzes.getQuizProgressForUser(stranger)).toEqual([]);
  });

  it("carries counters and ids only — no title, slug or question ever", async () => {
    const quiz = await makeQuiz();
    await takeQuiz(quiz.quizId, quiz.questionIds, [1, 0]);

    const row = (await quizzes.getQuizProgressForUser(learner)).find(
      (entry) => entry.quizId === quiz.quizId,
    );
    expect(Object.keys(row ?? {}).sort()).toEqual([
      "attempts",
      "bestPercentage",
      "passed",
      "quizId",
    ]);
  });
});

// ─── Authoring (ADR-058 #8) ──────────────────────────────────

describe("authoring", () => {
  it("requires lessons.publish to publish, because quizzes reuse the lesson keys", async () => {
    const quizId = await quizzes.createQuiz(editor, { title: "Gated", track: "forex" });
    await quizzes.setQuizStatus(editor, quizId, ContentStatus.IN_REVIEW);
    await quizzes.setQuizStatus(editor, quizId, ContentStatus.SEO_REVIEW);
    await quizzes.setQuizStatus(editor, quizId, ContentStatus.APPROVED);

    // The assistant holds lessons.update but NOT lessons.publish. If the
    // permission map interpolated the entity name it would look for
    // `quizzes.publish`, which no role can hold, and EVERY publish would fail
    // — including the editor's.
    await expect(
      quizzes.setQuizStatus(assistant, quizId, ContentStatus.PUBLISHED),
    ).rejects.toThrow();
    await quizzes.setQuizStatus(editor, quizId, ContentStatus.PUBLISHED);

    const row = await db.quiz.findUniqueOrThrow({ where: { id: quizId } });
    expect(row.status).toBe("PUBLISHED");
  });

  it("replaces the whole question set, keeping ids for questions that stay", async () => {
    const { quizId, questionIds } = await makeQuiz();
    const keep = questionIds[0]!;

    await quizzes.saveQuiz(editor, {
      quizId,
      meta: {},
      translation: { locale: "en", title: `Quiz ${seq}` },
      questions: [
        {
          id: keep,
          type: "SINGLE_CHOICE",
          sortOrder: 0,
          points: 1,
          prompt: "Rewritten",
          options: ["a", "b", "c"],
          explanations: [],
          correctAnswer: 2,
        },
      ],
    });

    const detail = await quizzes.getQuizAdmin(quizId, "en");
    expect(detail!.questions).toHaveLength(1);
    expect(detail!.questions[0]!.id).toBe(keep);
    expect(detail!.questions[0]!.correctAnswer).toBe(2);
  });

  it("writes a 301 when the slug changes", async () => {
    const { quizId } = await makeQuiz();
    const original = await db.quizTranslation.findFirstOrThrow({ where: { quizId } });

    await quizzes.saveQuiz(editor, {
      quizId,
      meta: {},
      translation: { locale: "en", title: "Renamed", slug: "renamed-quiz" },
      questions: [],
    });

    const redirect = await db.redirect.findFirst({
      where: { fromPath: `/learn/forex/quizzes/${original.slug}` },
    });
    expect(redirect?.toPath).toBe("/learn/forex/quizzes/renamed-quiz");
  });

  // The track is the quiz URL's second segment (ADR-065 §3), so moving a quiz
  // between schools relocates it exactly as a rename does.
  it("writes a 301 when a quiz changes track", async () => {
    const { quizId } = await makeQuiz({ isStandalone: true, publish: true });
    const original = await db.quizTranslation.findFirstOrThrow({ where: { quizId } });

    await quizzes.saveQuiz(editor, {
      quizId,
      meta: { track: "crypto" },
      translation: { locale: "en", title: original.title, slug: original.slug },
      questions: [],
    });

    const redirect = await db.redirect.findFirst({
      where: { fromPath: `/learn/forex/quizzes/${original.slug}` },
    });
    expect(redirect?.toPath).toBe(`/learn/crypto/quizzes/${original.slug}`);
  });

  it("lists only the named track's quizzes in the index", async () => {
    const forex = await makeQuiz({ isStandalone: true, publish: true, track: "forex" });
    const crypto = await makeQuiz({ isStandalone: true, publish: true, track: "crypto" });

    const forexIds = (await quizzes.loadStandaloneQuizzes("en", "forex")).map((q) => q.id);
    expect(forexIds).toContain(forex.quizId);
    expect(forexIds).not.toContain(crypto.quizId);

    // No track named = every track, which is what the admin and the sitemap
    // want and what no public page asks for.
    const allIds = (await quizzes.loadStandaloneQuizzes("en")).map((q) => q.id);
    expect(allIds).toEqual(expect.arrayContaining([forex.quizId, crypto.quizId]));
  });

  it("keeps an attempt readable after its quiz is edited", async () => {
    // ADR-058's consequence: an attempt records the answers given, not the
    // questions asked. Rewriting a question does not invalidate past attempts.
    const { quizId, questionIds } = await makeQuiz();
    const result = await takeQuiz(quizId, questionIds, [1, 0]);

    await quizzes.saveQuiz(editor, {
      quizId,
      meta: {},
      translation: { locale: "en", title: "Edited" },
      questions: [
        {
          id: questionIds[0]!,
          type: "SINGLE_CHOICE",
          sortOrder: 0,
          points: 1,
          prompt: "Completely different now",
          options: ["x", "y"],
          explanations: [],
          correctAnswer: 0,
        },
      ],
    });

    const attempt = await db.quizAttempt.findUniqueOrThrow({ where: { id: result.attemptId } });
    expect(attempt.passed).toBe(true);
    expect(attempt.score).toBe(2);
  });
});
