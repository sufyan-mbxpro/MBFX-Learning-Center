// Phase 5's exit for quizzes, on a real MariaDB with Google faked (MSW): a
// quiz and its questions are translated with every option kept in order, so a
// learner taking the quiz in Spanish is graded exactly as in English (plan §6
// Phase 5: "quiz scoring test green in all locales"). A person's translation
// is TRANSLATED and flagged when the English moves on; a machine one is
// refreshed.
import { ContentStatus } from "@repo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  startTranslationTestDb,
  useFakeGoogle,
  type TranslationTestContext,
} from "./test-utils/translation-container.ts";
import type * as QuizzesModule from "./quizzes.ts";
import type * as RunnerModule from "./translation-runner.ts";

let ctx: TranslationTestContext;
let quizzes: typeof QuizzesModule;
let runner: typeof RunnerModule;
let learner: string;

beforeAll(async () => {
  ctx = await startTranslationTestDb("mbfx_quiz_translation", [
    "lessons.create",
    "lessons.update",
    "lessons.publish",
    "quizzes.create",
    "quizzes.update",
    "quizzes.publish",
  ]);
  quizzes = await import("./quizzes.ts");
  runner = await import("./translation-runner.ts");
  learner = (
    await ctx.db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: "quiz-taker@x.com",
        name: "Learner",
        status: "ACTIVE",
        userType: "LEARNER",
      },
    })
  ).id;
}, 180_000);

afterAll(async () => {
  await ctx?.stop();
});

beforeEach(() => {
  useFakeGoogle(ctx.server);
});

const QUESTIONS = [
  {
    type: "SINGLE_CHOICE" as const,
    options: ["A fee", "A price move", "A lot size"],
    correctAnswer: 1,
  },
  { type: "MULTIPLE_CHOICE" as const, options: ["Euro", "Dollar", "Gold"], correctAnswer: [0, 1] },
  { type: "TRUE_FALSE" as const, options: ["True", "False"], correctAnswer: 0 },
];

let seq = 0;

async function makeQuiz() {
  seq += 1;
  const quizId = await quizzes.createQuiz(ctx.editor, { title: `Pips ${seq}`, track: "forex" });
  const input = (locale: string, words: (text: string) => string, ids: string[] = []) => ({
    quizId,
    meta: {
      passingScore: 100,
      maxAttempts: null,
      showAnswersAfter: "AFTER_SUBMIT" as const,
      isStandalone: true,
      category: null,
    },
    translation: { locale, title: words(`Pips ${seq}`), description: words("Test yourself.") },
    questions: QUESTIONS.map((question, index) => ({
      ...(ids[index] ? { id: ids[index] } : {}),
      type: question.type,
      sortOrder: index,
      points: 1,
      prompt: words(`Question ${index}`),
      options: question.options.map(words),
      explanations: question.options.map((_, o) => (o === 0 ? words("Because.") : "")),
      correctAnswer: question.correctAnswer,
    })),
  });
  await quizzes.saveQuiz(
    ctx.editor,
    input("en", (t) => t),
  );
  await quizzes.setQuizStatus(ctx.editor, quizId, ContentStatus.PUBLISHED);
  const detail = await quizzes.getQuizAdmin(quizId, "en");
  const questionIds = (detail?.questions ?? []).map((q) => q.id);
  const slug = (await ctx.db.quizTranslation.findFirstOrThrow({ where: { quizId, locale: "en" } }))
    .slug;
  return { quizId, questionIds, slug, input };
}

describe("quizzes", () => {
  it("translates every question keeping each option in its place", async () => {
    const { quizId, questionIds } = await makeQuiz();
    await runner.runQuizTranslationWork(quizId);

    expect(
      await ctx.db.quizTranslation.findFirstOrThrow({ where: { quizId, locale: "es" } }),
    ).toMatchObject({ title: `[es] Pips ${seq}`, translationStatus: "MACHINE_TRANSLATED" });
    for (const [index, questionId] of questionIds.entries()) {
      const es = await ctx.db.quizQuestionTranslation.findFirstOrThrow({
        where: { questionId, locale: "es" },
      });
      expect(es.translationStatus).toBe("MACHINE_TRANSLATED");
      expect(es.options).toEqual(QUESTIONS[index]!.options.map((o) => `[es] ${o}`));
      expect(es.explanations).toEqual(
        QUESTIONS[index]!.options.map((_, o) => (o === 0 ? "[es] Because." : "")),
      );
    }
  });

  it("grades a learner taking it in Spanish exactly as in English", async () => {
    const { quizId, questionIds, slug } = await makeQuiz();
    await runner.runQuizTranslationWork(quizId);

    const view = await quizzes.loadQuizBySlug("es", slug);
    expect(view?.title).toBe(`[es] Pips ${seq}`);
    // The option each answer index names is the translation of the right one.
    for (const [index, question] of (view?.questions ?? []).entries()) {
      const correct = QUESTIONS[index]!.correctAnswer;
      for (const i of Array.isArray(correct) ? correct : [correct]) {
        expect(question.options[i]).toBe(`[es] ${QUESTIONS[index]!.options[i]}`);
      }
    }

    const attempt = await quizzes.startQuizAttempt(learner, quizId);
    for (const [index, questionId] of questionIds.entries()) {
      await quizzes.recordQuizAnswer(
        learner,
        attempt.id,
        questionId,
        QUESTIONS[index]!.correctAnswer,
      );
    }
    const result = await quizzes.submitQuizAttempt(learner, attempt.id, "es");
    // Every point, graded by index against the English answer key.
    expect(result).toMatchObject({ score: QUESTIONS.length, passed: true });
    expect(result.review?.[0]?.explanations[0]).toBe("[es] Because.");
  });

  it("a person's Spanish save is TRANSLATED; an English option change flags it and refreshes a machine question", async () => {
    const { quizId, questionIds, input } = await makeQuiz();
    await runner.runQuizTranslationWork(quizId);

    // A person reviews the whole quiz in Spanish — same structure, their words.
    await quizzes.saveQuiz(
      ctx.editor,
      input("es", (t) => `ES ${t}`, questionIds),
    );
    const personal = await ctx.db.quizQuestionTranslation.findFirstOrThrow({
      where: { questionId: questionIds[0]!, locale: "es" },
    });
    expect(personal.translationStatus).toBe("TRANSLATED");
    // Then only the second question is handed back to the machine.
    await ctx.db.quizQuestionTranslation.updateMany({
      where: { questionId: questionIds[1]!, locale: "es" },
      data: { translationStatus: "MACHINE_TRANSLATED" },
    });

    const edited = input(
      "en",
      (t) => t.replace("Euro", "Yen").replace("A fee", "A charge"),
      questionIds,
    );
    await quizzes.saveQuiz(ctx.editor, edited);
    await runner.runQuizTranslationWork(quizId);

    const first = await ctx.db.quizQuestionTranslation.findFirstOrThrow({
      where: { questionId: questionIds[0]!, locale: "es" },
    });
    expect(first.translationStatus).toBe("OUTDATED");
    expect((first.options as string[])[0]).toBe("ES A fee");
    const second = await ctx.db.quizQuestionTranslation.findFirstOrThrow({
      where: { questionId: questionIds[1]!, locale: "es" },
    });
    expect(second).toMatchObject({ translationStatus: "MACHINE_TRANSLATED" });
    expect(second.options).toEqual(["[es] Yen", "[es] Dollar", "[es] Gold"]);
  });
});
