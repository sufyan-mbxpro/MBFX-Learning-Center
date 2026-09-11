"use server";

import { z } from "zod";
import {
  createGlossaryTerm,
  duplicateGlossaryTerm,
  saveGlossaryTerm,
  setGlossaryTermDeleted,
  transitionContentStatus,
} from "@repo/core";
import { createGlossaryTermSchema, saveGlossaryTermSchema } from "@repo/contracts";
import type { SaveGlossaryTermInput } from "@repo/contracts";
import { requirePermission } from "@repo/rbac";
import { parseScheduledFor } from "./scheduled-for.ts";

const id = z.string().min(1);

/**
 * `topicId` and `track` are optional and both may be null — the "New term"
 * dialog offers "Unfiled" and "Both schools" as real choices (ADR-069 §3).
 */
export async function createGlossaryTermAction(input: unknown = {}): Promise<string> {
  const subject = await requirePermission("glossary.create");
  const parsed = createGlossaryTermSchema.parse(input);
  return createGlossaryTerm(subject, parsed);
}

/**
 * The editor's one save (ADR-069 §1) — term-level fields and one locale's
 * translation, committed together.
 *
 * Parsed through the contract schema, never spread from the client's object
 * (security.md #6). `faq` in particular is a `Json?` column, so anything that
 * got past this line would be stored verbatim.
 */
export async function saveGlossaryTermAction(input: unknown): Promise<void> {
  const subject = await requirePermission("glossary.update");
  const parsed: SaveGlossaryTermInput = saveGlossaryTermSchema.parse(input);
  await saveGlossaryTerm(subject, parsed);
}

export async function transitionGlossaryAction(
  termId: string,
  to: string,
  scheduledForIso?: string,
): Promise<void> {
  // Base permission here; the PUBLISH-specific gate (glossary.publish) is
  // enforced inside the service against the same subject.
  const subject = await requirePermission("glossary.update");
  const status = z
    .enum(["DRAFT", "IN_REVIEW", "SEO_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED"])
    .parse(to);
  await transitionContentStatus(
    subject,
    "glossary",
    id.parse(termId),
    status,
    parseScheduledFor(scheduledForIso),
  );
}

export async function deleteGlossaryTermAction(termId: string, deleted: boolean): Promise<void> {
  const subject = await requirePermission("glossary.delete");
  await setGlossaryTermDeleted(subject, id.parse(termId), z.boolean().parse(deleted));
}

// `glossary.create`, not `glossary.update`: a duplicate mints a new term, and
// an actor who may only edit existing ones must not be able to (the line
// `duplicateLessonAction` and `duplicateQuizAction` already draw).
export async function duplicateGlossaryTermAction(termId: string): Promise<string> {
  const subject = await requirePermission("glossary.create");
  return duplicateGlossaryTerm(subject, id.parse(termId));
}
