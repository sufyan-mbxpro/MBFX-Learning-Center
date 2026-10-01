// Machine translation of quizzes and their questions (Phase 5, ADR-161/162).
// A question's options keep their count and order exactly — see
// `buildQuestionTranslation` in `quiz-source.ts` for why that is the whole
// safety of the feature.
import type { Prisma } from "@repo/db";

import {
  buildQuestionTranslation,
  hashQuizQuestionSource,
  hashQuizSource,
  loadQuizQuestionSource,
  loadQuizSource,
  type QuizQuestionSource,
  type QuizSource,
} from "./quiz-source.ts";
import { defineTranslatable, pickTranslationSlug, type Segment } from "./translation-engine.ts";
import { TRANSLATION_TABLES } from "./translation-queue.ts";

export const quizTranslatable = defineTranslatable<QuizSource>({
  entityType: "quiz",
  ...TRANSLATION_TABLES.quiz,
  parentTable: "quizzes",
  parentWhere: "p.deletedAt IS NULL",
  titleColumn: "title",
  updatedAtColumn: "updatedAt",
  loadSource: loadQuizSource,
  hash: hashQuizSource,
  segments: (s) => [
    { key: "title", kind: "text", text: s.title, max: 255 },
    { key: "description", kind: "text", text: s.description ?? "", max: 2000 },
  ],
  async write(tx, { entityId, locale, source, translated: t, status, hash, exists }) {
    const data = {
      title: t.title ?? source.title,
      description:
        source.description === null || source.description.trim() === ""
          ? null
          : (t.description ?? null),
      translationStatus: status,
      sourceHash: hash,
    };
    if (exists) {
      await tx.quizTranslation.update({
        where: { quizId_locale: { quizId: entityId, locale } },
        data,
      });
    } else {
      await tx.quizTranslation.create({
        data: {
          quizId: entityId,
          locale,
          slug: await pickTranslationSlug(
            tx,
            TRANSLATION_TABLES.quiz,
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

function questionSegments(s: QuizQuestionSource): Segment[] {
  return [
    { key: "prompt", kind: "text", text: s.prompt },
    ...s.options.map((text, i): Segment => ({ key: `opt.${i}`, kind: "text", text })),
    ...s.explanations.map((text, i): Segment => ({ key: `exp.${i}`, kind: "text", text })),
  ];
}

export const quizQuestionTranslatable = defineTranslatable<QuizQuestionSource>({
  entityType: "quiz_question",
  ...TRANSLATION_TABLES.quiz_question,
  parentTable: "quiz_questions",
  parentWhere: "p.quizId IN (SELECT id FROM quizzes WHERE deletedAt IS NULL)",
  titleColumn: "prompt",
  updatedAtColumn: "updatedAt",
  loadSource: loadQuizQuestionSource,
  hash: hashQuizQuestionSource,
  segments: questionSegments,
  async write(tx, { entityId, locale, source, translated, status, hash }) {
    const words = buildQuestionTranslation(source, translated);
    const data = {
      prompt: words.prompt,
      options: words.options as Prisma.InputJsonValue,
      explanations: words.explanations as Prisma.InputJsonValue,
      translationStatus: status,
      sourceHash: hash,
    };
    await tx.quizQuestionTranslation.upsert({
      where: { questionId_locale: { questionId: entityId, locale } },
      update: data,
      create: { questionId: entityId, locale, ...data },
    });
  },
});
