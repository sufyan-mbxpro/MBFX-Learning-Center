// Lesson services (Module 11, ADR-055). Sanitize-on-save (security.md #8),
// slug change → Redirect row, sourceHash freshness, audit + `content`
// revalidation on every mutation — the same discipline as articles.ts.
//
// Permission gating is the caller's — it calls `requirePermission` with the
// relevant `lessons.` key. (Spelled that way on purpose: written as a call
// with a wildcard literal, `check:permission-keys` reads the comment as a real
// usage and fails on a key that can never be in the registry.) What lives here
// is row-dependent gating, which means publishing goes through
// `transitionContentStatus` and needs `lessons.publish`.
import { revalidateTag } from "next/cache";
import { ContentStatus, TranslationStatus, db, type Difficulty, type Prisma } from "@repo/db";
import { computeSourceHash, isTranslationOutdated } from "@repo/i18n";
import type { Subject } from "@repo/rbac";
import { parseVideoUrl } from "@repo/utils";
import type { CreateLessonInput, LessonAttachmentInput, LessonInput } from "@repo/contracts";
import { syncReferences } from "./cms/references.ts";
import { recomputeLessonCount } from "./courses.ts";
import {
  CONTENT_TRANSITIONS,
  createSlugRedirect,
  lessonPath,
  sanitizeRichText,
  slugify,
  transitionContentStatus,
} from "./content.ts";
import { recordAudit } from "./index.ts";

// ─── Errors ──────────────────────────────────────────────────

export class InvalidLessonVideoUrlError extends Error {
  constructor() {
    super("videoUrl is not a supported embed provider");
    this.name = "InvalidLessonVideoUrlError";
  }
}

export class EmptyLessonError extends Error {
  constructor() {
    super("A lesson needs at least one capability: content, video, external URL, or attachment");
    this.name = "EmptyLessonError";
  }
}

export class CrossCourseMoveError extends Error {
  constructor() {
    super("A lesson cannot move to a section in a different course");
    this.name = "CrossCourseMoveError";
  }
}

// ─── Helpers ─────────────────────────────────────────────────

async function defaultLocaleCode(): Promise<string> {
  return (
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en"
  );
}

/**
 * ContentReference source id for a lesson's media placements.
 *
 * `ReferenceSourceType` has a `COURSE` member and no `LESSON` one, and
 * ADR-055 #6 says to use it — so the id carries the distinction instead.
 * Without the prefix, "what uses this asset" would return course covers and
 * lesson heroes as indistinguishable `COURSE` rows, and the admin's in-use
 * breakdown could not tell an editor WHERE the asset actually sits. The
 * compound form is the same trick `saveArticle` uses for per-locale OG
 * images (`${articleId}:${locale}`).
 */
function lessonReferenceSource(lessonId: string): {
  sourceType: "COURSE";
  sourceId: string;
} {
  return { sourceType: "COURSE", sourceId: `lesson:${lessonId}` };
}

/**
 * Rewrites the lesson's whole media reference set from PERSISTED state.
 *
 * Derived rather than passed in, because `syncReferences` replaces every row
 * for a source: if the hero and the attachments each synced their own list,
 * whichever wrote second would silently delete the other's references and
 * `deleteMedia()` would then happily delete an asset that is still on the
 * page. Reading both back inside the transaction makes that impossible.
 */
async function syncLessonMediaReferences(
  tx: Prisma.TransactionClient,
  lessonId: string,
): Promise<void> {
  const lesson = await tx.lesson.findUnique({
    where: { id: lessonId },
    select: { heroAssetId: true, attachments: { select: { assetId: true } } },
  });
  if (!lesson) return;

  const refs = [
    ...(lesson.heroAssetId
      ? [{ refType: "MEDIA" as const, refId: lesson.heroAssetId, field: "heroAssetId" }]
      : []),
    ...lesson.attachments.map((a) => ({
      refType: "MEDIA" as const,
      refId: a.assetId,
      field: "attachment",
    })),
  ];
  await syncReferences(tx, lessonReferenceSource(lessonId), refs);
}

/** The course a lesson belongs to — needed for its URL and its lessonCount. */
async function courseIdForLesson(
  tx: Prisma.TransactionClient | typeof db,
  lessonId: string,
): Promise<string | null> {
  const row = await tx.lesson.findUnique({
    where: { id: lessonId },
    select: { section: { select: { courseId: true } } },
  });
  return row?.section.courseId ?? null;
}

// ─── Admin list ──────────────────────────────────────────────

export interface LessonAdminRow {
  id: string;
  sectionId: string;
  sectionTitle: string;
  sortOrder: number;
  status: ContentStatus;
  visibility: string;
  isRequired: boolean;
  completionRule: string;
  estimatedMinutes: number | null;
  title: string;
  slug: string;
  hasVideo: boolean;
  hasExternal: boolean;
  attachmentCount: number;
  updatedAt: Date;
  deletedAt: Date | null;
  locales: { locale: string; translationStatus: TranslationStatus }[];
}

export async function listLessonsAdmin(courseId: string): Promise<LessonAdminRow[]> {
  const defaultLocale = await defaultLocaleCode();
  const rows = await db.lesson.findMany({
    where: { deletedAt: null, section: { courseId } },
    orderBy: [{ section: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      sectionId: true,
      sortOrder: true,
      status: true,
      visibility: true,
      isRequired: true,
      completionRule: true,
      estimatedMinutes: true,
      videoUrl: true,
      externalUrl: true,
      updatedAt: true,
      deletedAt: true,
      _count: { select: { attachments: true } },
      section: { select: { translations: { select: { locale: true, title: true } } } },
      translations: {
        select: { locale: true, title: true, slug: true, translationStatus: true },
      },
    },
  });

  return rows.map((row) => {
    const preferred =
      row.translations.find((t) => t.locale === defaultLocale) ?? row.translations[0];
    const sectionTitle =
      row.section.translations.find((t) => t.locale === defaultLocale)?.title ??
      row.section.translations[0]?.title ??
      "";
    return {
      id: row.id,
      sectionId: row.sectionId,
      sectionTitle,
      sortOrder: row.sortOrder,
      status: row.status,
      visibility: row.visibility,
      isRequired: row.isRequired,
      completionRule: row.completionRule,
      estimatedMinutes: row.estimatedMinutes,
      title: preferred?.title ?? "",
      slug: preferred?.slug ?? "",
      hasVideo: row.videoUrl !== null,
      hasExternal: row.externalUrl !== null,
      attachmentCount: row._count.attachments,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      locales: row.translations.map((t) => ({
        locale: t.locale,
        translationStatus: t.translationStatus,
      })),
    };
  });
}

// ─── Create ──────────────────────────────────────────────────

export async function createLesson(actor: Subject, input: CreateLessonInput): Promise<string> {
  const defaultLocale = await defaultLocaleCode();
  const sortOrder = await db.lesson.count({
    where: { sectionId: input.sectionId, deletedAt: null },
  });
  const slug = await uniqueLessonSlug(defaultLocale, slugify(input.title));

  const lesson = await db.lesson.create({
    data: {
      sectionId: input.sectionId,
      sortOrder,
      authorId: actor.id,
      translations: { create: { locale: defaultLocale, title: input.title, slug } },
    },
    select: { id: true },
  });

  await recordAudit({
    userId: actor.id,
    action: "lessons.create",
    entityType: "lesson",
    entityId: lesson.id,
    changes: { after: { sectionId: input.sectionId, title: input.title, slug } },
  });
  revalidateTag("content", { expire: 0 });
  return lesson.id;
}

/**
 * Lesson slugs are `@@unique([locale, slug])` GLOBALLY, not per course
 * (ADR-055 #3 — that global uniqueness is exactly what lets a lesson URL omit
 * its section). So "introduction" can only exist once per locale across the
 * whole site, and a second one has to be suffixed rather than rejected: an
 * editor adding an "Introduction" lesson to their second course should not
 * hit a constraint error they cannot act on.
 */
async function uniqueLessonSlug(
  locale: string,
  base: string,
  excludeLessonId?: string,
): Promise<string> {
  const candidate = base || "lesson";
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix === 0 ? candidate : `${candidate}-${suffix + 1}`;
    const clash = await db.lessonTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      select: { lessonId: true },
    });
    if (!clash || clash.lessonId === excludeLessonId) return slug;
  }
  // 100 collisions on one title is not a real editorial situation; falling back
  // to a unique-by-construction suffix beats looping forever.
  return `${candidate}-${Date.now().toString(36)}`;
}

// ─── Save ────────────────────────────────────────────────────

/**
 * The capability rule (ADR-055 #4) re-checked against what will actually be
 * stored. `lessonInputSchema` enforces it on the payload; this enforces it on
 * the persisted result, which is not the same thing — a body of `<p></p>`
 * passes a non-empty string check in the contract and sanitizes down to
 * nothing here. Server-side is the boundary (security.md #6).
 */
function assertHasCapability(input: {
  content: string | null;
  videoUrl: string | null;
  externalUrl: string | null;
  attachments: LessonAttachmentInput[];
}): void {
  const hasBody = (input.content ?? "").replace(/<[^>]*>/g, "").trim().length > 0;
  if (!hasBody && !input.videoUrl && !input.externalUrl && input.attachments.length === 0) {
    throw new EmptyLessonError();
  }
}

export async function saveLesson(actor: Subject, input: LessonInput): Promise<void> {
  if (input.meta.videoUrl && parseVideoUrl(input.meta.videoUrl) === null) {
    throw new InvalidLessonVideoUrlError();
  }

  const defaultLocale = await defaultLocaleCode();
  const locale = input.translation.locale;
  const isSource = locale === defaultLocale;

  const current = await db.lesson.findUniqueOrThrow({
    where: { id: input.lessonId },
    select: {
      videoUrl: true,
      externalUrl: true,
      section: { select: { courseId: true } },
    },
  });
  const courseId = current.section.courseId;

  const content = input.translation.content ? sanitizeRichText(input.translation.content) : null;
  const slug = await uniqueLessonSlug(
    locale,
    slugify(input.translation.slug?.trim() || input.translation.title),
    input.lessonId,
  );

  assertHasCapability({
    content,
    videoUrl: input.meta.videoUrl ?? current.videoUrl,
    externalUrl: input.meta.externalUrl ?? current.externalUrl,
    attachments: input.attachments,
  });

  const existing = await db.lessonTranslation.findUnique({
    where: { lessonId_locale: { lessonId: input.lessonId, locale } },
    select: { slug: true },
  });

  const sourceHash = isSource
    ? computeSourceHash(`${input.translation.title}${content ?? ""}`)
    : await currentLessonSourceHash(input.lessonId, defaultLocale);

  const metaData: Prisma.LessonUpdateInput = {};
  if (input.meta.difficulty !== undefined) metaData.difficulty = input.meta.difficulty;
  if (input.meta.estimatedMinutes !== undefined)
    metaData.estimatedMinutes = input.meta.estimatedMinutes;
  if (input.meta.videoUrl !== undefined) metaData.videoUrl = input.meta.videoUrl;
  if (input.meta.externalUrl !== undefined) metaData.externalUrl = input.meta.externalUrl;
  if (input.meta.heroAssetId !== undefined) metaData.heroAssetId = input.meta.heroAssetId;
  if (input.meta.completionRule !== undefined) metaData.completionRule = input.meta.completionRule;
  if (input.meta.isRequired !== undefined) metaData.isRequired = input.meta.isRequired;
  if (input.meta.visibility !== undefined) metaData.visibility = input.meta.visibility;
  if (input.meta.sortOrder !== undefined) metaData.sortOrder = input.meta.sortOrder;
  if (input.meta.prerequisiteLessonId !== undefined) {
    metaData.prerequisiteLessonId = input.meta.prerequisiteLessonId;
  }
  // ADR-058 #1 — the consumer holds the FK, so attaching a quiz is a lesson
  // write like any other. `quiz: { disconnect: true }` rather than
  // `quizId: null`: this is a relation on `LessonUpdateInput`, and Prisma
  // rejects the scalar form when the relation is declared.
  if (input.meta.quizId !== undefined) {
    metaData.quiz =
      input.meta.quizId === null ? { disconnect: true } : { connect: { id: input.meta.quizId } };
  }

  const fields = {
    title: input.translation.title,
    slug,
    summary: input.translation.summary ?? null,
    content,
    learningObjectives: (input.translation.learningObjectives ?? null) as Prisma.InputJsonValue,
    seoTitle: input.translation.seoTitle ?? null,
    seoDescription: input.translation.seoDescription ?? null,
    seoFocusKeyword: input.translation.seoFocusKeyword ?? null,
    sourceHash,
    translationStatus: TranslationStatus.TRANSLATED,
  };

  await db.$transaction(async (tx) => {
    await tx.lesson.update({ where: { id: input.lessonId }, data: metaData });

    await tx.lessonTranslation.upsert({
      where: { lessonId_locale: { lessonId: input.lessonId, locale } },
      update: fields,
      create: { lessonId: input.lessonId, locale, ...fields },
    });

    await replaceAttachments(tx, input.lessonId, input.attachments);
    await syncLessonMediaReferences(tx, input.lessonId);
  });

  // Outside the transaction, matching saveArticleTranslation's split: a
  // failed redirect write has never rolled back a saved translation.
  if (existing && existing.slug !== slug) {
    const course = await courseAddressFor(courseId, locale);
    if (course) {
      await createSlugRedirect(
        lessonPath(locale, defaultLocale, course.track, course.slug, existing.slug),
        lessonPath(locale, defaultLocale, course.track, course.slug, slug),
        actor.id,
      );
    }
  }

  if (isSource && sourceHash) {
    const siblings = await db.lessonTranslation.findMany({
      where: { lessonId: input.lessonId, locale: { not: defaultLocale } },
      select: { id: true, sourceHash: true },
    });
    const stale = siblings.filter((s) => isTranslationOutdated(sourceHash, s.sourceHash));
    if (stale.length > 0) {
      await db.lessonTranslation.updateMany({
        where: { id: { in: stale.map((s) => s.id) } },
        data: { translationStatus: TranslationStatus.OUTDATED },
      });
    }
  }

  await recordAudit({
    userId: actor.id,
    action: "lessons.save",
    entityType: "lesson",
    entityId: input.lessonId,
    changes: { after: { title: input.translation.title, slug, locale } },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * The two segments a lesson URL inherits from its course (ADR-065 §1): the
 * track and the localised slug. Both or neither — a redirect built from a
 * track with no slug would point at a 404.
 */
async function courseAddressFor(
  courseId: string,
  locale: string,
): Promise<{ track: string; slug: string } | null> {
  const row = await db.courseTranslation.findUnique({
    where: { courseId_locale: { courseId, locale } },
    select: { slug: true, course: { select: { track: true } } },
  });
  return row ? { track: row.course.track, slug: row.slug } : null;
}

async function currentLessonSourceHash(
  lessonId: string,
  defaultLocale: string,
): Promise<string | null> {
  const source = await db.lessonTranslation.findUnique({
    where: { lessonId_locale: { lessonId, locale: defaultLocale } },
    select: { title: true, content: true },
  });
  if (!source) return null;
  return computeSourceHash(`${source.title}${source.content ?? ""}`);
}

// ─── Attachments ─────────────────────────────────────────────

async function replaceAttachments(
  tx: Prisma.TransactionClient,
  lessonId: string,
  items: LessonAttachmentInput[],
): Promise<void> {
  await tx.lessonAttachment.deleteMany({ where: { lessonId } });
  if (items.length === 0) return;
  await tx.lessonAttachment.createMany({
    data: items.map((item, index) => ({
      lessonId,
      assetId: item.assetId,
      label: item.label ?? null,
      sortOrder: index,
    })),
  });
}

/** The standalone Resources panel's save. Full replacement, like every other set in this codebase. */
export async function setLessonAttachments(
  actor: Subject,
  lessonId: string,
  items: LessonAttachmentInput[],
): Promise<void> {
  await db.$transaction(async (tx) => {
    await replaceAttachments(tx, lessonId, items);
    await syncLessonMediaReferences(tx, lessonId);
  });
  await recordAudit({
    userId: actor.id,
    action: "lessons.setAttachments",
    entityType: "lesson",
    entityId: lessonId,
    changes: { after: { count: items.length } },
  });
  revalidateTag("content", { expire: 0 });
}

// ─── Structure ───────────────────────────────────────────────

/**
 * Moves a lesson between sections OF THE SAME COURSE.
 *
 * Cross-course moves are refused, and the reason is `LessonProgress.courseId`:
 * it is denormalised (ADR-056 #2) and set when progress is recorded, so a
 * lesson that changed course would leave every existing progress row pointing
 * at the wrong one. Silently corrupting learner progress to save an editor one
 * delete-and-recreate is the wrong trade.
 */
export async function moveLesson(
  actor: Subject,
  lessonId: string,
  toSectionId: string,
  index: number,
): Promise<void> {
  const [lesson, target] = await Promise.all([
    db.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: { sectionId: true, section: { select: { courseId: true } } },
    }),
    db.courseSection.findUniqueOrThrow({
      where: { id: toSectionId },
      select: { courseId: true },
    }),
  ]);
  if (lesson.section.courseId !== target.courseId) throw new CrossCourseMoveError();

  await db.$transaction(async (tx) => {
    await tx.lesson.update({
      where: { id: lessonId },
      data: { sectionId: toSectionId, sortOrder: index },
    });

    // Renumber the destination densely so two lessons never share a sortOrder
    // after an insert — the list order would otherwise depend on cuid tiebreak.
    const siblings = await tx.lesson.findMany({
      where: { sectionId: toSectionId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const ordered = siblings.filter((s) => s.id !== lessonId);
    ordered.splice(Math.min(index, ordered.length), 0, { id: lessonId });
    for (const [position, row] of ordered.entries()) {
      await tx.lesson.update({ where: { id: row.id }, data: { sortOrder: position } });
    }
  });

  await recordAudit({
    userId: actor.id,
    action: "lessons.move",
    entityType: "lesson",
    entityId: lessonId,
    changes: { before: { sectionId: lesson.sectionId }, after: { sectionId: toSectionId, index } },
  });
  revalidateTag("content", { expire: 0 });
}

export async function reorderLessons(
  actor: Subject,
  sectionId: string,
  lessonIds: string[],
): Promise<void> {
  await db.$transaction(
    lessonIds.map((id, index) =>
      db.lesson.updateMany({ where: { id, sectionId }, data: { sortOrder: index } }),
    ),
  );
  await recordAudit({
    userId: actor.id,
    action: "lessons.reorder",
    entityType: "courseSection",
    entityId: sectionId,
    changes: { after: { order: lessonIds } },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * Copies a lesson into the same section as a DRAFT.
 *
 * Attachments come with it and their references are synced for the copy, so
 * the media guard sees the new placement immediately — the copy is a real,
 * independent usage from the moment it exists (the ADR-035 reasoning
 * `duplicateArticle` records).
 */
export async function duplicateLesson(actor: Subject, lessonId: string): Promise<string> {
  const source = await db.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { translations: true, attachments: true },
  });

  const slugs = new Map<string, string>();
  for (const t of source.translations) {
    slugs.set(t.locale, await uniqueLessonSlug(t.locale, `${t.slug}-copy`));
  }

  const copy = await db.$transaction(async (tx) => {
    const sortOrder = await tx.lesson.count({
      where: { sectionId: source.sectionId, deletedAt: null },
    });
    const created = await tx.lesson.create({
      data: {
        sectionId: source.sectionId,
        difficulty: source.difficulty,
        estimatedMinutes: source.estimatedMinutes,
        videoUrl: source.videoUrl,
        externalUrl: source.externalUrl,
        heroAssetId: source.heroAssetId,
        completionRule: source.completionRule,
        isRequired: source.isRequired,
        prerequisiteLessonId: source.prerequisiteLessonId,
        sortOrder,
        status: ContentStatus.DRAFT,
        visibility: source.visibility,
        authorId: actor.id,
        translations: {
          create: source.translations.map((t) => ({
            locale: t.locale,
            title: `${t.title} (copy)`,
            slug: slugs.get(t.locale)!,
            summary: t.summary,
            content: t.content,
            learningObjectives: t.learningObjectives as Prisma.InputJsonValue,
            seoTitle: t.seoTitle,
            seoDescription: t.seoDescription,
            seoFocusKeyword: t.seoFocusKeyword,
            sourceHash: t.sourceHash,
            translationStatus: t.translationStatus,
          })),
        },
        attachments: {
          create: source.attachments.map((a) => ({
            assetId: a.assetId,
            label: a.label,
            sortOrder: a.sortOrder,
          })),
        },
      },
      select: { id: true },
    });
    await syncLessonMediaReferences(tx, created.id);
    return created;
  });

  await recordAudit({
    userId: actor.id,
    action: "lessons.duplicate",
    entityType: "lesson",
    entityId: copy.id,
    changes: { after: { sourceLessonId: lessonId } },
  });
  revalidateTag("content", { expire: 0 });
  return copy.id;
}

// ─── Lifecycle ───────────────────────────────────────────────

export async function setLessonDeleted(
  actor: Subject,
  lessonId: string,
  deleted: boolean,
): Promise<void> {
  const courseId = await courseIdForLesson(db, lessonId);

  await db.$transaction(async (tx) => {
    await tx.lesson.update({
      where: { id: lessonId },
      data: { deletedAt: deleted ? new Date() : null },
    });
    if (courseId) await recomputeLessonCount(tx, courseId);
  });

  await recordAudit({
    userId: actor.id,
    action: deleted ? "lessons.softDelete" : "lessons.restore",
    entityType: "lesson",
    entityId: lessonId,
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * Status transitions for lessons, and the reason this wrapper exists at all:
 * `Course.lessonCount` counts PUBLISHED lessons, so it goes stale the moment
 * a lesson publishes or archives. `transitionContentStatus` is shared by three
 * entities and knows nothing about courses, so rather than teach it a
 * course-specific side effect, the recount lives here — the one place that
 * already knows a lesson's status changed.
 *
 * Publish permission (`lessons.publish`) is enforced inside
 * `transitionContentStatus`, before anything is written.
 */
export async function setLessonStatus(
  actor: Subject,
  lessonId: string,
  to: ContentStatus,
  scheduledFor?: Date,
): Promise<void> {
  await transitionContentStatus(actor, "lessons", lessonId, to, scheduledFor);

  const courseId = await courseIdForLesson(db, lessonId);
  if (courseId) {
    await db.$transaction(async (tx) => {
      await recomputeLessonCount(tx, courseId);
    });
  }
  revalidateTag("content", { expire: 0 });
}

// ─── Admin detail ────────────────────────────────────────────

export interface LessonAdminTranslation {
  locale: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  learningObjectives: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  seoFocusKeyword: string | null;
  translationStatus: TranslationStatus;
}

export interface LessonAdminAttachment {
  assetId: string;
  label: string | null;
  fileName: string;
  url: string;
  kind: string;
  size: number;
}

export interface LessonAdminDetail {
  id: string;
  sectionId: string;
  courseId: string;
  courseTitle: string;
  sectionTitle: string;
  status: ContentStatus;
  difficulty: Difficulty;
  estimatedMinutes: number | null;
  videoUrl: string | null;
  externalUrl: string | null;
  heroAssetId: string | null;
  heroUrl: string | null;
  completionRule: string;
  /** ADR-058 #1 — the attached quiz, or null. */
  quizId: string | null;
  isRequired: boolean;
  prerequisiteLessonId: string | null;
  visibility: string;
  sortOrder: number;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  translations: LessonAdminTranslation[];
  attachments: LessonAdminAttachment[];
  legalTransitions: ContentStatus[];
}

/**
 * `learningObjectives` is a Json column, so what comes back is `unknown`.
 * Narrowed here rather than in the editor: a hand-edited row holding a number
 * or an object would otherwise crash a client component on render, and the
 * loader is the one place that can drop the bad entries once.
 */
function toObjectives(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

export async function loadLessonAdminDetail(lessonId: string): Promise<LessonAdminDetail | null> {
  const defaultLocale = await defaultLocaleCode();
  const row = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      translations: { orderBy: { locale: "asc" } },
      attachments: { orderBy: { sortOrder: "asc" } },
      section: {
        select: {
          courseId: true,
          translations: { select: { locale: true, title: true } },
          course: { select: { translations: { select: { locale: true, title: true } } } },
        },
      },
    },
  });
  if (!row) return null;

  const assetIds = [
    ...row.attachments.map((a) => a.assetId),
    ...(row.heroAssetId ? [row.heroAssetId] : []),
  ];
  const assets = assetIds.length
    ? await db.mediaAsset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, url: true, fileName: true, kind: true, size: true },
      })
    : [];
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const pick = (rows: { locale: string; title: string }[]) =>
    rows.find((t) => t.locale === defaultLocale)?.title ?? rows[0]?.title ?? "";

  return {
    id: row.id,
    sectionId: row.sectionId,
    courseId: row.section.courseId,
    courseTitle: pick(row.section.course.translations),
    sectionTitle: pick(row.section.translations),
    status: row.status,
    difficulty: row.difficulty,
    estimatedMinutes: row.estimatedMinutes,
    videoUrl: row.videoUrl,
    externalUrl: row.externalUrl,
    heroAssetId: row.heroAssetId,
    heroUrl: row.heroAssetId ? (assetById.get(row.heroAssetId)?.url ?? null) : null,
    completionRule: row.completionRule,
    quizId: row.quizId,
    isRequired: row.isRequired,
    prerequisiteLessonId: row.prerequisiteLessonId,
    visibility: row.visibility,
    sortOrder: row.sortOrder,
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
      content: t.content,
      learningObjectives: toObjectives(t.learningObjectives),
      seoTitle: t.seoTitle,
      seoDescription: t.seoDescription,
      seoFocusKeyword: t.seoFocusKeyword,
      translationStatus: t.translationStatus,
    })),
    // An attachment whose asset has been hard-deleted is dropped rather than
    // rendered as a broken row: `deleteMedia()` refuses assets in use, so this
    // can only happen to a row that outlived its asset, and the editor's save
    // would otherwise re-persist a dangling id.
    attachments: row.attachments.flatMap((a) => {
      const asset = assetById.get(a.assetId);
      if (!asset) return [];
      return [
        {
          assetId: a.assetId,
          label: a.label,
          fileName: asset.fileName,
          url: asset.url,
          kind: asset.kind,
          size: asset.size,
        },
      ];
    }),
    legalTransitions: CONTENT_TRANSITIONS[row.status],
  };
}

export interface LessonFlatRow extends LessonAdminRow {
  courseId: string;
  courseTitle: string;
}

/**
 * The flat lesson list (§8.1) — every lesson across every course, which is
 * what makes the OUTDATED translation queue reachable without first guessing
 * which course a stale lesson belongs to.
 */
export async function listAllLessonsAdmin(filter?: {
  courseId?: string;
  status?: ContentStatus;
  translationStatus?: TranslationStatus;
  search?: string;
}): Promise<LessonFlatRow[]> {
  const defaultLocale = await defaultLocaleCode();
  const rows = await db.lesson.findMany({
    where: {
      deletedAt: null,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.courseId ? { section: { courseId: filter.courseId } } : {}),
      ...(filter?.translationStatus
        ? { translations: { some: { translationStatus: filter.translationStatus } } }
        : {}),
      ...(filter?.search ? { translations: { some: { title: { contains: filter.search } } } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      sectionId: true,
      sortOrder: true,
      status: true,
      visibility: true,
      isRequired: true,
      completionRule: true,
      estimatedMinutes: true,
      videoUrl: true,
      externalUrl: true,
      updatedAt: true,
      deletedAt: true,
      _count: { select: { attachments: true } },
      section: {
        select: {
          courseId: true,
          translations: { select: { locale: true, title: true } },
          course: { select: { translations: { select: { locale: true, title: true } } } },
        },
      },
      translations: {
        select: { locale: true, title: true, slug: true, translationStatus: true },
      },
    },
  });

  const pick = (list: { locale: string; title: string }[]) =>
    list.find((t) => t.locale === defaultLocale)?.title ?? list[0]?.title ?? "";

  return rows.map((row) => {
    const preferred =
      row.translations.find((t) => t.locale === defaultLocale) ?? row.translations[0];
    return {
      id: row.id,
      sectionId: row.sectionId,
      sectionTitle: pick(row.section.translations),
      courseId: row.section.courseId,
      courseTitle: pick(row.section.course.translations),
      sortOrder: row.sortOrder,
      status: row.status,
      visibility: row.visibility,
      isRequired: row.isRequired,
      completionRule: row.completionRule,
      estimatedMinutes: row.estimatedMinutes,
      title: preferred?.title ?? "",
      slug: preferred?.slug ?? "",
      hasVideo: row.videoUrl !== null,
      hasExternal: row.externalUrl !== null,
      attachmentCount: row._count.attachments,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      locales: row.translations.map((t) => ({
        locale: t.locale,
        translationStatus: t.translationStatus,
      })),
    };
  });
}
