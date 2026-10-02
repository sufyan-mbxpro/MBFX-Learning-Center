// The Arabic step of `pnpm seed:live` (ADR-166): writes the `content-ar.ts`
// words beside the English rows the steps before it created.
//
// Unlike the rest of this script it writes translation rows directly rather
// than through `saveCourse`/`saveLesson`/`saveQuiz`/`saveVideoTopic`. Those
// services save a translation TOGETHER with the entity's meta, its
// attachments, its questions or its videos, and recreate those children on
// every save — a second save just to add a language would rewrite the
// English side's covers, attachments and question rows. What the services add
// that matters here is kept: every rich-text field goes through
// `sanitizeRichText`, the same sanitizer a save uses (security.md #8).
//
// `create`-only, matched by the ENGLISH slug: an existing Arabic row is
// somebody's and is left alone, and an English row an editor renamed is simply
// not found. Rows are TRANSLATED (a person's words, not a machine's) with a
// NULL `sourceHash` — unknown, ADR-161 #4, the same footing as the main seed's
// Arabic.
import { db } from "@repo/db";
import { seedArabicSettings } from "@repo/db/seed-settings-ar";

import { sanitizeRichText } from "../src/index.ts";
import { COURSES_AR, QUIZZES_AR, VIDEO_TOPICS_AR } from "./content-ar.ts";

const AR = "ar";

export interface ArabicLiveStats {
  courses: number;
  lessons: number;
  quizzes: number;
  videoTopics: number;
  /** Translatable settings (`site.description`, the legal lines, the header CTA). */
  settings: number;
}

export async function seedArabicLiveContent(sourceLocale: string): Promise<ArabicLiveStats> {
  const stats: ArabicLiveStats = {
    courses: 0,
    lessons: 0,
    quizzes: 0,
    videoTopics: 0,
    settings: 0,
  };

  for (const [slug, course] of Object.entries(COURSES_AR)) {
    const english = await db.courseTranslation.findUnique({
      where: { locale_slug: { locale: sourceLocale, slug } },
      select: { courseId: true },
    });
    if (!english) continue;
    const { courseId } = english;

    const courseTaken =
      (await db.courseTranslation.findFirst({
        where: { locale: AR, OR: [{ courseId }, { slug }] },
        select: { id: true },
      })) !== null;
    if (!courseTaken) {
      await db.courseTranslation.create({
        data: {
          courseId,
          locale: AR,
          title: course.title,
          slug,
          summary: course.summary,
          description: sanitizeRichText(course.description),
          seoTitle: course.seoTitle,
          seoDescription: course.seoDescription,
          seoFocusKeyword: course.keyword,
          translationStatus: "TRANSLATED",
        },
      });
      stats.courses += 1;
    }

    const sections = await db.courseSectionTranslation.findMany({
      where: { locale: sourceLocale, section: { courseId } },
      select: { sectionId: true, title: true },
    });
    for (const section of sections) {
      const words = course.sections[section.title];
      if (!words) continue;
      await db.courseSectionTranslation.upsert({
        where: { sectionId_locale: { sectionId: section.sectionId, locale: AR } },
        update: {},
        create: {
          sectionId: section.sectionId,
          locale: AR,
          title: words.title,
          description: words.description,
        },
      });
    }

    const lessons = await db.lessonTranslation.findMany({
      where: { locale: sourceLocale, lesson: { section: { courseId } } },
      select: { lessonId: true, slug: true },
    });
    for (const row of lessons) {
      const words = course.lessons[row.slug];
      if (!words) continue;
      const lessonTaken =
        (await db.lessonTranslation.findFirst({
          where: { locale: AR, OR: [{ lessonId: row.lessonId }, { slug: row.slug }] },
          select: { id: true },
        })) !== null;
      if (lessonTaken) continue;
      await db.lessonTranslation.create({
        data: {
          lessonId: row.lessonId,
          locale: AR,
          title: words.title,
          slug: row.slug,
          summary: words.summary,
          content: sanitizeRichText(words.content),
          learningObjectives: words.objectives,
          seoTitle: words.seoTitle,
          seoDescription: words.seoDescription,
          seoFocusKeyword: words.keyword,
          ...(words.attachmentLabels ? { attachmentLabels: words.attachmentLabels } : {}),
          translationStatus: "TRANSLATED",
        },
      });
      stats.lessons += 1;
    }
  }

  for (const [slug, quiz] of Object.entries(QUIZZES_AR)) {
    const english = await db.quizTranslation.findUnique({
      where: { locale_slug: { locale: sourceLocale, slug } },
      select: { quizId: true },
    });
    if (!english) continue;
    const { quizId } = english;

    const quizTaken =
      (await db.quizTranslation.findFirst({
        where: { locale: AR, OR: [{ quizId }, { slug }] },
        select: { id: true },
      })) !== null;
    if (!quizTaken) {
      await db.quizTranslation.create({
        data: {
          quizId,
          locale: AR,
          title: quiz.title,
          slug,
          description: quiz.description,
          translationStatus: "TRANSLATED",
        },
      });
      stats.quizzes += 1;
    }

    // Matched by POSITION; a question whose English options no longer line
    // up is skipped rather than labelled so the index points at the wrong one.
    const questions = await db.quizQuestion.findMany({
      where: { quizId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        translations: {
          where: { locale: { in: [sourceLocale, AR] } },
          select: { locale: true, options: true },
        },
      },
    });
    for (const [index, question] of questions.entries()) {
      const words = quiz.questions[index];
      if (!words) continue;
      if (question.translations.some((t) => t.locale === AR)) continue;
      const englishOptions = question.translations.find((t) => t.locale === sourceLocale)?.options;
      if (!Array.isArray(englishOptions) || englishOptions.length !== words.options.length)
        continue;
      await db.quizQuestionTranslation.create({
        data: {
          questionId: question.id,
          locale: AR,
          prompt: words.prompt,
          options: words.options,
          ...(words.explanations ? { explanations: words.explanations } : {}),
          translationStatus: "TRANSLATED",
        },
      });
    }
  }

  for (const [slug, topic] of Object.entries(VIDEO_TOPICS_AR)) {
    const english = await db.videoTopicTranslation.findUnique({
      where: { locale_slug: { locale: sourceLocale, slug } },
      select: { topicId: true },
    });
    if (!english) continue;
    const topicTaken =
      (await db.videoTopicTranslation.findFirst({
        where: { locale: AR, OR: [{ topicId: english.topicId }, { slug }] },
        select: { id: true },
      })) !== null;
    if (topicTaken) continue;
    await db.videoTopicTranslation.create({
      data: {
        topicId: english.topicId,
        locale: AR,
        title: topic.title,
        slug,
        summary: topic.summary,
        content: sanitizeRichText(topic.content),
        seoTitle: topic.seoTitle,
        seoDescription: topic.seoDescription,
        seoFocusKeyword: topic.keyword,
        ...(topic.linkLabels ? { linkLabels: topic.linkLabels } : {}),
        translationStatus: "TRANSLATED",
      },
    });
    stats.videoTopics += 1;
  }

  // The SAME words the main seed writes, imported rather than copied, so the
  // two seeders cannot drift. `create`-only like everything above.
  stats.settings = await seedArabicSettings(db);

  return stats;
}
