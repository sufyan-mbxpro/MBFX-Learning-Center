// Course section services (Module 11, ADR-055 #1 — `Module` renamed).
//
// A section is grouping, not a destination: it has no slug, no status machine
// and no URL (ADR-055 #3). That is why this file is short and why reordering
// sections is a cheap, link-safe operation.
//
// Permission gating is the caller's (`requirePermission("courses.update")`),
// matching courses.ts — sections have no permission key of their own and
// deliberately get none, because editing a curriculum IS editing the course.
import { revalidateTag } from "next/cache";
import { db, type ContentStatus } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type { SectionInput } from "@repo/contracts";
import { SectionNotEmptyError } from "./courses.ts";
import { recordAudit } from "./index.ts";

async function defaultLocaleCode(): Promise<string> {
  return (
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en"
  );
}

/**
 * Appends a section to a course. `sortOrder` is the current count rather than
 * a client-supplied index: a new section always lands at the end, and
 * `reorderSections` is the one way order changes.
 */
export async function createSection(
  actor: Subject,
  courseId: string,
  title?: string,
): Promise<string> {
  const defaultLocale = await defaultLocaleCode();
  const sortOrder = await db.courseSection.count({ where: { courseId } });

  const section = await db.courseSection.create({
    data: {
      courseId,
      sortOrder,
      translations: { create: { locale: defaultLocale, title: title ?? "Untitled section" } },
    },
    select: { id: true },
  });

  await recordAudit({
    userId: actor.id,
    action: "courses.createSection",
    entityType: "courseSection",
    entityId: section.id,
    changes: { after: { courseId, sortOrder } },
  });
  revalidateTag("content", { expire: 0 });
  return section.id;
}

export async function saveSection(actor: Subject, input: SectionInput): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.courseSection.update({
      where: { id: input.sectionId },
      data: {
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    const fields = {
      title: input.translation.title,
      description: input.translation.description ?? null,
    };
    await tx.courseSectionTranslation.upsert({
      where: {
        sectionId_locale: { sectionId: input.sectionId, locale: input.translation.locale },
      },
      update: fields,
      create: { sectionId: input.sectionId, locale: input.translation.locale, ...fields },
    });
  });

  await recordAudit({
    userId: actor.id,
    action: "courses.saveSection",
    entityType: "courseSection",
    entityId: input.sectionId,
    changes: { after: { title: input.translation.title, locale: input.translation.locale } },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * Full replacement ordering. Scoped to `courseId` in the `where` so a
 * malformed id list cannot reorder another course's sections — the same
 * defensive scoping the reorder endpoints elsewhere use.
 */
export async function reorderSections(
  actor: Subject,
  courseId: string,
  sectionIds: string[],
): Promise<void> {
  await db.$transaction(
    sectionIds.map((id, index) =>
      db.courseSection.updateMany({ where: { id, courseId }, data: { sortOrder: index } }),
    ),
  );
  await recordAudit({
    userId: actor.id,
    action: "courses.reorderSections",
    entityType: "course",
    entityId: courseId,
    changes: { after: { order: sectionIds } },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * Deleting a section is a HARD delete, and it refuses while lessons remain.
 *
 * The refusal is the point. `CourseSection.lessons` cascades at the database
 * level, so without this guard one click on a section would silently destroy
 * every lesson under it — including their translations, their progress rows
 * and their published URLs. A section has no `deletedAt` of its own because it
 * has no independent existence to restore; the safe operation is "move the
 * lessons out, then delete the empty section".
 */
export async function deleteSection(actor: Subject, sectionId: string): Promise<void> {
  const lessonCount = await db.lesson.count({ where: { sectionId, deletedAt: null } });
  if (lessonCount > 0) throw new SectionNotEmptyError(lessonCount);

  await db.courseSection.delete({ where: { id: sectionId } });
  await recordAudit({
    userId: actor.id,
    action: "courses.deleteSection",
    entityType: "courseSection",
    entityId: sectionId,
  });
  revalidateTag("content", { expire: 0 });
}

// ─── Admin curriculum tree ───────────────────────────────────

export interface CurriculumLesson {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  sortOrder: number;
  isRequired: boolean;
  estimatedMinutes: number | null;
  hasBody: boolean;
  hasVideo: boolean;
  hasExternal: boolean;
  attachmentCount: number;
}

export interface CurriculumSection {
  id: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  sortOrder: number;
  lessons: CurriculumLesson[];
}

/**
 * The curriculum tab's whole data set in one read. Soft-deleted lessons are
 * excluded: a section that still holds one would otherwise look empty in the
 * tree while `deleteSection` refuses it, and a delete button that fails with
 * no visible cause is worse than no delete button.
 */
export async function loadCourseCurriculum(courseId: string): Promise<CurriculumSection[]> {
  const defaultLocale = await defaultLocaleCode();
  const sections = await db.courseSection.findMany({
    where: { courseId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      isPublished: true,
      sortOrder: true,
      translations: { select: { locale: true, title: true, description: true } },
      lessons: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          status: true,
          sortOrder: true,
          isRequired: true,
          estimatedMinutes: true,
          videoUrl: true,
          externalUrl: true,
          _count: { select: { attachments: true } },
          translations: { select: { locale: true, title: true, slug: true, content: true } },
        },
      },
    },
  });

  return sections.map((section) => {
    const sectionText =
      section.translations.find((t) => t.locale === defaultLocale) ?? section.translations[0];
    return {
      id: section.id,
      title: sectionText?.title ?? "",
      description: sectionText?.description ?? null,
      isPublished: section.isPublished,
      sortOrder: section.sortOrder,
      lessons: section.lessons.map((lesson) => {
        const text =
          lesson.translations.find((t) => t.locale === defaultLocale) ?? lesson.translations[0];
        return {
          id: lesson.id,
          title: text?.title ?? "",
          slug: text?.slug ?? "",
          status: lesson.status,
          sortOrder: lesson.sortOrder,
          isRequired: lesson.isRequired,
          estimatedMinutes: lesson.estimatedMinutes,
          hasBody: (text?.content ?? "").trim().length > 0,
          hasVideo: lesson.videoUrl !== null,
          hasExternal: lesson.externalUrl !== null,
          attachmentCount: lesson._count.attachments,
        };
      }),
    };
  });
}
