// The translatable SOURCE of a quiz and of each of its questions, and their
// hashes (ADR-161, Phase 5).
//
// **A question's options are an ORDERED list whose indexes are the answer
// key.** `QuizQuestion.correctAnswer` holds option INDEXES and lives on the
// question, not on a translation (ADR-058), and grading never reads a
// translated option. So a translation must have exactly as many options as the
// English, in the same order — `buildQuestionTranslation` is the one place that
// shape is built, and `quiz-source.test.ts` pins it. Explanations are
// index-aligned with the options and sparse ("" = none), and stay sparse.
//
// `Quiz.category` is free text on the quiz row with no per-locale copy; it is
// not translated here (plan §7 open item 2).
import { computeSourceHash } from "@repo/i18n";
import type { Prisma } from "@repo/db";

export interface QuizSource {
  slug: string;
  title: string;
  description: string | null;
}

export function hashQuizSource(s: QuizSource): string {
  return computeSourceHash(JSON.stringify([s.title, s.description ?? ""]));
}

export async function loadQuizSource(
  client: Pick<Prisma.TransactionClient, "quizTranslation">,
  quizId: string,
  defaultLocale: string,
): Promise<QuizSource | null> {
  const row = await client.quizTranslation.findUnique({
    where: { quizId_locale: { quizId, locale: defaultLocale } },
    select: { slug: true, title: true, description: true, quiz: { select: { deletedAt: true } } },
  });
  if (!row || row.quiz.deletedAt) return null;
  return { slug: row.slug, title: row.title, description: row.description };
}

export interface QuizQuestionSource {
  prompt: string;
  options: string[];
  /** Index-aligned with `options`; "" means no explanation for that option. */
  explanations: string[];
}

function stringArray(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.map((v) => (typeof v === "string" ? v : "")) : [];
}

export function hashQuizQuestionSource(s: QuizQuestionSource): string {
  return computeSourceHash(JSON.stringify([s.prompt, s.options, s.explanations]));
}

export async function loadQuizQuestionSource(
  client: Pick<Prisma.TransactionClient, "quizQuestionTranslation">,
  questionId: string,
  defaultLocale: string,
): Promise<QuizQuestionSource | null> {
  const row = await client.quizQuestionTranslation.findUnique({
    where: { questionId_locale: { questionId, locale: defaultLocale } },
    select: {
      prompt: true,
      options: true,
      explanations: true,
      question: { select: { quiz: { select: { deletedAt: true } } } },
    },
  });
  if (!row || row.question.quiz.deletedAt) return null;
  return {
    prompt: row.prompt,
    options: stringArray(row.options),
    explanations: stringArray(row.explanations),
  };
}

/**
 * A question's translated words, in the SOURCE's shape: one option per source
 * option, in the same order, so every `correctAnswer` index still names the
 * same choice. A blank result keeps the English option rather than leaving a
 * choice with no words (a blank option would be dropped by the reader and
 * shift every index after it). A blank source explanation stays blank.
 */
export function buildQuestionTranslation(
  source: QuizQuestionSource,
  translated: Readonly<Record<string, string>>,
): QuizQuestionSource {
  return {
    prompt: translated.prompt?.trim() ? translated.prompt : source.prompt,
    options: source.options.map((option, i) => {
      const value = translated[`opt.${i}`];
      return value && value.trim() !== "" ? value : option;
    }),
    explanations: source.explanations.map((explanation, i) =>
      explanation.trim() === "" ? "" : (translated[`exp.${i}`] ?? explanation),
    ),
  };
}
