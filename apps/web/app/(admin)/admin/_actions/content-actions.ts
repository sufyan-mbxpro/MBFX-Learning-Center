"use server";

import { z } from "zod";
import {
  createGlossaryTerm,
  saveGlossaryTranslation,
  setGlossaryTermDeleted,
  transitionContentStatus,
} from "@repo/core";
import { requirePermission } from "@repo/rbac";

const id = z.string().min(1);

export async function createGlossaryTermAction(): Promise<string> {
  const subject = await requirePermission("glossary.create");
  return createGlossaryTerm(subject);
}

export async function saveGlossaryTranslationAction(input: {
  termId: string;
  locale: string;
  term: string;
  slug?: string;
  simpleExplanation: string;
}): Promise<void> {
  const subject = await requirePermission("glossary.update");
  const parsed = z
    .object({
      termId: id,
      locale: z.string().min(2).max(10),
      term: z.string().min(1).max(150),
      slug: z.string().max(150).optional(),
      simpleExplanation: z.string().min(1),
    })
    .parse(input);
  await saveGlossaryTranslation(subject, parsed);
}

export async function transitionGlossaryAction(termId: string, to: string): Promise<void> {
  // Base permission here; the PUBLISH-specific gate (glossary.publish) is
  // enforced inside the service against the same subject.
  const subject = await requirePermission("glossary.update");
  const status = z
    .enum(["DRAFT", "IN_REVIEW", "SEO_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED"])
    .parse(to);
  await transitionContentStatus(subject, "glossary", id.parse(termId), status);
}

export async function deleteGlossaryTermAction(termId: string, deleted: boolean): Promise<void> {
  const subject = await requirePermission("glossary.delete");
  await setGlossaryTermDeleted(subject, id.parse(termId), z.boolean().parse(deleted));
}
