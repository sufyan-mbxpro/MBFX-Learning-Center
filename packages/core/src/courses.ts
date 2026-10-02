// Course services (Module 11, ADR-055). Same discipline as articles.ts and
// content.ts: sanitize-on-save (security.md #8), slug change → Redirect row,
// sourceHash freshness, audit on every mutation, `content` tag revalidation.
//
// Permission model, following the established layering: the calling server
// action or route handler gates on `courses.*` with `requirePermission()`
// (security.md #1 — that IS the boundary). What lives here is the gating that
// depends on the ROW being touched, which the action cannot do: publishing
// goes through `transitionContentStatus`, which requires `courses.publish` on
// top of whatever the action already required.
import { revalidateTag } from "next/cache";
import { type ContentStatus, TranslationStatus, db, type Difficulty, type Prisma } from "@repo/db";
import type { Subject } from "@repo/rbac";
import { isLearnTrack, isReservedCourseSlug } from "@repo/contracts";
import type {
  CourseFaqItem,
  CourseInput,
  CourseMetaInput,
  CreateCourseInput,
} from "@repo/contracts";
import { syncReferences } from "./cms/references.ts";
import { COURSE, RECOMMENDED, loadRelationTargets, replaceRelations } from "./content-relations.ts";
import { publicLessonWhere, readCourseFaq } from "./public-courses.ts";
import {
  CONTENT_TRANSITIONS,
  contentFlagsData,
  coursePath,
  createSlugRedirect,
  lessonPath,
  sanitizeRichText,
  slugify,
  transitionContentStatus,
} from "./content.ts";
import { recordAudit } from "./index.ts";
import { hashCourseSource, loadCourseSource } from "./learn-source.ts";
import { propagateSharedSlug, sharedSlugFor, type SlugMove } from "./shared-slug.ts";
import {
  afterSourceSave,
  enqueueEntityTranslations,
  TRANSLATION_TABLES,
} from "./translation-queue.ts";

// ─── Errors ──────────────────────────────────────────────────

export class UnknownTrackError extends Error {
  constructor(track: string) {
    super(`Unknown learn track: ${track}`);
    this.name = "UnknownTrackError";
  }
}

export class ReservedCourseSlugError extends Error {
  constructor(slug: string) {
    super(`Course slug "${slug}" is reserved and would shadow a route`);
    this.name = "ReservedCourseSlugError";
  }
}

export class SectionNotEmptyError extends Error {
  constructor(count: number) {
    super(`Section still holds ${count} lesson(s)`);
    this.name = "SectionNotEmptyError";
  }
}

// ─── Helpers ─────────────────────────────────────────────────

async function defaultLocaleCode(): Promise<string> {
  return (
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en"
  );
}

function assertTrack(track: string): void {
  if (!isLearnTrack(track)) throw new UnknownTrackError(track);
}

/**
 * The slug a translation will actually get. Derived from the title when the
 * editor leaves it blank, then checked against the reserved list — the check
 * has to run on the DERIVED value, not on the submitted one, or a course
 * titled "Quizzes" with an empty slug field would slip through the contract
 * and shadow `/learn/quizzes`.
 */
function resolveCourseSlug(title: string, submitted?: string): string {
  const slug = slugify(submitted?.trim() || title);
  if (isReservedCourseSlug(slug)) throw new ReservedCourseSlugError(slug);
  return slug;
}

// ─── Admin list ──────────────────────────────────────────────

export interface CourseAdminRow {
  id: string;
  track: string;
  status: ContentStatus;
  difficulty: Difficulty;
  visibility: string;
  sortOrder: number;
  lessonCount: number;
  sectionCount: number;
  title: string;
  slug: string;
  externalUrl: string | null;
  updatedAt: Date;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  deletedAt: Date | null;
  locales: { locale: string; translationStatus: TranslationStatus }[];
  legalTransitions: ContentStatus[];
}

export async function listCoursesAdmin(filter?: {
  track?: string;
  status?: ContentStatus;
  includeDeleted?: boolean;
}): Promise<CourseAdminRow[]> {
  const defaultLocale = await defaultLocaleCode();
  const rows = await db.course.findMany({
    where: {
      ...(filter?.track ? { track: filter.track } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.includeDeleted ? {} : { deletedAt: null }),
    },
    orderBy: [{ track: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      track: true,
      status: true,
      difficulty: true,
      visibility: true,
      sortOrder: true,
      lessonCount: true,
      externalUrl: true,
      updatedAt: true,
      publishedAt: true,
      scheduledFor: true,
      deletedAt: true,
      _count: { select: { sections: true } },
      translations: {
        select: { locale: true, title: true, slug: true, translationStatus: true },
      },
    },
  });

  return rows.map((row) => {
    // The admin list shows the default-locale title, falling back to whatever
    // translation exists — a course created but not yet translated into the
    // default locale must still be findable rather than rendering blank.
    const preferred =
      row.translations.find((t) => t.locale === defaultLocale) ?? row.translations[0];
    return {
      id: row.id,
      track: row.track,
      status: row.status,
      difficulty: row.difficulty,
      visibility: row.visibility,
      sortOrder: row.sortOrder,
      lessonCount: row.lessonCount,
      sectionCount: row._count.sections,
      title: preferred?.title ?? "",
      slug: preferred?.slug ?? "",
      externalUrl: row.externalUrl,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
      scheduledFor: row.scheduledFor,
      deletedAt: row.deletedAt,
      locales: row.translations.map((t) => ({
        locale: t.locale,
        translationStatus: t.translationStatus,
      })),
      legalTransitions: CONTENT_TRANSITIONS[row.status],
    };
  });
}

// ─── Create ──────────────────────────────────────────────────

export async function createCourse(actor: Subject, input: CreateCourseInput): Promise<string> {
  assertTrack(input.track);
  const defaultLocale = await defaultLocaleCode();
  const slug = resolveCourseSlug(input.title);

  const course = await db.course.create({
    data: {
      track: input.track,
      authorId: actor.id,
      translations: {
        create: { locale: defaultLocale, title: input.title, slug },
      },
    },
    select: { id: true },
  });

  await recordAudit({
    userId: actor.id,
    action: "courses.create",
    entityType: "course",
    entityId: course.id,
    changes: { after: { track: input.track, title: input.title, slug } },
  });
  revalidateTag("content", { expire: 0 });
  return course.id;
}

// ─── Save (meta + translation + recommendations, one transaction) ──

/**
 * Recommendations as `ContentRelation` rows (ADR-055). Takes a transaction
 * client so they commit atomically with the rest of `saveCourse` — the same
 * reason `replaceRelations` takes one for article related-posts.
 */
export async function setCourseRecommendations(
  tx: Prisma.TransactionClient,
  courseId: string,
  targetIds: string[],
): Promise<void> {
  await replaceRelations(tx, {
    sourceType: COURSE,
    sourceId: courseId,
    targetType: COURSE,
    relationType: RECOMMENDED,
    targetIds,
  });
}

/** Ordered recommendation ids, for the editor to load back. */
export async function getCourseRecommendations(courseId: string): Promise<string[]> {
  return loadRelationTargets({
    sourceType: COURSE,
    sourceId: courseId,
    targetType: COURSE,
    relationType: RECOMMENDED,
  });
}

function courseMetaData(meta: CourseMetaInput): Prisma.CourseUpdateInput {
  const data: Prisma.CourseUpdateInput = {};
  if (meta.track !== undefined) data.track = meta.track;
  if (meta.difficulty !== undefined) data.difficulty = meta.difficulty;
  if (meta.estimatedHours !== undefined) data.estimatedHours = meta.estimatedHours;
  if (meta.coverAssetId !== undefined) data.coverAssetId = meta.coverAssetId;
  if (meta.externalUrl !== undefined) data.externalUrl = meta.externalUrl;
  if (meta.visibility !== undefined) data.visibility = meta.visibility;
  if (meta.sortOrder !== undefined) data.sortOrder = meta.sortOrder;
  Object.assign(data, contentFlagsData(meta));
  // ADR-056 #7 / ADR-058 #1 — the course-level completion rule. A RELATION on
  // CourseUpdateInput, so Prisma wants connect/disconnect rather than the
  // scalar; null is the picker's "No quiz" option, not a missing field.
  if (meta.finalQuizId !== undefined) {
    data.finalQuiz =
      meta.finalQuizId === null ? { disconnect: true } : { connect: { id: meta.finalQuizId } };
  }
  return data;
}

/**
 * Meta + translation + recommendations in ONE transaction (the shape
 * `saveArticle` established in changes-07). The after-effects that are
 * deliberately outside it — redirect rows and the sibling-OUTDATED sweep —
 * match `saveArticleTranslation`'s split exactly: a failure to write a
 * redirect has never rolled back a saved translation, and changing that here
 * would be a silent behavioural difference between two adjacent editors.
 */
export async function saveCourse(actor: Subject, input: CourseInput): Promise<void> {
  if (input.meta.track !== undefined) assertTrack(input.meta.track);

  const defaultLocale = await defaultLocaleCode();
  const isSource = input.translation.locale === defaultLocale;

  const description = input.translation.description
    ? sanitizeRichText(input.translation.description)
    : null;

  const existing = await db.courseTranslation.findUnique({
    where: {
      courseId_locale: { courseId: input.courseId, locale: input.translation.locale },
    },
    select: { slug: true, title: true, summary: true, description: true },
  });

  // The track is part of the course's address now (ADR-065 §1), so a move
  // between schools relocates the course AND every lesson under it, exactly
  // as a slug rename does. Read before the update, or there is nothing left
  // to redirect FROM.
  const previous = await db.course.findUnique({
    where: { id: input.courseId },
    select: { track: true },
  });
  const previousTrack = previous?.track ?? null;

  // Phase 5 (ADR-161): a translation records the hash of the English it was
  // made from, so the sweep and the job can tell whether it is current. The
  // English row's own hash is read back AFTER the write (`afterSourceSave`),
  // so the sweep and the job agree on what the source is.
  const translatedFrom = isSource
    ? null
    : await loadCourseSource(db, input.courseId, defaultLocale).then((s) =>
        s ? hashCourseSource(s) : null,
      );

  const fields = {
    title: input.translation.title,
    summary: input.translation.summary ?? null,
    description,
    seoTitle: input.translation.seoTitle ?? null,
    seoDescription: input.translation.seoDescription ?? null,
    seoFocusKeyword: input.translation.seoFocusKeyword ?? null,
    // changes-49: `Json?`, where `undefined` means "leave the column alone"
    // and an empty array is "the author removed every question".
    ...(input.translation.faq === undefined ? {} : { faq: input.translation.faq }),
    ...(isSource ? {} : { sourceHash: translatedFrom }),
    // changes-29 B3: MACHINE_TRANSLATED only while the AI text is untouched;
    // any other save, a human's review included, writes TRANSLATED.
    translationStatus: input.translation.machineTranslated
      ? TranslationStatus.MACHINE_TRANSLATED
      : TranslationStatus.TRANSLATED,
  };

  const { slug, moves } = await db.$transaction(async (tx) => {
    await tx.course.update({
      where: { id: input.courseId },
      data: courseMetaData(input.meta),
    });

    // ADR-181: the English row owns the slug. A non-default save takes a copy
    // of it and ignores what was submitted; only with no English row yet is
    // there nothing to copy, and the old derivation applies.
    const slug = isSource
      ? resolveCourseSlug(input.translation.title, input.translation.slug)
      : ((await sharedSlugFor(
          tx,
          TRANSLATION_TABLES.course,
          input.courseId,
          input.translation.locale,
          defaultLocale,
        )) ?? resolveCourseSlug(input.translation.title, input.translation.slug));

    await tx.courseTranslation.upsert({
      where: {
        courseId_locale: { courseId: input.courseId, locale: input.translation.locale },
      },
      update: { ...fields, slug },
      create: { courseId: input.courseId, locale: input.translation.locale, ...fields, slug },
    });

    // An English rename moves every language with it (ADR-181 #3).
    const moves = isSource
      ? await propagateSharedSlug(
          tx,
          TRANSLATION_TABLES.course,
          input.courseId,
          defaultLocale,
          slug,
        )
      : [];

    if (input.recommendations !== undefined) {
      await setCourseRecommendations(tx, input.courseId, input.recommendations);
    }

    // ADR-055 #6 — the cover placement is a ContentReference so deleteMedia()'s
    // in-use guard protects course media. Written unconditionally (with an
    // empty list when there is no cover) so CLEARING a cover also clears the
    // reference; syncReferences replaces the whole set for this source.
    if (input.meta.coverAssetId !== undefined) {
      await syncReferences(
        tx,
        { sourceType: "COURSE", sourceId: input.courseId },
        input.meta.coverAssetId
          ? [{ refType: "MEDIA", refId: input.meta.coverAssetId, field: "coverAssetId" }]
          : [],
      );
    }
    return { slug, moves };
  });

  await finishCourseSave(actor, input, {
    slug,
    moves,
    previousSlug: existing?.slug ?? null,
    previousTrack,
    track: input.meta.track ?? previousTrack,
    isSource,
    defaultLocale,
  });

  await recordAudit({
    userId: actor.id,
    action: "courses.save",
    entityType: "course",
    entityId: input.courseId,
    changes: { after: { title: input.translation.title, slug, locale: input.translation.locale } },
  });
  revalidateTag("content", { expire: 0 });
}

interface FinishCourseSave {
  slug: string;
  moves: SlugMove[];
  previousSlug: string | null;
  previousTrack: string | null;
  track: string | null;
  isSource: boolean;
  defaultLocale: string;
}

async function finishCourseSave(
  actor: Subject,
  input: CourseInput,
  prepared: FinishCourseSave,
): Promise<void> {
  const { slug, moves, previousSlug, previousTrack, track, isSource, defaultLocale } = prepared;
  const locale = input.translation.locale;

  await redirectCourseAddress(actor.id, input.courseId, locale, defaultLocale, {
    previousSlug,
    previousTrack,
    slug,
    track,
  });

  // ADR-181 #3: an English save moves every other language's address too —
  // its slug when the English one was renamed, its track when the school
  // changed — so each sibling gets the same redirects the English row did.
  if (isSource) {
    const moved = new Map(moves.map((move) => [move.locale, move]));
    const siblings = await db.courseTranslation.findMany({
      where: { courseId: input.courseId, locale: { not: defaultLocale } },
      select: { locale: true, slug: true },
    });
    for (const sibling of siblings) {
      await redirectCourseAddress(actor.id, input.courseId, sibling.locale, defaultLocale, {
        previousSlug: moved.get(sibling.locale)?.previous ?? sibling.slug,
        previousTrack,
        slug: sibling.slug,
        track,
      });
    }
  }

  // An English save: a person's translation whose source moved becomes
  // OUTDATED, a machine one is re-translated (ADR-161 #3). The English row's
  // hash is stored too, so a later sweep compares like with like. An
  // SEO-only edit changes the hash as well now — the job keeps a machine row
  // current, and a person's row is flagged because its SEO text is theirs.
  if (isSource) {
    const source = await loadCourseSource(db, input.courseId, defaultLocale);
    const hash = source ? hashCourseSource(source) : null;
    if (hash) {
      await db.courseTranslation.updateMany({
        where: { courseId: input.courseId, locale: defaultLocale },
        data: { sourceHash: hash },
      });
    }
    await afterSourceSave("course", input.courseId, hash, defaultLocale);
  }
}

/**
 * One locale's course address moving, and every lesson under it. A course's
 * URL is /learn/<track>/<slug> (ADR-065 §1); EITHER half moving it is a rename
 * as far as a bookmark is concerned, so both are handled by one branch rather
 * than two that would have to stay in step.
 */
async function redirectCourseAddress(
  actorId: string,
  courseId: string,
  locale: string,
  defaultLocale: string,
  address: {
    previousSlug: string | null;
    previousTrack: string | null;
    slug: string;
    track: string | null;
  },
): Promise<void> {
  const { previousSlug, previousTrack, slug, track } = address;
  if (!previousSlug || !previousTrack || !track) return;
  if (previousSlug === slug && previousTrack === track) return;

  await createSlugRedirect(
    coursePath(locale, defaultLocale, previousTrack, previousSlug),
    coursePath(locale, defaultLocale, track, slug),
    actorId,
  );

  // A lesson URL embeds its track and its course slug, so moving a course
  // moves every lesson under it. Without this loop a rename 404s every
  // bookmarked and indexed lesson while the course itself redirects fine —
  // the failure is invisible from the course page you just renamed.
  const lessons = await db.lessonTranslation.findMany({
    where: { locale, lesson: { section: { courseId } } },
    select: { slug: true },
  });
  for (const lesson of lessons) {
    await createSlugRedirect(
      lessonPath(locale, defaultLocale, previousTrack, previousSlug, lesson.slug),
      lessonPath(locale, defaultLocale, track, slug, lesson.slug),
      actorId,
    );
  }
}

// ─── Lifecycle ───────────────────────────────────────────────

export async function setCourseDeleted(
  actor: Subject,
  courseId: string,
  deleted: boolean,
): Promise<void> {
  await db.course.update({
    where: { id: courseId },
    data: { deletedAt: deleted ? new Date() : null },
  });
  await recordAudit({
    userId: actor.id,
    action: deleted ? "courses.softDelete" : "courses.restore",
    entityType: "course",
    entityId: courseId,
  });
  // A restore can bring back an English edit the jobs skipped while the course
  // was deleted (ADR-161 #1).
  if (!deleted) await enqueueEntityTranslations("course", courseId);
  revalidateTag("content", { expire: 0 });
}

/** Full replacement ordering, array position is `sortOrder` — same rule as menu reorder. */
export async function reorderCourses(actor: Subject, ids: string[]): Promise<void> {
  await db.$transaction(
    ids.map((id, index) => db.course.update({ where: { id }, data: { sortOrder: index } })),
  );
  await recordAudit({
    userId: actor.id,
    action: "courses.reorder",
    entityType: "course",
    entityId: ids[0] ?? "",
    changes: { after: { order: ids } },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * Recomputes the denormalised published-lesson count (ADR-056 #2's sibling
 * concern on the content side). Called by the lesson and section services
 * inside their own transaction, which is what keeps it from drifting — it is
 * deliberately NOT a periodic repair job.
 *
 * **It counts what a reader can REACH, not what is merely published**
 * (changes-22). It used to count `status: PUBLISHED` and nothing else, while
 * the curriculum query filters on `publicLessonWhere()` AND
 * `section.isPublished` — and `CourseSection.isPublished` defaults to false.
 * So a course whose two lessons were published inside a section nobody had
 * published read "2 lessons" in the header above a curriculum that said there
 * were none. The same mismatch was quietly worse in `progress.ts`, whose
 * numerator already used the reachable set against this denominator: a course
 * with one unreachable lesson could never be completed, and the comment there
 * asserting the two count the same thing was describing an intention rather
 * than the code.
 *
 * The one thing this cannot track is time. A SCHEDULED lesson that falls due
 * with no write behind it is reachable before this column knows — the count
 * catches up on the next write to any lesson in the course. That window is
 * bounded by the same `cacheLife` every learn reader already runs under
 * (ADR-071: the query decides visibility, the sweep is bookkeeping), so it is
 * a staleness of minutes in a number, never a wrong page.
 */
export async function recomputeLessonCount(
  tx: Prisma.TransactionClient,
  courseId: string,
): Promise<void> {
  const lessonCount = await tx.lesson.count({
    where: {
      ...publicLessonWhere(),
      section: { isPublished: true, courseId },
    },
  });
  await tx.course.update({ where: { id: courseId }, data: { lessonCount } });
}

// ─── Admin detail ────────────────────────────────────────────

export interface CourseAdminTranslation {
  locale: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoFocusKeyword: string | null;
  /** changes-49 — never null here: a course with none reads as `[]`. */
  faq: CourseFaqItem[];
  translationStatus: TranslationStatus;
}

export interface CourseAdminDetail {
  id: string;
  track: string;
  status: ContentStatus;
  difficulty: Difficulty;
  estimatedHours: number | null;
  coverAssetId: string | null;
  /** ADR-139 — the article's three flags. */
  isFeatured: boolean;
  isActive: boolean;
  isPremium: boolean;
  /**
   * Resolved here rather than stored: ADR-055 #6 replaced the `*ImageUrl`
   * columns with asset ids, so the URL is a property of the asset and a
   * replace-in-place must not leave a stale copy on the course row.
   */
  coverUrl: string | null;
  externalUrl: string | null;
  /** ADR-056 #7 — the course-level completion rule, or null. */
  finalQuizId: string | null;
  visibility: string;
  sortOrder: number;
  lessonCount: number;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  translations: CourseAdminTranslation[];
  recommendations: string[];
  legalTransitions: ContentStatus[];
}

export async function loadCourseAdminDetail(courseId: string): Promise<CourseAdminDetail | null> {
  const row = await db.course.findUnique({
    where: { id: courseId },
    include: { translations: { orderBy: { locale: "asc" } } },
  });
  if (!row) return null;

  // Two extra reads rather than joins: the editor loads ONE course, and
  // `coverAssetId` is a plain String column (MediaAsset carries no
  // back-relations — ADR-035), so there is no relation to include.
  const [cover, recommendations] = await Promise.all([
    row.coverAssetId
      ? db.mediaAsset.findUnique({ where: { id: row.coverAssetId }, select: { url: true } })
      : Promise.resolve(null),
    getCourseRecommendations(courseId),
  ]);

  return {
    id: row.id,
    track: row.track,
    status: row.status,
    difficulty: row.difficulty,
    estimatedHours: row.estimatedHours,
    coverAssetId: row.coverAssetId,
    isFeatured: row.isFeatured,
    isActive: row.isActive,
    isPremium: row.isPremium,
    coverUrl: cover?.url ?? null,
    externalUrl: row.externalUrl,
    finalQuizId: row.finalQuizId,
    visibility: row.visibility,
    sortOrder: row.sortOrder,
    lessonCount: row.lessonCount,
    publishedAt: row.publishedAt,
    scheduledFor: row.scheduledFor,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    translations: row.translations.map((t) => ({
      locale: t.locale,
      title: t.title,
      slug: t.slug,
      summary: t.summary,
      description: t.description,
      seoTitle: t.seoTitle,
      seoDescription: t.seoDescription,
      seoFocusKeyword: t.seoFocusKeyword,
      faq: readCourseFaq(t.faq),
      translationStatus: t.translationStatus,
    })),
    recommendations,
    legalTransitions: CONTENT_TRANSITIONS[row.status],
  };
}

/**
 * Course status transitions. A thin wrapper over the shared machine so the
 * admin action has one symmetric pair with `setLessonStatus` to call, and so
 * `courses.publish` is enforced in the same place for both.
 */
export async function setCourseStatus(
  actor: Subject,
  courseId: string,
  to: ContentStatus,
  scheduledFor?: Date,
): Promise<void> {
  await transitionContentStatus(actor, "courses", courseId, to, scheduledFor);
  revalidateTag("content", { expire: 0 });
}
