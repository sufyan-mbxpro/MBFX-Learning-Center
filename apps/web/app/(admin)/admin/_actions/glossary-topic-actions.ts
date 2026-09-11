"use server";

// Glossary topic actions (changes-11 Phase 10, D27).
//
// Gate order per security.md #1: `requirePermission()` first, then the parse,
// then the `@repo/core` service.
//
// **Gated on the existing `glossary.*` keys**, because a topic IS glossary
// data — it has no separate audience, and inventing `glossaryTopics.*` would
// add three keys no role holds. The same reasoning ADR-058 #8 applied to
// quizzes, one section over.
import { z } from "zod";
import {
  createGlossaryTopic,
  deleteGlossaryTopic,
  duplicateGlossaryTopic,
  reorderGlossaryTopics,
  saveGlossaryTopic,
  setGlossaryTermTopic,
  setGlossaryTermTrack,
} from "@repo/core";
import {
  createGlossaryTopicSchema,
  glossaryTrackSchema,
  saveGlossaryTopicSchema,
} from "@repo/contracts";
import type { SaveGlossaryTopicInput } from "@repo/contracts";
import { requirePermission } from "@repo/rbac";

const id = z.string().min(1).max(64);

export async function createGlossaryTopicAction(name: string): Promise<string> {
  const subject = await requirePermission("glossary.create");
  return createGlossaryTopic(subject, createGlossaryTopicSchema.parse({ name }).name);
}

/**
 * The topic editor's one save (changes-18 PR 3).
 *
 * The schema moved to `@repo/contracts` — it used to be an inline `z.object`
 * here, capping `description` at 500 trimmed characters, which is wrong now
 * that the field is rich text: `.trim()` on markup is meaningless and 500
 * characters is a caption. Contracts own schemas (architecture.md #2); an
 * action parses and delegates.
 *
 * Flattened for the service, which takes one locale's fields alongside the
 * topic's own. The NESTED contract is what makes the editor's save atomic —
 * meta and translation arrive together or not at all — and the flattening is a
 * two-line adapter rather than a second shape anyone has to know about.
 */
export async function saveGlossaryTopicAction(input: unknown): Promise<void> {
  const subject = await requirePermission("glossary.update");
  const parsed: SaveGlossaryTopicInput = saveGlossaryTopicSchema.parse(input);
  await saveGlossaryTopic(subject, {
    topicId: parsed.topicId,
    ...parsed.translation,
    ...parsed.meta,
  });
}

// `glossary.create`, not `glossary.update` — a duplicate mints a topic.
export async function duplicateGlossaryTopicAction(topicId: string): Promise<string> {
  const subject = await requirePermission("glossary.create");
  return duplicateGlossaryTopic(subject, id.parse(topicId));
}

export async function deleteGlossaryTopicAction(topicId: string): Promise<void> {
  const subject = await requirePermission("glossary.delete");
  await deleteGlossaryTopic(subject, id.parse(topicId));
}

export async function reorderGlossaryTopicsAction(ids: string[]): Promise<void> {
  const subject = await requirePermission("glossary.update");
  await reorderGlossaryTopics(subject, z.array(id).max(200).parse(ids));
}

/** Filing a term under a topic edits the TERM, so it gates on the term's key. */
export async function setGlossaryTermTopicAction(
  termId: string,
  topicId: string | null,
): Promise<void> {
  const subject = await requirePermission("glossary.update");
  await setGlossaryTermTopic(subject, id.parse(termId), id.nullable().parse(topicId));
}

/** Same shape one field over: the term's track (ADR-065 §3), null = both schools. */
export async function setGlossaryTermTrackAction(
  termId: string,
  track: string | null,
): Promise<void> {
  const subject = await requirePermission("glossary.update");
  await setGlossaryTermTrack(subject, id.parse(termId), glossaryTrackSchema.parse(track));
}
