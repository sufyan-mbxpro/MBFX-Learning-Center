// "Was this lesson helpful?" (changes-11 PR 5.5, ADR-056 #8).
//
// One row per vote rather than a counter pair on `Lesson`, because the useful
// question is not "what is the ratio now" but "which lessons got worse after
// the rewrite" — and only rows carry the dates that answer it.
//
// Two rules, both inherited from `progress.ts`:
//
//   • The lesson is resolved through the PUBLIC visibility rule, so a vote
//     cannot confirm that an unpublished lesson exists (security.md #7).
//   • The caller never supplies a user id. `lessonFeedbackSchema` has no such
//     field; the route fills it from the session, or passes null.
import { db } from "@repo/db";
import { publicCourseWhere, publicLessonWhere } from "./public-courses.ts";

export class LessonFeedbackNotAccessibleError extends Error {
  constructor() {
    super("No such lesson, or it is not publicly visible");
    this.name = "LessonFeedbackNotAccessibleError";
  }
}

/**
 * Record one vote.
 *
 * **Signed in** — upsert on `@@unique([lessonId, userId])`: changing your mind
 * updates the row you already have, so one learner is one vote no matter how
 * many times they press.
 *
 * **Anonymous** — plain insert. MariaDB treats NULLs as distinct in a unique
 * index, so anonymous rows accumulate rather than colliding, which is the
 * intended behaviour (ADR-056 #8). What bounds them is the endpoint's per-IP
 * rate limit; what stops one browser voting twice by accident is
 * `localStorage`, and that is UX, not security — an anonymous vote is
 * inherently unauthenticated and this code does not pretend otherwise.
 */
export async function recordLessonFeedback(input: {
  lessonId: string;
  userId: string | null;
  helpful: boolean;
}): Promise<void> {
  const lesson = await db.lesson.findFirst({
    where: {
      id: input.lessonId,
      ...publicLessonWhere(),
      section: { isPublished: true, course: publicCourseWhere() },
    },
    select: { id: true },
  });
  if (!lesson) throw new LessonFeedbackNotAccessibleError();

  if (input.userId === null) {
    await db.lessonFeedback.create({
      data: { lessonId: input.lessonId, userId: null, helpful: input.helpful },
    });
    return;
  }

  await db.lessonFeedback.upsert({
    where: { lessonId_userId: { lessonId: input.lessonId, userId: input.userId } },
    create: { lessonId: input.lessonId, userId: input.userId, helpful: input.helpful },
    update: { helpful: input.helpful },
  });
}

export interface LessonFeedbackTally {
  lessonId: string;
  helpful: number;
  notHelpful: number;
}

/**
 * The editorial rollup, served by `@@index([lessonId, helpful])`.
 *
 * Not called by any public page: the counts are an editor's signal, not a
 * social proof widget, and showing "3 of 47 found this helpful" under a lesson
 * would tell a learner to skip it. Phase 9's `/admin/learn/progress` is the
 * consumer; it is written here because the table it reads is created here and
 * a rollup that lives with its model does not get reinvented as a raw query.
 */
export async function tallyLessonFeedback(lessonIds: string[]): Promise<LessonFeedbackTally[]> {
  if (lessonIds.length === 0) return [];
  const rows = await db.lessonFeedback.groupBy({
    by: ["lessonId", "helpful"],
    where: { lessonId: { in: lessonIds } },
    _count: { _all: true },
  });

  const tallies = new Map<string, LessonFeedbackTally>();
  for (const lessonId of lessonIds) {
    tallies.set(lessonId, { lessonId, helpful: 0, notHelpful: 0 });
  }
  for (const row of rows) {
    const tally = tallies.get(row.lessonId);
    if (!tally) continue;
    if (row.helpful) tally.helpful = row._count._all;
    else tally.notHelpful = row._count._all;
  }
  return [...tallies.values()];
}
