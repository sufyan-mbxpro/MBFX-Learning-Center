"use server";

// Learning area actions (Module 11, changes-11 Phase 3; ADR-055/ADR-056).
//
// Gate order per security.md #1: `requirePermission()` is the FIRST line of
// every function here, then the contract parse, then the @repo/core service.
// The services add the gating that depends on the ROW rather than the request
// — publishing goes through `transitionContentStatus`, which requires
// `courses.publish` / `lessons.publish` on top of what was required here.
//
// Sections deliberately have no permission key of their own (course-sections.ts
// records why): editing a curriculum IS editing the course, so every section
// action gates on `courses.update`.
import { z } from "zod";
import {
  createCourse,
  createLesson,
  createSection,
  deleteSection,
  duplicateLesson,
  moveLesson,
  reorderCourses,
  reorderLessons,
  reorderSections,
  saveCourse,
  saveLesson,
  saveSection,
  setCourseDeleted,
  setCourseStatus,
  setLessonAttachments,
  setLessonDeleted,
  setLessonStatus,
} from "@repo/core";
import {
  contentStatusSchema,
  courseInputSchema,
  createCourseSchema,
  createLessonSchema,
  lessonAttachmentsSchema,
  lessonInputSchema,
  moveLessonSchema,
  reorderLessonsSchema,
  reorderSchema,
  reorderSectionsSchema,
  sectionInputSchema,
  type CourseInput,
  type CreateCourseInput,
  type CreateLessonInput,
  type LessonAttachmentsInput,
  type LessonInput,
  type MoveLessonInput,
  type ReorderLessonsInput,
  type ReorderSectionsInput,
  type SectionInput,
} from "@repo/contracts";
import { requirePermission } from "@repo/rbac";
import { parseScheduledFor } from "./scheduled-for.ts";

const id = z.string().min(1);

// ─── Courses ─────────────────────────────────────────────────

export async function createCourseAction(input: CreateCourseInput): Promise<string> {
  const subject = await requirePermission("courses.create");
  return createCourse(subject, createCourseSchema.parse(input));
}

export async function saveCourseAction(input: CourseInput): Promise<void> {
  const subject = await requirePermission("courses.update");
  await saveCourse(subject, courseInputSchema.parse(input));
}

export async function setCourseStatusAction(
  courseId: string,
  to: string,
  scheduledForIso?: string,
): Promise<void> {
  // Base gate here; the publish-specific `courses.publish` check lives inside
  // `transitionContentStatus` against this same subject — article-actions.ts
  // established the split.
  const subject = await requirePermission("courses.update");
  await setCourseStatus(
    subject,
    id.parse(courseId),
    contentStatusSchema.parse(to),
    parseScheduledFor(scheduledForIso),
  );
}

export async function setCourseDeletedAction(courseId: string, deleted: boolean): Promise<void> {
  const subject = await requirePermission("courses.delete");
  await setCourseDeleted(subject, id.parse(courseId), z.boolean().parse(deleted));
}

export async function reorderCoursesAction(ids: string[]): Promise<void> {
  const subject = await requirePermission("courses.update");
  await reorderCourses(subject, reorderSchema.parse({ ids }).ids);
}

// ─── Sections ────────────────────────────────────────────────

export async function createSectionAction(courseId: string, title?: string): Promise<string> {
  const subject = await requirePermission("courses.update");
  return createSection(
    subject,
    id.parse(courseId),
    title === undefined ? undefined : z.string().trim().min(1).max(255).parse(title),
  );
}

export async function saveSectionAction(input: SectionInput): Promise<void> {
  const subject = await requirePermission("courses.update");
  await saveSection(subject, sectionInputSchema.parse(input));
}

export async function reorderSectionsAction(input: ReorderSectionsInput): Promise<void> {
  const subject = await requirePermission("courses.update");
  const parsed = reorderSectionsSchema.parse(input);
  await reorderSections(subject, parsed.courseId, parsed.sectionIds);
}

export async function deleteSectionAction(sectionId: string): Promise<void> {
  const subject = await requirePermission("courses.update");
  await deleteSection(subject, id.parse(sectionId));
}

// ─── Lessons ─────────────────────────────────────────────────

export async function createLessonAction(input: CreateLessonInput): Promise<string> {
  const subject = await requirePermission("lessons.create");
  return createLesson(subject, createLessonSchema.parse(input));
}

export async function saveLessonAction(input: LessonInput): Promise<void> {
  const subject = await requirePermission("lessons.update");
  await saveLesson(subject, lessonInputSchema.parse(input));
}

export async function setLessonAttachmentsAction(input: LessonAttachmentsInput): Promise<void> {
  const subject = await requirePermission("lessons.update");
  const parsed = lessonAttachmentsSchema.parse(input);
  await setLessonAttachments(subject, parsed.lessonId, parsed.items);
}

export async function moveLessonAction(input: MoveLessonInput): Promise<void> {
  const subject = await requirePermission("lessons.update");
  const parsed = moveLessonSchema.parse(input);
  await moveLesson(subject, parsed.lessonId, parsed.toSectionId, parsed.index);
}

export async function reorderLessonsAction(input: ReorderLessonsInput): Promise<void> {
  const subject = await requirePermission("lessons.update");
  const parsed = reorderLessonsSchema.parse(input);
  await reorderLessons(subject, parsed.sectionId, parsed.lessonIds);
}

export async function duplicateLessonAction(lessonId: string): Promise<string> {
  const subject = await requirePermission("lessons.create");
  return duplicateLesson(subject, id.parse(lessonId));
}

export async function setLessonDeletedAction(lessonId: string, deleted: boolean): Promise<void> {
  const subject = await requirePermission("lessons.delete");
  await setLessonDeleted(subject, id.parse(lessonId), z.boolean().parse(deleted));
}

export async function setLessonStatusAction(
  lessonId: string,
  to: string,
  scheduledForIso?: string,
): Promise<void> {
  const subject = await requirePermission("lessons.update");
  await setLessonStatus(
    subject,
    id.parse(lessonId),
    contentStatusSchema.parse(to),
    parseScheduledFor(scheduledForIso),
  );
}
