// The translatable SOURCE of a course, a course section and a lesson, and its
// hash (ADR-161, Phase 5) — `article-source.ts` for the learning area.
//
// One definition per entity, shared by the three places that must agree: a
// person saving the English row (whose hash the sweep compares against), a
// person saving another locale (which records the hash it was translated
// from), and the translation job (which decides whether a machine row is
// current and refuses to write over a source that moved).
//
// The hashes are WIDER than they were. A course had no hash at all (a sweep
// compared title/summary/description against the row being overwritten), and
// a lesson's covered only title + body, so an edited objective, FAQ answer or
// SEO line never marked a translation stale. Existing rows therefore mismatch
// once: a person's becomes OUTDATED on the next English save and a machine
// row is re-translated — the honest answer for text nobody compared, and the
// same one Phase 3 gave articles.
import { computeSourceHash } from "@repo/i18n";
import type { Prisma } from "@repo/db";

type Client = Pick<
  Prisma.TransactionClient,
  "courseTranslation" | "courseSectionTranslation" | "lessonTranslation" | "lessonAttachment"
>;

export interface FaqPair {
  question: string;
  answer: string;
}

/** A stored `faq` Json value as the question/answer pairs it holds. */
export function faqPairsOf(value: Prisma.JsonValue | null | undefined): FaqPair[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const { question, answer } = item as Record<string, unknown>;
    return typeof question === "string" && typeof answer === "string" && question && answer
      ? [{ question, answer }]
      : [];
  });
}

/** A stored string-array Json value (objectives), empty strings dropped. */
export function stringsOf(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "")
    : [];
}

// ─── Course ──────────────────────────────────────────────────

export interface CourseSource {
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  faq: FaqPair[];
}

export function hashCourseSource(s: CourseSource): string {
  return computeSourceHash(
    JSON.stringify([
      s.title,
      s.summary ?? "",
      s.description ?? "",
      s.seoTitle ?? "",
      s.seoDescription ?? "",
      s.faq.map((f) => [f.question, f.answer]),
    ]),
  );
}

export async function loadCourseSource(
  client: Pick<Client, "courseTranslation">,
  courseId: string,
  defaultLocale: string,
): Promise<CourseSource | null> {
  const row = await client.courseTranslation.findUnique({
    where: { courseId_locale: { courseId, locale: defaultLocale } },
    select: {
      slug: true,
      title: true,
      summary: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      faq: true,
      course: { select: { deletedAt: true } },
    },
  });
  if (!row || row.course.deletedAt) return null;
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    faq: faqPairsOf(row.faq),
  };
}

// ─── Course section ──────────────────────────────────────────

export interface SectionSource {
  title: string;
  description: string | null;
}

export function hashSectionSource(s: SectionSource): string {
  return computeSourceHash(JSON.stringify([s.title, s.description ?? ""]));
}

export async function loadSectionSource(
  client: Pick<Client, "courseSectionTranslation">,
  sectionId: string,
  defaultLocale: string,
): Promise<SectionSource | null> {
  const row = await client.courseSectionTranslation.findUnique({
    where: { sectionId_locale: { sectionId, locale: defaultLocale } },
    select: {
      title: true,
      description: true,
      section: { select: { course: { select: { deletedAt: true } } } },
    },
  });
  if (!row || row.section.course.deletedAt) return null;
  return { title: row.title, description: row.description };
}

// ─── Lesson ──────────────────────────────────────────────────

export interface LessonSource {
  slug: string;
  title: string;
  summary: string | null;
  content: string | null;
  objectives: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  /**
   * The distinct English attachment labels, in order (ADR-161 #8). They live
   * on `LessonAttachment`, which every save recreates, so their translations
   * live on the lesson's own translation row, keyed by the English text.
   */
  attachmentLabels: string[];
}

export function hashLessonSource(s: LessonSource): string {
  return computeSourceHash(
    JSON.stringify([
      s.title,
      s.summary ?? "",
      s.content ?? "",
      s.objectives,
      s.seoTitle ?? "",
      s.seoDescription ?? "",
      s.attachmentLabels,
    ]),
  );
}

export async function loadLessonSource(
  client: Pick<Client, "lessonTranslation" | "lessonAttachment">,
  lessonId: string,
  defaultLocale: string,
): Promise<LessonSource | null> {
  const [row, attachments] = await Promise.all([
    client.lessonTranslation.findUnique({
      where: { lessonId_locale: { lessonId, locale: defaultLocale } },
      select: {
        slug: true,
        title: true,
        summary: true,
        content: true,
        learningObjectives: true,
        seoTitle: true,
        seoDescription: true,
        lesson: { select: { deletedAt: true } },
      },
    }),
    client.lessonAttachment.findMany({
      where: { lessonId },
      orderBy: { sortOrder: "asc" },
      select: { label: true },
    }),
  ]);
  if (!row || row.lesson.deletedAt) return null;
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    content: row.content,
    objectives: stringsOf(row.learningObjectives),
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    attachmentLabels: [
      ...new Set(attachments.map((a) => a.label?.trim() ?? "").filter((label) => label !== "")),
    ],
  };
}

/**
 * A lesson attachment's label in a locale (ADR-161 #8): the translation keyed
 * by its English text, or the English text itself — the one place English may
 * appear on a translated page, because a missing label would hide the file.
 */
export function translatedLabel(
  label: string | null,
  map: Prisma.JsonValue | null | undefined,
): string | null {
  if (!label) return label;
  if (map && typeof map === "object" && !Array.isArray(map)) {
    const value = (map as Record<string, unknown>)[label.trim()];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return label;
}
