// Machine translation of courses, course sections and lessons (Phase 5,
// ADR-161/162): the engine's protocol, with what is particular to each —
// which fields are sent, and how a result is written back.
import { DbNull, type Prisma } from "@repo/db";

import {
  hashCourseSource,
  hashLessonSource,
  hashSectionSource,
  loadCourseSource,
  loadLessonSource,
  loadSectionSource,
  type CourseSource,
  type LessonSource,
  type SectionSource,
} from "./learn-source.ts";
import {
  defineTranslatable,
  pickTranslationSlug,
  type Segment,
  type Translated,
} from "./translation-engine.ts";
import { TRANSLATION_TABLES } from "./translation-queue.ts";

/** Column and contract widths a translated value must fit. */
const MAX = {
  title: 255,
  seoTitle: 70,
  seoDescription: 180,
  question: 300,
  answer: 5000,
  sectionDescription: 1000,
  objective: 300,
  label: 200,
} as const;

const orNull = (original: string | null, value: string | undefined) =>
  original === null || original.trim() === "" ? null : (value ?? null);

// ─── Course ──────────────────────────────────────────────────

function courseSegments(s: CourseSource): Segment[] {
  return [
    { key: "title", kind: "text", text: s.title, max: MAX.title },
    { key: "summary", kind: "text", text: s.summary ?? "" },
    { key: "description", kind: "html", text: s.description ?? "" },
    { key: "seoTitle", kind: "text", text: s.seoTitle ?? "", max: MAX.seoTitle },
    { key: "seoDescription", kind: "text", text: s.seoDescription ?? "", max: MAX.seoDescription },
    ...s.faq.flatMap((f, i): Segment[] => [
      { key: `faq.${i}.q`, kind: "text", text: f.question, max: MAX.question },
      { key: `faq.${i}.a`, kind: "text", text: f.answer, max: MAX.answer },
    ]),
  ];
}

export const courseTranslatable = defineTranslatable<CourseSource>({
  entityType: "course",
  ...TRANSLATION_TABLES.course,
  parentTable: "courses",
  parentWhere: "p.deletedAt IS NULL",
  titleColumn: "title",
  updatedAtColumn: "updatedAt",
  loadSource: loadCourseSource,
  hash: hashCourseSource,
  segments: courseSegments,
  async write(tx, { entityId, locale, source, translated: t, status, hash, exists }) {
    const data = {
      title: t.title ?? source.title,
      summary: orNull(source.summary, t.summary),
      description: orNull(source.description, t.description),
      seoTitle: orNull(source.seoTitle, t.seoTitle),
      seoDescription: orNull(source.seoDescription, t.seoDescription),
      faq:
        source.faq.length > 0
          ? (source.faq.map((_, i) => ({
              question: t[`faq.${i}.q`] ?? "",
              answer: t[`faq.${i}.a`] ?? "",
            })) as Prisma.InputJsonValue)
          : DbNull,
      translationStatus: status,
      sourceHash: hash,
      translatedBy: null,
    };
    if (exists) {
      await tx.courseTranslation.update({
        where: { courseId_locale: { courseId: entityId, locale } },
        data,
      });
    } else {
      await tx.courseTranslation.create({
        data: {
          courseId: entityId,
          locale,
          slug: await pickTranslationSlug(
            tx,
            TRANSLATION_TABLES.course,
            entityId,
            locale,
            source.slug,
          ),
          ...data,
        },
      });
    }
  },
});

// ─── Course section ──────────────────────────────────────────

export const sectionTranslatable = defineTranslatable<SectionSource>({
  entityType: "course_section",
  ...TRANSLATION_TABLES.course_section,
  parentTable: "course_sections",
  parentWhere: "p.courseId IN (SELECT id FROM courses WHERE deletedAt IS NULL)",
  titleColumn: "title",
  loadSource: loadSectionSource,
  hash: hashSectionSource,
  segments: (s) => [
    { key: "title", kind: "text", text: s.title, max: MAX.title },
    {
      key: "description",
      kind: "text",
      text: s.description ?? "",
      max: MAX.sectionDescription,
    },
  ],
  async write(tx, { entityId, locale, source, translated: t, status, hash }) {
    const data = {
      title: t.title ?? source.title,
      description: orNull(source.description, t.description),
      translationStatus: status,
      sourceHash: hash,
    };
    await tx.courseSectionTranslation.upsert({
      where: { sectionId_locale: { sectionId: entityId, locale } },
      update: data,
      create: { sectionId: entityId, locale, ...data },
    });
  },
});

// ─── Lesson ──────────────────────────────────────────────────

function lessonSegments(s: LessonSource): Segment[] {
  return [
    { key: "title", kind: "text", text: s.title, max: MAX.title },
    { key: "summary", kind: "text", text: s.summary ?? "" },
    { key: "content", kind: "html", text: s.content ?? "" },
    { key: "seoTitle", kind: "text", text: s.seoTitle ?? "", max: MAX.seoTitle },
    { key: "seoDescription", kind: "text", text: s.seoDescription ?? "", max: MAX.seoDescription },
    ...s.objectives.map((text, i): Segment => ({
      key: `obj.${i}`,
      kind: "text",
      text,
      max: MAX.objective,
    })),
    ...s.attachmentLabels.map((text, i): Segment => ({
      key: `label.${i}`,
      kind: "text",
      text,
      max: MAX.label,
    })),
  ];
}

/** English label → translation, for `LessonTranslation.attachmentLabels`. */
function labelMap(labels: readonly string[], t: Translated): Prisma.InputJsonValue | typeof DbNull {
  if (labels.length === 0) return DbNull;
  return Object.fromEntries(labels.map((label, i) => [label, t[`label.${i}`] || label]));
}

export const lessonTranslatable = defineTranslatable<LessonSource>({
  entityType: "lesson",
  ...TRANSLATION_TABLES.lesson,
  parentTable: "lessons",
  parentWhere: "p.deletedAt IS NULL",
  titleColumn: "title",
  updatedAtColumn: "updatedAt",
  loadSource: loadLessonSource,
  hash: hashLessonSource,
  segments: lessonSegments,
  async write(tx, { entityId, locale, source, translated: t, status, hash, exists }) {
    const data = {
      title: t.title ?? source.title,
      summary: orNull(source.summary, t.summary),
      content: orNull(source.content, t.content),
      learningObjectives:
        source.objectives.length > 0
          ? (source.objectives.map((_, i) => t[`obj.${i}`] ?? "") as Prisma.InputJsonValue)
          : DbNull,
      seoTitle: orNull(source.seoTitle, t.seoTitle),
      seoDescription: orNull(source.seoDescription, t.seoDescription),
      attachmentLabels: labelMap(source.attachmentLabels, t),
      translationStatus: status,
      sourceHash: hash,
      translatedBy: null,
    };
    if (exists) {
      await tx.lessonTranslation.update({
        where: { lessonId_locale: { lessonId: entityId, locale } },
        data,
      });
    } else {
      await tx.lessonTranslation.create({
        data: {
          lessonId: entityId,
          locale,
          slug: await pickTranslationSlug(
            tx,
            TRANSLATION_TABLES.lesson,
            entityId,
            locale,
            source.slug,
          ),
          ...data,
        },
      });
    }
  },
});
