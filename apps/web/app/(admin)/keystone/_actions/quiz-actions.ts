"use server";

// Quiz actions (Module 11, changes-11 Phase 6; ADR-058).
//
// Same gate order as `learn-actions.ts` (security.md #1): `requirePermission()`
// first, then the contract parse, then the `@repo/core` service.
//
// **Every one of these gates on a `lessons.*` key** — ADR-058 #8. There is no
// `quizzes.*` group in the seed registry and `changes-11-plan.md` §18 rule #3
// forbids inventing one; a quiz is authored beside the lessons it belongs to,
// by the same people, so `lessons.update` is the honest key rather than a
// convenient one. Publishing adds `lessons.publish` inside
// `transitionContentStatus`, via the entity→permission map in `content.ts`.
//
// The named cost is in the ADR: quiz authorship cannot be granted separately
// from lesson authorship until someone actually needs that.
import { z } from "zod";
import { createQuiz, duplicateQuiz, saveQuiz, setQuizDeleted, setQuizStatus } from "@repo/core";
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
export async function createQuizAction(input: CreateQuizInput): Promise<string> {
  const subject = await requirePermission("lessons.create");
  return createQuiz(subject, createQuizSchema.parse(input));
}

export async function saveQuizAction(input: QuizInput): Promise<void> {
  const subject = await requirePermission("lessons.update");
  await saveQuiz(subject, quizInputSchema.parse(input));
}

export async function setQuizStatusAction(
  quizId: string,
  to: string,
  scheduledForIso?: string,
): Promise<void> {
  const subject = await requirePermission("lessons.update");
  await setQuizStatus(
    subject,
    id.parse(quizId),
    contentStatusSchema.parse(to),
    parseScheduledFor(scheduledForIso),
  );
}

export async function setQuizDeletedAction(quizId: string, deleted: boolean): Promise<void> {
  const subject = await requirePermission("lessons.delete");
  await setQuizDeleted(subject, id.parse(quizId), deleted);
}

// `lessons.create`, not `lessons.update`: a duplicate makes a new quiz, and
// the actor who may only edit an existing one must not be able to mint one
// (`duplicateLessonAction` draws the same line).
export async function duplicateQuizAction(quizId: string): Promise<string> {
  const subject = await requirePermission("lessons.create");
  return duplicateQuiz(subject, id.parse(quizId));
}
