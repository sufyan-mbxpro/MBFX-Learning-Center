// A quiz as something ELSE points at it (ADR-084 #1).
//
// **Why this is its own module.** The public rule for a quiz is needed in
// three places that cannot all import each other: `quizzes.ts` (the runner and
// the index), `public-courses.ts` (a course's final assessment and a
// `QUIZ_PASS` lesson's quiz), and `progress.ts` (whether an unreachable final
// quiz may block completion). `quizzes.ts` already imports
// `public-courses.ts` for `publicLessonWhere`, so the obvious import —
// `public-courses.ts` reaching into `quizzes.ts` — would close a cycle, and
// `import-x/no-cycle` is lint-enforced (architecture.md #8). A leaf that all
// three can import is the shape that has no cycle in it.
//
// It holds no admin reads, no writes and no attempt logic. Everything here
// answers one question: *is there a reachable quiz at this id, and what does a
// card need to say about it?*
import { FeatureVisibility, db, type Prisma } from "@repo/db";
import { pickTranslation, type LocaleFallbackInfo } from "@repo/i18n";
import { isLearnTrack, type QuizLinkView } from "@repo/contracts";
import { scheduledVisibilityOr } from "./content.ts";

/**
 * The public rule, identical in shape to `publicCourseWhere()`.
 *
 * Moved here from `quizzes.ts` by ADR-084 #1 — verbatim, because a second
 * copy of a visibility rule is how two surfaces come to disagree about what
 * is published.
 */
export function publicQuizWhere(now: Date = new Date()) {
  return {
    deletedAt: null,
    OR: scheduledVisibilityOr(now),
    visibility: FeatureVisibility.PUBLIC,
  };
}

/**
 * Resolve quiz ids to the cards a page may render, in one query.
 *
 * A row is DROPPED — the id simply has no entry in the map — when any of four
 * things is true, and they are the same four `loadStandaloneQuizzes` applies:
 *
 *   • it fails `publicQuizWhere()` (draft, scheduled-for-later, soft-deleted,
 *     or not PUBLIC visibility);
 *   • it has no questions, which makes it unanswerable rather than merely
 *     empty;
 *   • it has no usable translation for this locale or its fallbacks;
 *   • its `track` is not a registered `LEARN_TRACKS` key, so no URL can be
 *     built for it.
 *
 * Dropping rather than returning a partial view is the point: a caller gets
 * either a quiz it can link to honestly or nothing, and "nothing" is what
 * makes the course page's assessment card absent instead of broken.
 *
 * The locale context is passed IN rather than read here — every caller
 * already holds one (`loadCourseBySlug`, `loadLessonBySlug`), and a loader
 * that fetched its own would add a query per page for an answer it was handed.
 */
export async function loadQuizLinks(
  ids: (string | null | undefined)[],
  locale: string,
  defaultLocale: string,
  locales: LocaleFallbackInfo[],
): Promise<Map<string, QuizLinkView>> {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string"))];
  if (unique.length === 0) return new Map();

  const rows = await db.quiz.findMany({
    where: { id: { in: unique }, ...publicQuizWhere() },
    select: {
      id: true,
      track: true,
      passingScore: true,
      maxAttempts: true,
      translations: { select: { locale: true, title: true, slug: true } },
      _count: { select: { questions: true } },
    },
  });

  const map = new Map<string, QuizLinkView>();
  for (const row of rows) {
    if (row._count.questions === 0) continue;
    if (!isLearnTrack(row.track)) continue;
    const t = pickTranslation(row.translations, locale, defaultLocale, locales);
    if (!t) continue;
    map.set(row.id, {
      id: row.id,
      slug: t.slug,
      track: row.track,
      title: t.title,
      questionCount: row._count.questions,
      passingScore: row.passingScore,
      maxAttempts: row.maxAttempts,
    });
  }
  return map;
}

/**
 * Can a member of the public reach this quiz at all?
 *
 * The completion rule's question (ADR-084 #8). Deliberately the SAME two
 * conditions `loadQuizLinks` applies — publicly visible, and has questions —
 * minus the translation and track checks, which decide whether a URL can be
 * built rather than whether the quiz exists. A learner who passed it before
 * its last translation was deleted has still passed it.
 *
 * Takes the transaction client because its one caller runs inside the
 * enrollment lock, and a read outside that transaction could answer from
 * before a concurrent publish.
 */
export async function isQuizReachable(
  tx: Prisma.TransactionClient,
  quizId: string,
): Promise<boolean> {
  const row = await tx.quiz.findFirst({
    where: { id: quizId, ...publicQuizWhere() },
    select: { _count: { select: { questions: true } } },
  });
  return row !== null && row._count.questions > 0;
}
