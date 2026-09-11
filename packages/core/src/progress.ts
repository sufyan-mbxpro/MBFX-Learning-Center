// Learner progress (changes-11 Phase 5, ADR-056).
//
// Three rules govern this file, and all three are structural rather than
// conventional:
//
//   1. NOTHING HERE IS CACHED, and nothing here is called during the render of
//      a public page. `public-courses.ts` is the cached half of the learning
//      area and reads no session; this is the uncached half and reads nothing
//      else. Adding `"use cache"` to a function below would put one learner's
//      progress in a payload shared with every other reader (security.md #12).
//
//   2. THE CALLER NEVER SUPPLIES A USER ID FROM THE WIRE. Every function takes
//      `userId` as its first argument and the route handler fills it from the
//      session it just read. There is no `userId` field in `progressWriteSchema`
//      for exactly this reason.
//
//   3. A LESSON IS RESOLVED THROUGH THE PUBLIC VISIBILITY RULE, always. A
//      learner cannot record progress against a draft, a soft-deleted lesson,
//      an unpublished section or a gated course — `locateLesson()` is the only
//      way into a write, and it applies `publicLessonWhere()` +
//      `publicCourseWhere()`. Otherwise "mark complete" would be an oracle for
//      the existence of unpublished content (security.md #7).
//
// The denormalised counter is the one genuinely delicate thing here; see
// `withEnrollmentLock` for why it cannot drift.
import type { CourseProgressView, EnrollmentSummary, LessonProgressView } from "@repo/contracts";
import { LessonProgressStatus, db, type Prisma } from "@repo/db";
import { publicCourseWhere, publicLessonWhere } from "./public-courses.ts";

// ─── Errors ──────────────────────────────────────────────────

/**
 * Raised for a lesson that does not exist AND for one the public rule hides.
 * The two are deliberately indistinguishable: telling a caller "this exists
 * but you may not touch it" is the disclosure security.md #7 forbids. The
 * route turns this into a 404, never a 403.
 */
export class LessonNotAccessibleError extends Error {
  constructor() {
    super("No such lesson, or it is not publicly visible");
    this.name = "LessonNotAccessibleError";
  }
}

/** Same reasoning, one level up. */
export class CourseNotAccessibleError extends Error {
  constructor() {
    super("No such course, or it is not publicly visible");
    this.name = "CourseNotAccessibleError";
  }
}

// ─── Resolution ──────────────────────────────────────────────

interface LessonLocation {
  lessonId: string;
  courseId: string;
}

/**
 * The lesson, its course, and the proof that a member of the public may read
 * it — in one query, because the three are one question.
 *
 * `courseId` comes back so the caller can denormalise it onto `LessonProgress`
 * inside the same transaction that resolved it (ADR-056 #2). That is what
 * makes the duplicated column safe: it is never written from a second source.
 */
async function locateLesson(lessonId: string): Promise<LessonLocation | null> {
  const row = await db.lesson.findFirst({
    where: {
      id: lessonId,
      ...publicLessonWhere(),
      section: { isPublished: true, course: publicCourseWhere() },
    },
    select: { id: true, section: { select: { courseId: true } } },
  });
  return row ? { lessonId: row.id, courseId: row.section.courseId } : null;
}

async function requireLesson(lessonId: string): Promise<LessonLocation> {
  const location = await locateLesson(lessonId);
  if (!location) throw new LessonNotAccessibleError();
  return location;
}

async function requirePublicCourse(courseId: string): Promise<{ lessonCount: number }> {
  const course = await db.course.findFirst({
    where: { id: courseId, ...publicCourseWhere() },
    select: { lessonCount: true },
  });
  if (!course) throw new CourseNotAccessibleError();
  return course;
}

// ─── Enrollment and the counter ──────────────────────────────

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

/**
 * Create the enrollment row if the learner has none.
 *
 * Outside the transaction on purpose: `withEnrollmentLock` locks a row that
 * must already exist, and doing the create inside the locked section would
 * mean locking a row that isn't there yet. Two first-ever writes from the same
 * learner can race here; the unique constraint decides, and the loser simply
 * proceeds — the row it wanted exists.
 */
async function ensureEnrollment(userId: string, courseId: string): Promise<void> {
  try {
    await db.courseEnrollment.create({ data: { userId, courseId } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
}

/**
 * Run `work` with an exclusive lock on this learner's enrollment row.
 *
 * **This is the answer to the one bug ADR-056 predicts** — a `lessonsCompleted`
 * counter that drifts under concurrency. Two parallel completions would each
 * count "how many lessons has this learner finished", each see one, and each
 * write 1, leaving a counter of 1 where the answer is 2. The same read-then-
 * write hazard makes `completedAt` miss the moment a course finishes, because
 * neither transaction sees the other's last required lesson.
 *
 * Two mechanisms together fix it, and both are load-bearing:
 *
 *   • The `update` below takes an exclusive row lock on `course_enrollments`
 *     for the rest of the transaction, so every write for one (learner, course)
 *     serialises here rather than interleaving.
 *   • `ReadCommitted` isolation makes each read inside the transaction take a
 *     fresh snapshot. Under MariaDB's default REPEATABLE READ, the count after
 *     the lock could still be served from a snapshot taken before the blocking
 *     transaction committed — the lock would serialise the writes and the
 *     counter would drift anyway. Locking without this is a subtly broken fix.
 *
 * Writing `lastActiveAt` explicitly rather than relying on `@updatedAt` keeps
 * the lock statement honest about being a write.
 */
async function withEnrollmentLock<T>(
  userId: string,
  courseId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  await ensureEnrollment(userId, courseId);
  return db.$transaction(
    async (tx) => {
      await tx.courseEnrollment.update({
        where: { userId_courseId: { userId, courseId } },
        data: { lastActiveAt: new Date() },
      });
      return work(tx);
    },
    { isolationLevel: "ReadCommitted" },
  );
}

/**
 * Recompute the denormalised counter and the completion timestamp from the
 * `LessonProgress` rows, which are the source of truth.
 *
 * Recomputed rather than incremented, deliberately: an increment is only
 * correct if every write path remembers to do it exactly once, and a
 * re-completion, a soft delete or a lesson unpublishing all break that. A
 * recount inside the lock is correct by construction.
 *
 * **Shaped for D18 from day one** (ADR-056 #7). Course completion reads:
 *
 *     every published required lesson complete
 *     AND (finalQuizId is null OR that quiz has a passed attempt)
 *
 * Phase 6 (ADR-058 #6) filled the second clause in. It cost exactly what
 * ADR-056 #7 predicted: one query beside the three that were already here, and
 * one more conjunct — no rewrite of completion, and no second place that
 * decides whether a course is finished.
 *
 * Exported because it is the shared tail of every write path and because
 * Phase 6 calls it when an attempt passes — a quiz result changes course
 * completion without touching a single `LessonProgress` row.
 */
export async function recomputeCourseCompletion(
  tx: Prisma.TransactionClient,
  userId: string,
  courseId: string,
): Promise<void> {
  const publishedLesson = {
    ...publicLessonWhere(),
    section: { isPublished: true, courseId },
  };

  /**
   * Which lessons can BLOCK completion.
   *
   * Required ones, minus the ADR-058 consequence: a `QUIZ_PASS` lesson whose
   * quiz has been deleted (`Lesson.quizId` is `SetNull`) is unsatisfiable —
   * there is nothing left to pass. Counting it would leave the course
   * impossible to finish because of an editor's delete, so it stops blocking.
   * It still counts toward `lessonsCompleted` if the learner completed it
   * before the quiz went.
   */
  const blockingLesson = {
    isRequired: true,
    NOT: { completionRule: "QUIZ_PASS" as const, quizId: null },
  };

  const [lessonsCompleted, requiredTotal, requiredOutstanding, enrollment, course] =
    await Promise.all([
      // Every completed lesson, required or not: this is the numerator the
      // learner sees against `Course.lessonCount`, so it must count what that
      // denominator counts.
      tx.lessonProgress.count({
        where: {
          userId,
          courseId,
          status: LessonProgressStatus.COMPLETED,
          lesson: publishedLesson,
        },
      }),
      tx.lesson.count({ where: { ...publishedLesson, ...blockingLesson } }),
      tx.lesson.count({
        where: {
          ...publishedLesson,
          ...blockingLesson,
          // "No completed row for this learner" — expressed as the absence of a
          // relation rather than as (total − completed), which would silently
          // count a completion whose lesson has since been unpublished.
          progress: { none: { userId, status: LessonProgressStatus.COMPLETED } },
        },
      }),
      tx.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { completedAt: true },
      }),
      tx.course.findUnique({ where: { id: courseId }, select: { finalQuizId: true } }),
    ]);

  // ADR-056 #7's second clause: "finalQuizId is null OR that quiz has a passed
  // attempt". Read here rather than mirrored into a LessonProgress row because
  // a final quiz has no lesson to hang one on — which is exactly why ADR-058 #6
  // treats it as the exception to "passing writes a row".
  const finalQuizPassed =
    course?.finalQuizId == null ||
    (await tx.quizAttempt.findFirst({
      where: { userId, quizId: course.finalQuizId, passed: true },
      select: { id: true },
    })) !== null;

  // A course with no required lessons is not "complete" — it is empty. Saying
  // otherwise would congratulate a learner for opening a course that has
  // nothing published in it yet.
  const isCompleted = requiredTotal > 0 && requiredOutstanding === 0 && finalQuizPassed;

  await tx.courseEnrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: {
      lessonsCompleted,
      // Keep the ORIGINAL completion date once set: publishing a new lesson
      // then completing it must not restamp a course finished last March.
      // Falling out of completion (a new required lesson lands) clears it, and
      // that is correct — the course genuinely is not finished any more.
      completedAt: isCompleted ? (enrollment?.completedAt ?? new Date()) : null,
    },
  });
}

// ─── Reads ───────────────────────────────────────────────────

function percentOf(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

/**
 * One learner's state in one course.
 *
 * The course is re-checked against the public rule so an unpublished course
 * 404s for its own enrolled learners too — otherwise progress would be a side
 * channel that says "this course still exists, it is just hidden from you".
 */
export async function getCourseProgress(
  userId: string,
  courseId: string,
): Promise<CourseProgressView> {
  const course = await requirePublicCourse(courseId);

  const [enrollment, rows] = await Promise.all([
    db.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { lessonsCompleted: true, completedAt: true, lastLessonId: true },
    }),
    db.lessonProgress.findMany({
      where: {
        userId,
        courseId,
        // A row for a lesson that has since been unpublished is kept in the
        // database (ADR-056 #6 — nothing un-completes a learner) but is not
        // reported, because the page it would mark is not on screen.
        lesson: { ...publicLessonWhere(), section: { isPublished: true } },
      },
      select: { lessonId: true, status: true, completedAt: true },
    }),
  ]);

  const lessons: LessonProgressView[] = rows.map((row) => ({
    lessonId: row.lessonId,
    state: row.status === LessonProgressStatus.COMPLETED ? "completed" : "in-progress",
    completedAt: row.completedAt?.toISOString() ?? null,
  }));

  const lessonsCompleted = enrollment?.lessonsCompleted ?? 0;
  return {
    courseId,
    lessonsCompleted,
    lessonsTotal: course.lessonCount,
    percent: percentOf(lessonsCompleted, course.lessonCount),
    isCompleted: enrollment?.completedAt !== null && enrollment?.completedAt !== undefined,
    completedAt: enrollment?.completedAt?.toISOString() ?? null,
    lastLessonId: enrollment?.lastLessonId ?? null,
    lessons,
  };
}

/**
 * Every course this learner has started, newest activity first.
 *
 * Scoped to publicly-visible courses for the same reason `getCourseProgress`
 * is, and it carries counters only — the shelf that renders it already holds
 * every title, slug and cover in its cached payload.
 */
export async function getLearnerDashboard(userId: string): Promise<EnrollmentSummary[]> {
  const rows = await db.courseEnrollment.findMany({
    where: { userId, course: publicCourseWhere() },
    orderBy: { lastActiveAt: "desc" },
    select: {
      courseId: true,
      lessonsCompleted: true,
      completedAt: true,
      lastLessonId: true,
      lastActiveAt: true,
      course: { select: { lessonCount: true } },
    },
  });

  return rows.map((row) => ({
    courseId: row.courseId,
    lessonsCompleted: row.lessonsCompleted,
    lessonsTotal: row.course.lessonCount,
    percent: percentOf(row.lessonsCompleted, row.course.lessonCount),
    isCompleted: row.completedAt !== null,
    lastLessonId: row.lastLessonId,
    lastActiveAt: row.lastActiveAt.toISOString(),
  }));
}

// ─── Writes ──────────────────────────────────────────────────

/**
 * The learner pressed "Mark complete" (ADR-056 #5 — completion is explicit).
 *
 * Idempotent by the `@@unique([userId, lessonId])` constraint: pressing it
 * twice writes one row and leaves the counter at one. The returned view comes
 * from the same call the page would make, so the island renders authoritative
 * server state rather than its own optimistic guess.
 */
export async function markLessonComplete(
  userId: string,
  lessonId: string,
): Promise<CourseProgressView> {
  const { courseId } = await requireLesson(lessonId);

  await withEnrollmentLock(userId, courseId, async (tx) => {
    const completedAt = new Date();
    await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        courseId,
        status: LessonProgressStatus.COMPLETED,
        completedAt,
      },
      // Re-completing keeps the FIRST completion date — "when did this learner
      // finish this" should not move because they reread the lesson.
      update: { status: LessonProgressStatus.COMPLETED, completedAt },
    });
    await tx.courseEnrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data: { lastLessonId: lessonId },
    });
    await recomputeCourseCompletion(tx, userId, courseId);
  });

  return getCourseProgress(userId, courseId);
}

/**
 * Undo a completion. The row is downgraded to IN_PROGRESS rather than deleted:
 * the learner HAS opened the lesson, and deleting the row would claim
 * otherwise the moment the page reloads.
 */
export async function markLessonIncomplete(
  userId: string,
  lessonId: string,
): Promise<CourseProgressView> {
  const { courseId } = await requireLesson(lessonId);

  await withEnrollmentLock(userId, courseId, async (tx) => {
    await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, courseId, status: LessonProgressStatus.IN_PROGRESS },
      update: { status: LessonProgressStatus.IN_PROGRESS, completedAt: null },
    });
    await recomputeCourseCompletion(tx, userId, courseId);
  });

  return getCourseProgress(userId, courseId);
}

/**
 * The learner opened a lesson: record IN_PROGRESS and move "Continue learning"
 * here.
 *
 * **It never downgrades a completed lesson.** The `update` is empty on purpose
 * — arriving on a finished lesson is a visit, not an un-completion, and an
 * upsert that wrote IN_PROGRESS here would quietly reverse the learner's own
 * action every time they reread something.
 *
 * Returns the whole view rather than `void` (the shape the plan sketched) so
 * the lesson page's island gets its state from the same request that announces
 * the visit, instead of a POST followed immediately by a GET.
 */
export async function touchLesson(userId: string, lessonId: string): Promise<CourseProgressView> {
  const { courseId } = await requireLesson(lessonId);

  await withEnrollmentLock(userId, courseId, async (tx) => {
    await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, courseId, status: LessonProgressStatus.IN_PROGRESS },
      update: {},
    });
    await tx.courseEnrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data: { lastLessonId: lessonId },
    });
    // Cheap, and it is the self-healing path: a counter that drifted for any
    // reason is corrected the next time the learner opens a lesson.
    await recomputeCourseCompletion(tx, userId, courseId);
  });

  return getCourseProgress(userId, courseId);
}
