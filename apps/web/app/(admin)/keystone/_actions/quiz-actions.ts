"use server";

// Quiz actions (Module 11, changes-11 Phase 6; ADR-058).
//
// Same gate order as `learn-actions.ts` (security.md #1): `requirePermission()`
// first, then the contract parse, then the `@repo/core` service.
//
// Every one of these gates on a `quizzes.*` key (ADR-177, superseding
// ADR-058 #8, which had them on the lesson keys). Publishing adds
// `quizzes.publish` inside `transitionContentStatus`, via the
// entity→permission map in `content.ts`.
import { z } from "zod";
import { after } from "next/server";
import {
  createQuiz,
  duplicateQuiz,
  runQuizTranslationWork,
  saveQuiz,
  setQuizDeleted,
  setQuizStatus,
} from "@repo/core";
import {
  contentStatusSchema,
  createQuizSchema,
  quizInputSchema,
  type CreateQuizInput,
  type QuizInput,
} from "@repo/contracts";
import { requirePermission } from "@repo/rbac";
import { parseScheduledFor } from "./scheduled-for.ts";

const id = z.string().min(1);

/**
 * ADR-162 #7 for a quiz: after the response, drain the quiz's jobs AND each
 * question's, because a quiz is offered in a language only once every
 * question has a row there. Never throws; does nothing on a one-language site.
 */
function translateQuizSoon(quizId: string): void {
  after(() => runQuizTranslationWork(quizId));
}

export async function createQuizAction(input: CreateQuizInput): Promise<string> {
  const subject = await requirePermission("quizzes.create");
  const quizId = await createQuiz(subject, createQuizSchema.parse(input));
  translateQuizSoon(quizId);
  return quizId;
}

export async function saveQuizAction(input: QuizInput): Promise<void> {
  const subject = await requirePermission("quizzes.update");
  const parsed = quizInputSchema.parse(input);
  await saveQuiz(subject, parsed);
  translateQuizSoon(parsed.quizId);
}

export async function setQuizStatusAction(
  quizId: string,
  to: string,
  scheduledForIso?: string,
): Promise<void> {
  const subject = await requirePermission("quizzes.update");
  await setQuizStatus(
    subject,
    id.parse(quizId),
    contentStatusSchema.parse(to),
    parseScheduledFor(scheduledForIso),
  );
  translateQuizSoon(quizId);
}

export async function setQuizDeletedAction(quizId: string, deleted: boolean): Promise<void> {
  const subject = await requirePermission("quizzes.delete");
  await setQuizDeleted(subject, id.parse(quizId), deleted);
  if (!deleted) translateQuizSoon(quizId);
}

// `lessons.create`, not `lessons.update`: a duplicate makes a new quiz, and
// the actor who may only edit an existing one must not be able to mint one
// (`duplicateLessonAction` draws the same line).
export async function duplicateQuizAction(quizId: string): Promise<string> {
  const subject = await requirePermission("quizzes.create");
  const copyId = await duplicateQuiz(subject, id.parse(quizId));
  translateQuizSoon(copyId);
  return copyId;
}
