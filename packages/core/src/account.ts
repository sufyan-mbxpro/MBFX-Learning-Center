// The learner profile page (ADR-123): one read that assembles the page, the
// read-tracking write behind the article beacon, and the avatar.
//
// Three rules, the same three `progress.ts` states for the same reasons:
//
//   1. NOTHING HERE IS CACHED. Every function below is one learner's data, and
//      a `"use cache"` on any of them would put it in a payload shared with the
//      next reader (security.md #12). The pages that call `loadLearnerProfile` and
//      `loadLearnerActivity` read the session themselves and render per request.
//
//   2. THE CALLER NEVER SUPPLIES THE USER ID FROM THE WIRE. `userId` is the
//      first argument everywhere and the route or action fills it from
//      `auth()`. No schema in `@repo/contracts/account.ts` has a field for one.
//
//   3. CONTENT IS RESOLVED THROUGH ITS PUBLIC RULE. A course that has been
//      unpublished, a quiz moved back to draft, an article deactivated — each
//      disappears from the profile exactly as it disappears from the site. The
//      history rows stay (nothing here deletes a learner's record), they are
//      just not reported, and a beacon for an unpublished article is refused
//      rather than recorded (it would otherwise be an oracle for the id).
import {
  ACCOUNT_RECENT_COURSES,
  ACCOUNT_RECENT_LESSON_READS,
  ACCOUNT_RECENT_QUIZ_ATTEMPTS,
  ACCOUNT_RECENT_READS,
  AVATAR_MAX_BYTES,
  pickResumeLesson,
  type AccountCourseView,
  type AccountLessonReadView,
  type AccountQuizAttemptView,
  type AccountReadView,
  type AccountProfileView,
  type LearnerActivityView,
  type LearnerProgressSummary,
} from "@repo/contracts";
import { LessonProgressStatus, db } from "@repo/db";
import { pickTranslation, type LocaleFallbackInfo } from "@repo/i18n";
import { recordAudit } from "./index.ts";
import {
  getMediaUrls,
  isUnsafeSvg,
  sniffImageType,
  storeImage,
  UploadRejectedError,
  type SniffedImage,
} from "./media.ts";
import { publicArticleWhere } from "./public-articles.ts";
import { publicCourseWhere, publicLessonWhere } from "./public-courses.ts";
import { loadQuizLinks, publicQuizWhere } from "./quiz-links.ts";

// ─── Errors ──────────────────────────────────────────────────

/**
 * A missing article and a hidden one are the same answer (security.md #7):
 * the beacon route turns this into a 404 either way.
 */
export class ArticleNotReadableError extends Error {
  constructor() {
    super("No such article, or it is not publicly visible");
    this.name = "ArticleNotReadableError";
  }
}

// ─── Read tracking ───────────────────────────────────────────

/**
 * Record that this learner opened this article, or move an earlier record's
 * `readAt` forward. One row per pair — a last-read marker, not a page-view log.
 *
 * Not audited: reading is not a change to anything anyone else can see, and an
 * audit row per article view would bury the rows the audit log exists for.
 */
export async function recordArticleRead(userId: string, articleId: string): Promise<void> {
  const article = await db.article.findFirst({
    where: { id: articleId, ...publicArticleWhere(new Date()) },
    select: { id: true },
  });
  if (!article) throw new ArticleNotReadableError();

  const readAt = new Date();
  try {
    await db.articleRead.upsert({
      where: { userId_articleId: { userId, articleId } },
      create: { userId, articleId, readAt },
      update: { readAt },
    });
  } catch (error) {
    // Two tabs firing the beacon at once can both miss the row and both try
    // to create it. Prisma's upsert is not atomic, so the loser sees the
    // unique constraint — and the row it wanted now exists, so move it.
    if ((error as { code?: string }).code !== "P2002") throw error;
    await db.articleRead.update({
      where: { userId_articleId: { userId, articleId } },
      data: { readAt },
    });
  }
}

// ─── The page read ───────────────────────────────────────────

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

/**
 * The learner's own profile and security state, for `/account` (ADR-125).
 * Null for a user that does not exist or has been soft-deleted.
 */
export async function loadLearnerProfile(userId: string): Promise<AccountProfileView | null> {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      firstName: true,
      lastName: true,
      phone: true,
      image: true,
      twoFactorEnabled: true,
      createdAt: true,
      accounts: { where: { providerId: "credential" }, select: { id: true }, take: 1 },
    },
  });
  if (!user) return null;
  return {
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    image: user.image,
    twoFactorEnabled: user.twoFactorEnabled === true,
    hasPassword: user.accounts.length > 0,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * One learner's courses, quiz attempts and reading, in the reader's locale,
 * for `/account/progress` (ADR-125). Empty lists for a learner with no history.
 *
 * Hrefs are locale-less (`/learn/forex/basics`), like the search API's: the
 * page renders them through `@repo/i18n`'s `Link`, which adds the prefix.
 */
export async function loadLearnerActivity(
  userId: string,
  locale: string,
): Promise<LearnerActivityView> {
  const ctx = await localeContext();
  const [courses, quizAttempts, reads, lessonReads, summary] = await Promise.all([
    loadCourses(userId, locale, ctx),
    loadQuizAttempts(userId, locale, ctx),
    loadReads(userId, locale, ctx),
    loadLessonReads(userId, locale, ctx),
    loadSummary(userId),
  ]);
  return { courses, quizAttempts, reads, lessonReads, summary };
}

/**
 * The summary row's totals (changes-42). Each count takes the same public rule
 * as the list it summarises, so the two cannot disagree about what exists.
 */
async function loadSummary(userId: string): Promise<LearnerProgressSummary> {
  const now = new Date();
  const [
    coursesStarted,
    coursesCompleted,
    lessonsCompleted,
    passedQuizzes,
    quizAttempts,
    articlesRead,
  ] = await Promise.all([
    db.courseEnrollment.count({ where: { userId, course: publicCourseWhere(now) } }),
    db.courseEnrollment.count({
      where: { userId, completedAt: { not: null }, course: publicCourseWhere(now) },
    }),
    db.lessonProgress.count({
      where: {
        userId,
        status: LessonProgressStatus.COMPLETED,
        lesson: {
          ...publicLessonWhere(now),
          section: { isPublished: true, course: publicCourseWhere(now) },
        },
      },
    }),
    db.quizAttempt.findMany({
      where: { userId, passed: true, completedAt: { not: null }, quiz: publicQuizWhere() },
      distinct: ["quizId"],
      select: { quizId: true },
    }),
    db.quizAttempt.count({
      where: { userId, completedAt: { not: null }, quiz: publicQuizWhere() },
    }),
    db.articleRead.count({ where: { userId, article: publicArticleWhere(now) } }),
  ]);
  return {
    coursesStarted,
    coursesCompleted,
    lessonsCompleted,
    quizzesPassed: passedQuizzes.length,
    quizAttempts,
    articlesRead,
  };
}

async function loadCourses(
  userId: string,
  locale: string,
  ctx: LocaleContext,
): Promise<AccountCourseView[]> {
  const now = new Date();
  const enrollments = await db.courseEnrollment.findMany({
    where: { userId, course: publicCourseWhere(now) },
    orderBy: { lastActiveAt: "desc" },
    take: ACCOUNT_RECENT_COURSES,
    select: {
      courseId: true,
      lessonsCompleted: true,
      completedAt: true,
      lastLessonId: true,
      lastActiveAt: true,
      course: {
        select: {
          track: true,
          lessonCount: true,
          coverAssetId: true,
          finalQuizId: true,
          translations: { select: { locale: true, slug: true, title: true } },
        },
      },
    },
  });
  if (enrollments.length === 0) return [];

  const courseIds = enrollments.map((row) => row.courseId);
  const finalQuizIds = [
    ...new Set(
      enrollments.flatMap((row) => (row.course.finalQuizId ? [row.course.finalQuizId] : [])),
    ),
  ];
  // Two queries for all the courses together, not two per course: the lessons
  // a reader can reach (the curriculum's own rule — `publicLessonWhere` AND a
  // published section, ADR-081 #2) and the ones this learner has completed.
  //
  // The final quizzes resolve through `loadQuizLinks`, the course page's own
  // resolver (ADR-084 #1), so a quiz the course page does not show is not
  // reported here either; the learner's attempts on them come in one query.
  const [lessons, completed, coverUrls, quizLinks, finalAttempts] = await Promise.all([
    db.lesson.findMany({
      where: {
        ...publicLessonWhere(now),
        section: { courseId: { in: courseIds }, isPublished: true },
      },
      select: {
        id: true,
        sortOrder: true,
        section: { select: { courseId: true, sortOrder: true } },
        translations: { select: { locale: true, slug: true, title: true } },
      },
    }),
    db.lessonProgress.findMany({
      where: { userId, courseId: { in: courseIds }, status: LessonProgressStatus.COMPLETED },
      select: { lessonId: true },
    }),
    getMediaUrls(
      enrollments.flatMap((row) => (row.course.coverAssetId ? [row.course.coverAssetId] : [])),
    ),
    loadQuizLinks(finalQuizIds, locale, ctx.defaultLocale, ctx.locales),
    finalQuizIds.length === 0
      ? Promise.resolve([])
      : db.quizAttempt.findMany({
          where: { userId, quizId: { in: finalQuizIds }, completedAt: { not: null } },
          select: { quizId: true, percentage: true, passed: true },
        }),
  ]);

  const standing = new Map<string, { passed: boolean; best: number; attempts: number }>();
  for (const attempt of finalAttempts) {
    const current = standing.get(attempt.quizId) ?? { passed: false, best: 0, attempts: 0 };
    standing.set(attempt.quizId, {
      passed: current.passed || attempt.passed,
      best: Math.max(current.best, attempt.percentage),
      attempts: current.attempts + 1,
    });
  }

  // Reading order: section first, then lesson — the curriculum's order.
  lessons.sort((a, b) => a.section.sortOrder - b.section.sortOrder || a.sortOrder - b.sortOrder);
  const completedIds = new Set(completed.map((row) => row.lessonId));

  return enrollments.flatMap((row) => {
    const translation = pickTranslation(
      row.course.translations,
      locale,
      ctx.defaultLocale,
      ctx.locales,
    );
    if (!translation) return [];
    const courseHref = `/learn/${row.course.track}/${translation.slug}`;

    const courseLessons = lessons.filter((lesson) => lesson.section.courseId === row.courseId);
    const next = pickResumeLesson(courseLessons, completedIds, row.lastLessonId);
    const nextTranslation = next
      ? pickTranslation(next.translations, locale, ctx.defaultLocale, ctx.locales)
      : null;

    const total = row.course.lessonCount;
    const quiz = row.course.finalQuizId ? quizLinks.get(row.course.finalQuizId) : undefined;
    const quizStanding = quiz ? standing.get(quiz.id) : undefined;
    return [
      {
        courseId: row.courseId,
        track: row.course.track,
        title: translation.title,
        href: courseHref,
        coverUrl: row.course.coverAssetId ? (coverUrls[row.course.coverAssetId] ?? null) : null,
        lessonsCompleted: row.lessonsCompleted,
        lessonsTotal: total,
        percent: total > 0 ? Math.min(100, Math.round((row.lessonsCompleted / total) * 100)) : 0,
        isCompleted: row.completedAt !== null,
        lastActiveAt: row.lastActiveAt.toISOString(),
        resume: nextTranslation
          ? { title: nextTranslation.title, href: `${courseHref}/${nextTranslation.slug}` }
          : null,
        finalQuiz: quiz
          ? {
              title: quiz.title,
              href: `/learn/${quiz.track}/quizzes/${quiz.slug}`,
              passed: quizStanding?.passed ?? false,
              bestPercentage: quizStanding?.best ?? 0,
              attempts: quizStanding?.attempts ?? 0,
            }
          : null,
      },
    ];
  });
}

async function loadQuizAttempts(
  userId: string,
  locale: string,
  ctx: LocaleContext,
): Promise<AccountQuizAttemptView[]> {
  const rows = await db.quizAttempt.findMany({
    // Finished attempts only: an abandoned one has no score to show.
    where: { userId, completedAt: { not: null }, quiz: publicQuizWhere() },
    orderBy: { completedAt: "desc" },
    take: ACCOUNT_RECENT_QUIZ_ATTEMPTS,
    select: {
      id: true,
      percentage: true,
      passed: true,
      completedAt: true,
      quiz: {
        select: {
          track: true,
          translations: { select: { locale: true, slug: true, title: true } },
        },
      },
    },
  });

  return rows.flatMap((row) => {
    const translation = pickTranslation(
      row.quiz.translations,
      locale,
      ctx.defaultLocale,
      ctx.locales,
    );
    if (!translation || !row.completedAt) return [];
    return [
      {
        attemptId: row.id,
        title: translation.title,
        href: `/learn/${row.quiz.track}/quizzes/${translation.slug}`,
        percentage: row.percentage,
        passed: row.passed,
        completedAt: row.completedAt.toISOString(),
      },
    ];
  });
}

async function loadReads(
  userId: string,
  locale: string,
  ctx: LocaleContext,
): Promise<AccountReadView[]> {
  const rows = await db.articleRead.findMany({
    where: { userId, article: publicArticleWhere(new Date()) },
    orderBy: { readAt: "desc" },
    take: ACCOUNT_RECENT_READS,
    select: {
      articleId: true,
      readAt: true,
      article: {
        select: {
          kind: true,
          coverImageUrl: true,
          translations: { select: { locale: true, slug: true, title: true } },
        },
      },
    },
  });

  return rows.flatMap((row) => {
    const translation = pickTranslation(
      row.article.translations,
      locale,
      ctx.defaultLocale,
      ctx.locales,
    );
    if (!translation) return [];
    return [
      {
        articleId: row.articleId,
        kind: row.article.kind,
        title: translation.title,
        href: `/news/${translation.slug}`,
        coverImageUrl: row.article.coverImageUrl,
        readAt: row.readAt.toISOString(),
      },
    ];
  });
}

/**
 * The lessons this learner opened, most recent first (ADR-134).
 *
 * Every row a visit ever wrote is here, but only the ones a reader can still
 * reach are reported: the lesson through `publicLessonWhere` AND a published
 * section (the curriculum's own rule, ADR-081 #2), inside a public course.
 */
async function loadLessonReads(
  userId: string,
  locale: string,
  ctx: LocaleContext,
): Promise<AccountLessonReadView[]> {
  const now = new Date();
  const rows = await db.lessonProgress.findMany({
    where: {
      userId,
      lesson: {
        ...publicLessonWhere(now),
        section: { isPublished: true, course: publicCourseWhere(now) },
      },
    },
    orderBy: { lastViewedAt: "desc" },
    take: ACCOUNT_RECENT_LESSON_READS,
    select: {
      lessonId: true,
      status: true,
      lastViewedAt: true,
      lesson: {
        select: {
          translations: { select: { locale: true, slug: true, title: true } },
          section: {
            select: {
              course: {
                select: {
                  track: true,
                  translations: { select: { locale: true, slug: true, title: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return rows.flatMap((row) => {
    const course = row.lesson.section.course;
    const courseT = pickTranslation(course.translations, locale, ctx.defaultLocale, ctx.locales);
    const lessonT = pickTranslation(
      row.lesson.translations,
      locale,
      ctx.defaultLocale,
      ctx.locales,
    );
    if (!courseT || !lessonT) return [];
    return [
      {
        lessonId: row.lessonId,
        title: lessonT.title,
        href: `/learn/${course.track}/${courseT.slug}/${lessonT.slug}`,
        courseTitle: courseT.title,
        isCompleted: row.status === LessonProgressStatus.COMPLETED,
        viewedAt: row.lastViewedAt.toISOString(),
      },
    ];
  });
}

// ─── Avatar ──────────────────────────────────────────────────

/** Raster formats only. An .ico is not a portrait and an SVG is a document. */
const AVATAR_EXTENSIONS: ReadonlySet<SniffedImage["extension"]> = new Set([
  "png",
  "jpg",
  "gif",
  "webp",
]);

/**
 * Replace this learner's picture.
 *
 * The bytes go through `storeImage`, which is the only way bytes enter storage
 * (security.md #9): magic-byte sniffing, the unsafe-SVG refusal and the
 * library's own IMAGE ceiling all apply. The avatar's narrower budget is
 * checked first, so an oversized file is refused before it is sniffed.
 *
 * SVG is refused outright even when it is safe: a learner-supplied vector file
 * rendered on a public page is surface for no benefit at 80px.
 */
export async function setOwnAvatar(
  userId: string,
  input: { bytes: Uint8Array; fileName: string },
): Promise<{ url: string }> {
  if (input.bytes.length > AVATAR_MAX_BYTES) {
    throw new UploadRejectedError(
      `The file is larger than ${Math.round(AVATAR_MAX_BYTES / 1024 / 1024)} MB`,
    );
  }
  // Decided on the bytes BEFORE anything is stored; `storeImage` sniffs again
  // and owns every other refusal (empty, unsafe SVG, not an image at all).
  const sniffed = sniffImageType(input.bytes);
  if (sniffed && !isUnsafeSvg(sniffed) && !AVATAR_EXTENSIONS.has(sniffed.extension)) {
    throw new UploadRejectedError("Upload a PNG, JPEG, GIF or WebP image");
  }

  const before = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { image: true },
  });
  const stored = await storeImage(userId, {
    bytes: input.bytes,
    fileName: input.fileName,
    purpose: "avatar",
    category: "general",
    folder: "/general/avatars",
  });
  await db.user.update({ where: { id: userId }, data: { image: stored.url } });
  await recordAudit({
    userId,
    action: "users.avatarUpdate",
    entityType: "user",
    entityId: userId,
    changes: { before: { image: before.image }, after: { image: stored.url } },
  });
  return { url: stored.url };
}

/** Back to initials. The stored file stays in the library, as a replaced one does. */
export async function removeOwnAvatar(userId: string): Promise<void> {
  const before = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { image: true },
  });
  if (before.image === null) return;
  await db.user.update({ where: { id: userId }, data: { image: null } });
  await recordAudit({
    userId,
    action: "users.avatarRemove",
    entityType: "user",
    entityId: userId,
    changes: { before: { image: before.image }, after: { image: null } },
  });
}
