// Quizzes (changes-11 Phase 6, ADR-058).
//
// The whole file turns on one rule, and everything else is a consequence:
//
//   **THE CORRECT ANSWER NEVER LEAVES THIS FILE.**
//
// `QuizView` — the type the public loader returns — has no field for it. That
// absence is the protection, not a convention: no page, no route handler and
// no future refactor can leak what the type cannot express (ADR-058 #2). The
// grading functions below read `correctAnswer` and emit a boolean; the review
// path is the ONE place a correct answer is returned, and it is gated on
// `showAnswersAfter`.
//
// The second rule follows from it: **the learner never sends a score.** An
// attempt is created here, each answer is graded here, and the final score is
// computed from what THIS FILE recorded. `quizSubmitSchema` carries an attempt
// id and nothing else, so a forged score is unrepresentable rather than
// ignored (ADR-058 #3).
import { revalidateTag } from "next/cache";
import { cacheLife, cacheTag } from "next/cache";
import {
  ContentStatus,
  FeatureVisibility,
  LessonProgressStatus,
  TranslationStatus,
  db,
  type Prisma,
  type QuestionType,
} from "@repo/db";
import { computeSourceHash } from "@repo/i18n";
import { pickTranslation, type LocaleFallbackInfo } from "@repo/i18n";
import type { Subject } from "@repo/rbac";
import type {
  AnswerValue,
  AnswerVisibilityInput,
  LearnTrackKey,
  CreateQuizInput,
  QuestionTypeInput,
  QuizAttemptView,
  QuizCardView,
  QuizInput,
  QuizProgressSummary,
  QuizResultView,
  QuizReviewItem,
  QuizView,
} from "@repo/contracts";
import { answerValueSchema, isLearnTrack } from "@repo/contracts";
import {
  CONTENT_TRANSITIONS,
  createSlugRedirect,
  scheduledVisibilityOr,
  slugify,
  transitionContentStatus,
} from "./content.ts";
import { recomputeCourseCompletion } from "./progress.ts";
import { recordAudit } from "./index.ts";

/**
 * `Quiz.track` is a plain column validated by @repo/contracts, not by a FK
 * (ADR-065 §3), so a READ has to narrow it. A row naming an unregistered
 * track is DROPPED from public output rather than rendered: its URL segment
 * does not exist, so neither does its page. Dropping is what a de-registered
 * track means — the alternative is a card linking to a 404.
 */
function trackKeyOf(value: string): LearnTrackKey | null {
  return isLearnTrack(value) ? value : null;
}

// ─── Errors ──────────────────────────────────────────────────

export class QuizNotAccessibleError extends Error {
  constructor() {
    super("No such quiz, or it is not publicly visible");
    this.name = "QuizNotAccessibleError";
  }
}

export class AttemptLimitReachedError extends Error {
  constructor(limit: number) {
    super(`This quiz allows ${limit} attempts`);
    this.name = "AttemptLimitReachedError";
  }
}

export class AttemptNotFoundError extends Error {
  constructor() {
    super("No such attempt for this learner");
    this.name = "AttemptNotFoundError";
  }
}

export class AttemptAlreadySubmittedError extends Error {
  constructor() {
    super("This attempt has already been submitted");
    this.name = "AttemptAlreadySubmittedError";
  }
}

// ─── Grading (ADR-058 #3) ────────────────────────────────────

/**
 * Whether one answer is correct, by question type.
 *
 * MULTIPLE_CHOICE is **set equality**, deliberately: a subset scores zero and
 * so does a superset. Partial credit sounds generous and is unteachable —
 * "you were 2/3 right" on a question whose whole point is which combination
 * holds tells the learner nothing about what they got wrong, and it makes
 * `passingScore` mean something different per question.
 */
export function isAnswerCorrect(
  type: QuestionType | QuestionTypeInput,
  correct: AnswerValue,
  given: AnswerValue,
): boolean {
  if (type === "MULTIPLE_CHOICE") {
    const expected = Array.isArray(correct) ? correct : [correct];
    const actual = Array.isArray(given) ? given : [given];
    if (expected.length !== actual.length) return false;
    const wanted = new Set(expected);
    return actual.every((index) => wanted.has(index)) && new Set(actual).size === actual.length;
  }
  // SINGLE_CHOICE and TRUE_FALSE: one index, and an array is never right.
  if (Array.isArray(given) || Array.isArray(correct)) return false;
  return given === correct;
}

/**
 * `correctAnswer` and `answers` are `Json` columns, so the database will not
 * stop a malformed value. Everything read out of one goes through Zod, and a
 * row that fails is treated as ungradeable rather than crashing the attempt.
 */
function parseAnswerValue(raw: unknown): AnswerValue | null {
  const parsed = answerValueSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
}

function parseGrades(raw: unknown): Record<string, boolean> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

function parseAnswers(raw: unknown): Record<string, AnswerValue> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, AnswerValue> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseAnswerValue(value);
    if (parsed !== null) out[key] = parsed;
  }
  return out;
}

// ─── Locale plumbing ─────────────────────────────────────────

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

/** The public rule, identical in shape to `publicCourseWhere()`. */
export function publicQuizWhere(now: Date = new Date()) {
  return {
    deletedAt: null,
    OR: scheduledVisibilityOr(now),
    visibility: FeatureVisibility.PUBLIC,
  };
}

async function uniqueQuizSlug(locale: string, base: string, quizId: string): Promise<string> {
  const candidate = base || "quiz";
  let slug = candidate;
  let suffix = 2;
  for (;;) {
    const clash = await db.quizTranslation.findFirst({
      where: { locale, slug, NOT: { quizId } },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${candidate}-${suffix}`;
    suffix += 1;
  }
}

/** `/learn/<track>/quizzes/<slug>` (ADR-065 §1/§3). */
function quizPath(locale: string, defaultLocale: string, track: string, slug: string): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/learn/${track}/quizzes/${slug}`;
}

// ─── Admin reads ─────────────────────────────────────────────

export interface QuizAdminRow {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  /**
   * Who may see it. Carried to the admin list so the table can show whether a
   * quiz is ACTUALLY reachable: `publicQuizWhere()` is status PUBLISHED **and**
   * visibility PUBLIC, and a row that is published but restricted looks live in
   * a status column while being invisible to every guest (changes-18 PR 5).
   */
  visibility: FeatureVisibility;
  /** The school this quiz belongs to — its URL segment (ADR-065 §3). */
  track: string;
  isStandalone: boolean;
  category: string | null;
  questionCount: number;
  attemptCount: number;
  /** Where this quiz is used — an editor deleting one needs to know. */
  usedByLessons: number;
  usedByCourses: number;
  updatedAt: Date;
}

export async function listQuizzesAdmin(filter?: {
  status?: ContentStatus;
  search?: string;
}): Promise<QuizAdminRow[]> {
  const { locales, defaultLocale } = await localeContext();
  const rows = await db.quiz.findMany({
    where: {
      deletedAt: null,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.search ? { translations: { some: { title: { contains: filter.search } } } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      visibility: true,
      isStandalone: true,
      track: true,
      category: true,
      updatedAt: true,
      translations: { select: { locale: true, title: true, slug: true } },
      _count: { select: { questions: true, attempts: true, lessons: true, courses: true } },
    },
  });

  return rows.map((row) => {
    const t = pickTranslation(row.translations, defaultLocale, defaultLocale, locales);
    return {
      id: row.id,
      title: t?.title ?? "",
      slug: t?.slug ?? "",
      status: row.status,
      visibility: row.visibility,
      track: row.track,
      isStandalone: row.isStandalone,
      category: row.category,
      questionCount: row._count.questions,
      attemptCount: row._count.attempts,
      usedByLessons: row._count.lessons,
      usedByCourses: row._count.courses,
      updatedAt: row.updatedAt,
    };
  });
}

export interface QuizAdminQuestion {
  id: string;
  type: QuestionType;
  sortOrder: number;
  points: number;
  prompt: string;
  options: string[];
  explanations: string[];
  correctAnswer: AnswerValue;
}

export interface QuizAdminDetail {
  id: string;
  status: ContentStatus;
  /** Where this quiz may go next — the panel renders one button per entry. */
  legalTransitions: ContentStatus[];
  publishedAt: Date | null;
  scheduledFor: Date | null;
  updatedAt: Date;
  passingScore: number;
  maxAttempts: number | null;
  showAnswersAfter: AnswerVisibilityInput;
  track: string;
  isStandalone: boolean;
  category: string | null;
  visibility: string;
  translations: {
    locale: string;
    title: string;
    slug: string;
    description: string | null;
    translationStatus: TranslationStatus;
  }[];
  questions: QuizAdminQuestion[];
  attemptCount: number;
}

/**
 * The admin detail DOES carry `correctAnswer` — an editor cannot author a quiz
 * without seeing which option is right. This is why the split between this and
 * `getQuizBySlug` is a type-level one rather than a flag on one function: the
 * two audiences need genuinely different shapes, and a single function with an
 * `includeAnswers` boolean is one forgotten argument away from a leak.
 */
export async function getQuizAdmin(
  quizId: string,
  locale: string,
): Promise<QuizAdminDetail | null> {
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, deletedAt: null },
    select: {
      id: true,
      status: true,
      publishedAt: true,
      scheduledFor: true,
      updatedAt: true,
      passingScore: true,
      maxAttempts: true,
      showAnswersAfter: true,
      isStandalone: true,
      track: true,
      category: true,
      visibility: true,
      translations: {
        select: {
          locale: true,
          title: true,
          slug: true,
          description: true,
          translationStatus: true,
        },
      },
      questions: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          type: true,
          sortOrder: true,
          points: true,
          correctAnswer: true,
          translations: {
            where: { locale },
            select: { prompt: true, options: true, explanations: true },
          },
        },
      },
      _count: { select: { attempts: true } },
    },
  });
  if (!quiz) return null;

  return {
    id: quiz.id,
    status: quiz.status,
    legalTransitions: CONTENT_TRANSITIONS[quiz.status],
    publishedAt: quiz.publishedAt,
    scheduledFor: quiz.scheduledFor,
    updatedAt: quiz.updatedAt,
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
    showAnswersAfter: quiz.showAnswersAfter,
    track: quiz.track,
    isStandalone: quiz.isStandalone,
    category: quiz.category,
    visibility: quiz.visibility,
    translations: quiz.translations,
    attemptCount: quiz._count.attempts,
    questions: quiz.questions.map((question) => {
      const t = question.translations[0];
      return {
        id: question.id,
        type: question.type,
        sortOrder: question.sortOrder,
        points: question.points,
        prompt: t?.prompt ?? "",
        options: parseStringArray(t?.options),
        explanations: parseStringArray(t?.explanations),
        // A row whose JSON is unparseable falls back to "option 0" rather than
        // throwing: the editor must be able to OPEN a broken quiz to fix it.
        correctAnswer: parseAnswerValue(question.correctAnswer) ?? 0,
      };
    }),
  };
}

// ─── Admin writes ────────────────────────────────────────────

export async function createQuiz(actor: Subject, input: CreateQuizInput): Promise<string> {
  const { defaultLocale } = await localeContext();
  const quiz = await db.quiz.create({ data: { track: input.track, authorId: actor.id } });
  const slug = await uniqueQuizSlug(defaultLocale, slugify(input.title), quiz.id);

  await db.quizTranslation.create({
    data: { quizId: quiz.id, locale: defaultLocale, title: input.title, slug },
  });

  await recordAudit({
    userId: actor.id,
    action: "quizzes.create",
    entityType: "quizzes",
    entityId: quiz.id,
    changes: { after: { title: input.title } },
  });
  revalidateTag("content", { expire: 0 });
  return quiz.id;
}

/**
 * Meta, one translation, and the WHOLE question set, in one transaction.
 *
 * The question set is replaced rather than diffed per question. An editor
 * reorders, deletes and adds in one pass, and applying that as a stream of
 * individual mutations is how a half-saved quiz happens — one where the
 * questions moved but the correct answers did not.
 *
 * Questions carrying an `id` keep it, so an in-flight attempt that already
 * graded question X still refers to the same row. A question the editor
 * removed is deleted, and an attempt referencing it simply has a grade for a
 * question that no longer exists — which the result path skips rather than
 * failing on.
 */
export async function saveQuiz(actor: Subject, input: QuizInput): Promise<void> {
  const { defaultLocale } = await localeContext();
  const locale = input.translation.locale;
  const isSource = locale === defaultLocale;

  const slug = await uniqueQuizSlug(
    locale,
    slugify(input.translation.slug?.trim() || input.translation.title),
    input.quizId,
  );
  const existing = await db.quizTranslation.findUnique({
    where: { quizId_locale: { quizId: input.quizId, locale } },
    select: { slug: true },
  });
  // The track is the quiz URL's second segment (ADR-065 §3), so moving a quiz
  // between schools relocates it exactly as a slug rename does. Read before
  // the update or there is nothing to redirect from.
  const previousTrack = (
    await db.quiz.findUnique({ where: { id: input.quizId }, select: { track: true } })
  )?.track;

  const meta: Prisma.QuizUpdateInput = {};
  if (input.meta.passingScore !== undefined) meta.passingScore = input.meta.passingScore;
  if (input.meta.maxAttempts !== undefined) meta.maxAttempts = input.meta.maxAttempts;
  if (input.meta.showAnswersAfter !== undefined) {
    meta.showAnswersAfter = input.meta.showAnswersAfter;
  }
  if (input.meta.track !== undefined) meta.track = input.meta.track;
  if (input.meta.isStandalone !== undefined) meta.isStandalone = input.meta.isStandalone;
  if (input.meta.category !== undefined) meta.category = input.meta.category;
  if (input.meta.visibility !== undefined) meta.visibility = input.meta.visibility;

  const sourceHash = isSource
    ? computeSourceHash(`${input.translation.title}${input.translation.description ?? ""}`)
    : undefined;

  const fields = {
    title: input.translation.title,
    slug,
    description: input.translation.description ?? null,
    ...(sourceHash === undefined ? {} : { sourceHash }),
    translationStatus: TranslationStatus.TRANSLATED,
  };

  await db.$transaction(async (tx) => {
    await tx.quiz.update({ where: { id: input.quizId }, data: meta });
    await tx.quizTranslation.upsert({
      where: { quizId_locale: { quizId: input.quizId, locale } },
      update: fields,
      create: { quizId: input.quizId, locale, ...fields },
    });

    const keptIds = input.questions.flatMap((question) => (question.id ? [question.id] : []));
    await tx.quizQuestion.deleteMany({
      where: { quizId: input.quizId, ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}) },
    });

    for (const question of input.questions) {
      const core = {
        type: question.type,
        sortOrder: question.sortOrder,
        points: question.points,
        correctAnswer: question.correctAnswer as Prisma.InputJsonValue,
      };
      const questionId = question.id
        ? (
            await tx.quizQuestion.update({
              where: { id: question.id },
              data: core,
              select: { id: true },
            })
          ).id
        : (await tx.quizQuestion.create({ data: { quizId: input.quizId, ...core } })).id;

      const translation = {
        prompt: question.prompt,
        options: question.options as Prisma.InputJsonValue,
        explanations: (question.explanations ?? []) as Prisma.InputJsonValue,
      };
      await tx.quizQuestionTranslation.upsert({
        where: { questionId_locale: { questionId, locale } },
        update: translation,
        create: { questionId, locale, ...translation },
      });
    }
  });

  // Outside the transaction, matching saveLesson: a failed redirect write has
  // never rolled back a saved translation.
  const track = input.meta.track ?? previousTrack;
  if (existing && previousTrack && track && (existing.slug !== slug || previousTrack !== track)) {
    await createSlugRedirect(
      quizPath(locale, defaultLocale, previousTrack, existing.slug),
      quizPath(locale, defaultLocale, track, slug),
      actor.id,
    );
  }

  await recordAudit({
    userId: actor.id,
    action: "quizzes.update",
    entityType: "quizzes",
    entityId: input.quizId,
    changes: { after: { locale, questions: input.questions.length } },
  });
  revalidateTag("content", { expire: 0 });
}

export async function setQuizDeleted(
  actor: Subject,
  quizId: string,
  deleted: boolean,
): Promise<void> {
  await db.quiz.update({
    where: { id: quizId },
    data: { deletedAt: deleted ? new Date() : null },
  });
  await recordAudit({
    userId: actor.id,
    action: deleted ? "quizzes.delete" : "quizzes.restore",
    entityType: "quizzes",
    entityId: quizId,
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * Copies a quiz, with every question and every translation, as a DRAFT
 * (changes-18 PR 5). `duplicateLesson`'s shape, with three differences that
 * are specific to what a quiz is:
 *
 *  - **Attempts do not come with it.** They are learners' records against the
 *    quiz they actually sat; carrying them onto a copy would invent history
 *    and corrupt the analytics `/admin/learn/progress` reads.
 *  - **`publishedAt` is cleared**, because the copy has never been published.
 *    `status: DRAFT` alone would leave a date claiming otherwise.
 *  - **Nothing points at it.** `Lesson.quizId` and `Course.finalQuizId` are
 *    left alone: the consumers hold the FK (ADR-058), so re-pointing them
 *    would silently swap the quiz under a live lesson. The copy is
 *    unattached, which is what "duplicate" means here.
 *
 * `correctAnswer` is copied verbatim — it indexes into the option array of
 * the same question's translation, and both are copied together, so the
 * pairing that ADR-058 keeps server-side survives intact.
 */
export async function duplicateQuiz(actor: Subject, quizId: string): Promise<string> {
  const source = await db.quiz.findUniqueOrThrow({
    where: { id: quizId },
    include: {
      translations: true,
      questions: { include: { translations: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  // Resolved BEFORE the transaction: `uniqueQuizSlug` polls the table in a
  // loop, and holding a write transaction open across that is how a slow
  // duplicate turns into a lock-wait timeout for every other editor.
  const slugs = new Map<string, string>();
  for (const t of source.translations) {
    slugs.set(t.locale, await uniqueQuizSlug(t.locale, `${t.slug}-copy`, ""));
  }

  const copy = await db.$transaction(async (tx) => {
    const created = await tx.quiz.create({
      data: {
        track: source.track,
        passingScore: source.passingScore,
        maxAttempts: source.maxAttempts,
        showAnswersAfter: source.showAnswersAfter,
        isStandalone: source.isStandalone,
        category: source.category,
        status: ContentStatus.DRAFT,
        visibility: source.visibility,
        authorId: actor.id,
        publishedAt: null,
        translations: {
          create: source.translations.map((t) => ({
            locale: t.locale,
            title: `${t.title} (copy)`,
            slug: slugs.get(t.locale)!,
            description: t.description,
            sourceHash: t.sourceHash,
            translationStatus: t.translationStatus,
          })),
        },
      },
      select: { id: true },
    });

    for (const question of source.questions) {
      await tx.quizQuestion.create({
        data: {
          quizId: created.id,
          type: question.type,
          sortOrder: question.sortOrder,
          correctAnswer: question.correctAnswer as Prisma.InputJsonValue,
          points: question.points,
          translations: {
            create: question.translations.map((t) => ({
              locale: t.locale,
              prompt: t.prompt,
              options: t.options as Prisma.InputJsonValue,
              ...(t.explanations === null
                ? {}
                : { explanations: t.explanations as Prisma.InputJsonValue }),
            })),
          },
        },
      });
    }

    return created;
  });

  await recordAudit({
    userId: actor.id,
    action: "quizzes.duplicate",
    entityType: "quizzes",
    entityId: copy.id,
    changes: { after: { sourceQuizId: quizId } },
  });
  revalidateTag("content", { expire: 0 });
  return copy.id;
}

/**
 * Status transitions. `transitionContentStatus` gates publishing on
 * `lessons.publish` for the `quizzes` entity (ADR-058 #8) — the mapping lives
 * in `content.ts` so this file never spells a permission key.
 */
export async function setQuizStatus(
  actor: Subject,
  quizId: string,
  to: ContentStatus,
  scheduledFor?: Date,
): Promise<void> {
  await transitionContentStatus(actor, "quizzes", quizId, to, scheduledFor);
}

// ─── Public reads ────────────────────────────────────────────

/**
 * The quiz a learner sees. **No `correctAnswer` anywhere in the return type.**
 *
 * Cached and `content`-tagged like every other public loader, and it reads no
 * session: the attempt is entirely client-driven against the API, exactly as
 * progress is (ADR-056 #1). Which means this page stays static even though
 * what happens on it does not.
 */
export async function loadQuizBySlug(locale: string, slug: string): Promise<QuizView | null> {
  const { locales, defaultLocale } = await localeContext();

  const match = await db.quizTranslation.findFirst({
    where: { slug, quiz: publicQuizWhere() },
    select: { quizId: true },
  });
  if (!match) return null;

  const quiz = await db.quiz.findFirst({
    where: { id: match.quizId, ...publicQuizWhere() },
    select: {
      id: true,
      track: true,
      passingScore: true,
      maxAttempts: true,
      showAnswersAfter: true,
      isStandalone: true,
      category: true,
      updatedAt: true,
      translations: { select: { locale: true, title: true, slug: true, description: true } },
      questions: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          type: true,
          points: true,
          // `correctAnswer` is NOT selected. Not selected, not merely omitted
          // from the mapping below — the value never enters this process.
          translations: { select: { locale: true, prompt: true, options: true } },
        },
      },
    },
  });
  if (!quiz) return null;

  const t = pickTranslation(quiz.translations, locale, defaultLocale, locales);
  if (!t) return null;

  const questions = quiz.questions.flatMap((question) => {
    const qt = pickTranslation(question.translations, locale, defaultLocale, locales);
    if (!qt) return [];
    const options = parseStringArray(qt.options);
    // A question with fewer than two options is unanswerable. Dropped rather
    // than rendered as a dead prompt.
    if (options.length < 2) return [];
    return [
      {
        id: question.id,
        type: question.type as QuestionTypeInput,
        prompt: qt.prompt,
        options,
        points: question.points,
        multiple: question.type === "MULTIPLE_CHOICE",
      },
    ];
  });

  const track = trackKeyOf(quiz.track);
  if (!track) return null;

  return {
    id: quiz.id,
    slug: t.slug,
    title: t.title,
    description: t.description,
    track,
    category: quiz.category,
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
    showAnswersAfter: quiz.showAnswersAfter,
    isStandalone: quiz.isStandalone,
    questionCount: questions.length,
    totalPoints: questions.reduce((sum, question) => sum + question.points, 0),
    questions,
    updatedAt: quiz.updatedAt.toISOString(),
  };
}

export async function getQuizBySlug(locale: string, slug: string): Promise<QuizView | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadQuizBySlug(locale, slug);
}

/**
 * The `/learn/<track>/quizzes` index. Standalone quizzes only (ADR-058 #1) —
 * a lesson quiz stays reachable by slug and is simply not listed, because a
 * learner browsing the index is looking for something to take on its own.
 *
 * `track` narrows it to one school (ADR-065 §1). Omitting it returns every
 * track's quizzes, which is what the admin wants and what no public page does.
 */
export async function loadStandaloneQuizzes(
  locale: string,
  track?: LearnTrackKey,
): Promise<QuizCardView[]> {
  const { locales, defaultLocale } = await localeContext();
  const rows = await db.quiz.findMany({
    where: { ...publicQuizWhere(), isStandalone: true, ...(track ? { track } : {}) },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      track: true,
      category: true,
      passingScore: true,
      translations: { select: { locale: true, title: true, slug: true, description: true } },
      _count: { select: { questions: true } },
    },
  });

  return rows.flatMap((row) => {
    const t = pickTranslation(row.translations, locale, defaultLocale, locales);
    if (!t) return [];
    // A quiz with no questions is not takeable. It is DRAFT-shaped content
    // that happens to be published, and listing it produces a dead card.
    if (row._count.questions === 0) return [];
    const rowTrack = trackKeyOf(row.track);
    if (!rowTrack) return [];
    return [
      {
        id: row.id,
        slug: t.slug,
        title: t.title,
        description: t.description,
        track: rowTrack,
        category: row.category,
        questionCount: row._count.questions,
        passingScore: row.passingScore,
      },
    ];
  });
}

export async function getStandaloneQuizzes(
  locale: string,
  track?: LearnTrackKey,
): Promise<QuizCardView[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadStandaloneQuizzes(locale, track);
}

export interface QuizSitemapEntry {
  path: string;
  locale: string;
  updatedAt: Date;
}

export async function loadQuizSitemapEntries(): Promise<QuizSitemapEntry[]> {
  const rows = await db.quizTranslation.findMany({
    where: { quiz: { ...publicQuizWhere(), isStandalone: true } },
    select: { locale: true, slug: true, updatedAt: true, quiz: { select: { track: true } } },
  });
  return rows.map((row) => ({
    path: `/learn/${row.quiz.track}/quizzes/${row.slug}`,
    locale: row.locale,
    updatedAt: row.updatedAt,
  }));
}

// ─── Attempts (ADR-058 #3) ───────────────────────────────────

async function requirePublicQuiz(quizId: string) {
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, ...publicQuizWhere() },
    select: {
      id: true,
      passingScore: true,
      maxAttempts: true,
      showAnswersAfter: true,
      questions: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, type: true, points: true, correctAnswer: true },
      },
    },
  });
  if (!quiz) throw new QuizNotAccessibleError();
  return quiz;
}

/**
 * Start an attempt, or hand back the one already in progress.
 *
 * Resuming rather than always creating is what makes a refresh mid-quiz
 * harmless. It also means `maxAttempts` counts COMPLETED attempts plus the one
 * open one, so abandoning a quiz halfway does not silently burn a life.
 */
export async function startQuizAttempt(userId: string, quizId: string): Promise<QuizAttemptView> {
  const quiz = await requirePublicQuiz(quizId);

  const open = await db.quizAttempt.findFirst({
    where: { quizId, userId, completedAt: null },
    orderBy: { attemptNumber: "desc" },
  });
  if (open) {
    return {
      id: open.id,
      quizId,
      attemptNumber: open.attemptNumber,
      grades: quiz.showAnswersAfter === "NEVER" ? {} : parseGrades(open.grades),
      answers: parseAnswers(open.answers),
      completed: false,
    };
  }

  const completed = await db.quizAttempt.count({ where: { quizId, userId } });
  if (quiz.maxAttempts !== null && completed >= quiz.maxAttempts) {
    throw new AttemptLimitReachedError(quiz.maxAttempts);
  }

  const attempt = await db.quizAttempt.create({
    data: {
      quizId,
      userId,
      attemptNumber: completed + 1,
      answers: {},
      grades: {},
    },
  });

  return {
    id: attempt.id,
    quizId,
    attemptNumber: attempt.attemptNumber,
    grades: {},
    answers: {},
    completed: false,
  };
}

/**
 * Record and grade one answer.
 *
 * **The grade is stored, not returned to be trusted.** The caller gets a
 * boolean only when `showAnswersAfter` allows it (ADR-058 #4); the server's own
 * copy in `grades` is what the final score is computed from either way, so
 * withholding the feedback costs the learner nothing but the live counter.
 */
export async function recordQuizAnswer(
  userId: string,
  attemptId: string,
  questionId: string,
  answer: AnswerValue,
): Promise<{ correct: boolean | null }> {
  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId },
    select: { id: true, quizId: true, answers: true, grades: true, completedAt: true },
  });
  if (!attempt) throw new AttemptNotFoundError();
  if (attempt.completedAt !== null) throw new AttemptAlreadySubmittedError();

  const quiz = await requirePublicQuiz(attempt.quizId);
  const question = quiz.questions.find((row) => row.id === questionId);
  // A question id that is not in this quiz is not an error worth explaining —
  // it is either a stale client or someone probing, and both get the same
  // "no such thing" answer.
  if (!question) throw new AttemptNotFoundError();

  const correctAnswer = parseAnswerValue(question.correctAnswer);
  const correct = correctAnswer !== null && isAnswerCorrect(question.type, correctAnswer, answer);

  const answers = { ...parseAnswers(attempt.answers), [questionId]: answer };
  const grades = { ...parseGrades(attempt.grades), [questionId]: correct };

  await db.quizAttempt.update({
    where: { id: attempt.id },
    data: {
      answers: answers as Prisma.InputJsonValue,
      grades: grades as Prisma.InputJsonValue,
    },
  });

  return { correct: quiz.showAnswersAfter === "NEVER" ? null : correct };
}

/**
 * Finalise the attempt.
 *
 * Score comes from `grades` — the server's own record, written one answer at a
 * time. The submit payload carries an attempt id and nothing else, so there is
 * no client-supplied score to ignore.
 *
 * Passing has two side effects, both of which are ADR-058 #6: it completes any
 * `QUIZ_PASS` lesson this quiz is attached to (by writing the SAME
 * `LessonProgress` row a manual completion writes), and it re-runs course
 * completion for any course using it as a final quiz.
 */
export async function submitQuizAttempt(
  userId: string,
  attemptId: string,
  locale: string,
): Promise<QuizResultView> {
  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      quizId: true,
      attemptNumber: true,
      answers: true,
      grades: true,
      completedAt: true,
    },
  });
  if (!attempt) throw new AttemptNotFoundError();

  const quiz = await requirePublicQuiz(attempt.quizId);
  const grades = parseGrades(attempt.grades);
  const answers = parseAnswers(attempt.answers);

  const totalPoints = quiz.questions.reduce((sum, question) => sum + question.points, 0);
  const score = quiz.questions.reduce(
    (sum, question) => sum + (grades[question.id] === true ? question.points : 0),
    0,
  );
  const percentage = totalPoints === 0 ? 0 : Math.round((score / totalPoints) * 100);
  const passed = totalPoints > 0 && percentage >= quiz.passingScore;

  if (attempt.completedAt === null) {
    await db.quizAttempt.update({
      where: { id: attempt.id },
      data: { score, percentage, passed, completedAt: new Date() },
    });
    if (passed) await applyQuizPass(userId, attempt.quizId);
  }

  const attemptsUsed = await db.quizAttempt.count({
    where: { quizId: attempt.quizId, userId },
  });

  return {
    attemptId: attempt.id,
    quizId: attempt.quizId,
    attemptNumber: attempt.attemptNumber,
    score,
    totalPoints,
    percentage,
    passed,
    passingScore: quiz.passingScore,
    review: await buildReview(quiz, grades, answers, passed, locale),
    attemptsRemaining:
      quiz.maxAttempts === null ? null : Math.max(0, quiz.maxAttempts - attemptsUsed),
  };
}

/**
 * The review — ADR-058 #4's gate and the review itself, in one function.
 *
 * They belong together: the gate decides whether the correct answers may be
 * revealed at all, and separating it from the query that fetches them means
 * fetching text that `NEVER` forbids returning. Here the early return happens
 * BEFORE the translation query, so a `NEVER` quiz never reads an explanation
 * out of the database at all.
 *
 * `NEVER` withholds the review outright; `AFTER_PASS` withholds it from a
 * failed attempt, which is the setting's whole point — a learner who can see
 * every answer after failing once has not been asked a question, they have
 * been shown a key.
 */
async function buildReview(
  quiz: Awaited<ReturnType<typeof requirePublicQuiz>>,
  grades: Record<string, boolean>,
  answers: Record<string, AnswerValue>,
  passed: boolean,
  locale: string,
): Promise<QuizReviewItem[] | null> {
  if (quiz.showAnswersAfter === "NEVER") return null;
  if (quiz.showAnswersAfter === "AFTER_PASS" && !passed) return null;

  const { locales, defaultLocale } = await localeContext();
  const translations = await db.quizQuestionTranslation.findMany({
    where: { questionId: { in: quiz.questions.map((question) => question.id) } },
    select: { questionId: true, locale: true, explanations: true },
  });
  const byQuestion = new Map<string, typeof translations>();
  for (const row of translations) {
    byQuestion.set(row.questionId, [...(byQuestion.get(row.questionId) ?? []), row]);
  }

  return quiz.questions.flatMap((question) => {
    const correctAnswer = parseAnswerValue(question.correctAnswer);
    // A question whose stored answer is unparseable has no reviewable truth.
    // Omitted rather than shown with a guessed answer.
    if (correctAnswer === null) return [];
    const t = pickTranslation(byQuestion.get(question.id) ?? [], locale, defaultLocale, locales);
    return [
      {
        questionId: question.id,
        correct: grades[question.id] === true,
        given: answers[question.id] ?? null,
        correctAnswer,
        explanations: parseStringArray(t?.explanations),
      },
    ];
  });
}

/**
 * The review for an attempt already submitted — the "see my answers again"
 * path, scoped to the owner and to completed attempts only.
 *
 * An attempt still in progress returns null rather than its partial grades:
 * asking for the review mid-quiz is either a stale client or someone looking
 * for a shortcut, and both get the same answer.
 */
export async function getAttemptReview(
  userId: string,
  attemptId: string,
  locale: string,
): Promise<QuizReviewItem[] | null> {
  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId, completedAt: { not: null } },
    select: { quizId: true, answers: true, grades: true, passed: true },
  });
  if (!attempt) return null;

  const quiz = await requirePublicQuiz(attempt.quizId);
  return buildReview(
    quiz,
    parseGrades(attempt.grades),
    parseAnswers(attempt.answers),
    attempt.passed,
    locale,
  );
}

/**
 * The side effects of passing (ADR-058 #6).
 *
 * A `QUIZ_PASS` lesson is completed by writing the SAME `COMPLETED`
 * `LessonProgress` row a manual completion writes. Deriving it at read time
 * instead would make the curriculum say "done" and `lessonsCompleted` say
 * otherwise, permanently — ADR-056 #2 made that row the source of truth and
 * this keeps it the only one.
 */
async function applyQuizPass(userId: string, quizId: string): Promise<void> {
  const lessons = await db.lesson.findMany({
    where: {
      quizId,
      completionRule: "QUIZ_PASS",
      deletedAt: null,
      status: ContentStatus.PUBLISHED,
      visibility: FeatureVisibility.PUBLIC,
      section: { isPublished: true },
    },
    select: { id: true, section: { select: { courseId: true } } },
  });

  for (const lesson of lessons) {
    const courseId = lesson.section.courseId;
    await db.courseEnrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId },
      update: {},
    });
    await db.$transaction(
      async (tx) => {
        await tx.courseEnrollment.update({
          where: { userId_courseId: { userId, courseId } },
          data: { lastActiveAt: new Date() },
        });
        await tx.lessonProgress.upsert({
          where: { userId_lessonId: { userId, lessonId: lesson.id } },
          create: {
            userId,
            lessonId: lesson.id,
            courseId,
            status: LessonProgressStatus.COMPLETED,
            completedAt: new Date(),
          },
          update: { status: LessonProgressStatus.COMPLETED, completedAt: new Date() },
        });
        await recomputeCourseCompletion(tx, userId, courseId);
      },
      { isolationLevel: "ReadCommitted" },
    );
  }

  // A course using this as its FINAL quiz has no lesson row to write — the
  // completion rule reads the attempt directly (ADR-056 #7), so all this needs
  // to do is ask for a recount.
  const courses = await db.course.findMany({
    where: { finalQuizId: quizId, deletedAt: null },
    select: { id: true },
  });
  for (const course of courses) {
    const enrolled = await db.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { id: true },
    });
    // No enrollment means the learner never opened the course. Passing its
    // final quiz from the standalone index should not enrol them in it.
    if (!enrolled) continue;
    await db.$transaction(
      async (tx) => {
        await tx.courseEnrollment.update({
          where: { userId_courseId: { userId, courseId: course.id } },
          data: { lastActiveAt: new Date() },
        });
        await recomputeCourseCompletion(tx, userId, course.id);
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
}

export interface QuizAttemptSummary {
  id: string;
  attemptNumber: number;
  score: number;
  percentage: number;
  passed: boolean;
  completedAt: string | null;
}

export async function getAttemptsForUser(
  userId: string,
  quizId: string,
): Promise<QuizAttemptSummary[]> {
  const rows = await db.quizAttempt.findMany({
    where: { userId, quizId },
    orderBy: { attemptNumber: "desc" },
    select: {
      id: true,
      attemptNumber: true,
      score: true,
      percentage: true,
      passed: true,
      completedAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    attemptNumber: row.attemptNumber,
    score: row.score,
    percentage: row.percentage,
    passed: row.passed,
    completedAt: row.completedAt?.toISOString() ?? null,
  }));
}

/**
 * Every quiz this learner has finished at least once, best result first-class
 * (design pass 2026-09-09).
 *
 * The quiz INDEX's counterpart to `getEnrollmentSummaries`, and it obeys the
 * same rule ADR-056 #2 sets for progress: **counters and ids, no content.**
 * Every title, slug and cover the index draws is already in its cached page
 * payload, so this response never has to carry any — which is what lets a
 * per-learner read sit on a page that is otherwise fully cached.
 *
 * Two queries rather than one, because "the best score" and "ever passed" are
 * different questions. A learner who scored 90% on a quiz whose pass mark is
 * 95%, then scraped 95% on a later go, has both a best of 95 and a pass — but
 * a learner who passed at 80% and later scored 40% has a best of 80 and a pass
 * that the max row happens to agree with only by luck. Deriving `passed` from
 * the best-scoring attempt would be right by coincidence and wrong the day a
 * quiz's pass mark is lowered under existing attempts.
 *
 * Abandoned attempts are excluded: `percentage` defaults to 0 and stays there
 * until submit, so counting them would show "best 0%" for someone who opened a
 * quiz and closed the tab.
 */
export async function getQuizProgressForUser(userId: string): Promise<QuizProgressSummary[]> {
  const [aggregates, passedRows] = await Promise.all([
    db.quizAttempt.groupBy({
      by: ["quizId"],
      where: { userId, completedAt: { not: null } },
      _max: { percentage: true },
      _count: { _all: true },
    }),
    db.quizAttempt.findMany({
      where: { userId, passed: true },
      select: { quizId: true },
      distinct: ["quizId"],
    }),
  ]);

  const passed = new Set(passedRows.map((row) => row.quizId));
  return aggregates.map((row) => ({
    quizId: row.quizId,
    bestPercentage: row._max.percentage ?? 0,
    passed: passed.has(row.quizId),
    attempts: row._count._all,
  }));
}

/** Has this learner ever passed this quiz? The question `QUIZ_PASS` asks. */
export async function hasPassedQuiz(userId: string, quizId: string): Promise<boolean> {
  const passed = await db.quizAttempt.findFirst({
    where: { userId, quizId, passed: true },
    select: { id: true },
  });
  return passed !== null;
}
