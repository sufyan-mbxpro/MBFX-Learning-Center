"use server";

// Video actions (changes-16 PRs 4–6, ADR-068).
//
// Gate order per security.md #1: `requirePermission()` first, then the parse,
// then the `@repo/core` service. Nothing here touches Prisma
// (architecture.md #2).
//
// **Gated on the existing `lessons.*` keys** (ADR-068 §3). This is the third
// content type to make that call — quizzes (ADR-058 #8) and glossary topics
// (D27) made it first, for the same reason: five `videos.*` keys with no
// seeded role behind them is a silent 403 waiting to happen, and
// `check:permission-keys` exists to catch exactly that. The named cost is that
// video authorship cannot be granted apart from lesson authorship.
//
// Every export must be async — a sync helper in a `"use server"` module takes
// the whole app down at compile time (DEVLOG 2026-09-09,
// `use-server-exports.test.ts`). Shared helpers belong in `_lib/`.
import { z } from "zod";
import {
  createVideoTopic,
  deleteVideoCategory,
  reorderVideoCategories,
  saveVideoCategory,
  saveVideoTopic,
  setVideoCategoryActive,
  setVideoTopicDeleted,
  transitionContentStatus,
} from "@repo/core";
import {
  contentStatusSchema,
  createVideoTopicSchema,
  reorderVideoCategoriesSchema,
  videoCategoryInputSchema,
  videoTopicInputSchema,
} from "@repo/contracts";
import { requirePermission } from "@repo/rbac";
import { parseScheduledFor } from "./scheduled-for.ts";

const id = z.string().min(1).max(64);

// ─── Topics ──────────────────────────────────────────────────

export async function createVideoTopicAction(
  input: z.input<typeof createVideoTopicSchema>,
): Promise<string> {
  const subject = await requirePermission("lessons.create");
  return createVideoTopic(subject, createVideoTopicSchema.parse(input));
}

export async function saveVideoTopicAction(
  input: z.input<typeof videoTopicInputSchema>,
): Promise<void> {
  const subject = await requirePermission("lessons.update");
  await saveVideoTopic(subject, videoTopicInputSchema.parse(input));
}

export async function setVideoTopicDeletedAction(topicId: string, deleted: boolean): Promise<void> {
  // Restore is not a destructive act, so it gates on update rather than delete
  // — the same split `setQuizDeleted`'s action makes. Undo must not need a
  // permission the original action did not (code-style #7).
  const subject = await requirePermission(deleted ? "lessons.delete" : "lessons.update");
  await setVideoTopicDeleted(subject, id.parse(topicId), z.boolean().parse(deleted));
}

/**
 * Status changes go through the shared machine, never bespoke code.
 *
 * `transitionContentStatus` re-checks `lessons.publish` on top of the
 * `lessons.update` required here whenever the target is a publishing state —
 * this action deliberately does not duplicate that check, so there is one
 * place the publish rule lives.
 */
export async function setVideoTopicStatusAction(
  topicId: string,
  to: string,
  scheduledForIso?: string,
): Promise<void> {
  const subject = await requirePermission("lessons.update");
  await transitionContentStatus(
    subject,
    "videos",
    id.parse(topicId),
    contentStatusSchema.parse(to),
    parseScheduledFor(scheduledForIso),
  );
}

// ─── Categories ──────────────────────────────────────────────

export async function saveVideoCategoryAction(
  input: z.input<typeof videoCategoryInputSchema>,
): Promise<string> {
  const parsed = videoCategoryInputSchema.parse(input);
  const subject = await requirePermission(parsed.categoryId ? "lessons.update" : "lessons.create");
  return saveVideoCategory(subject, parsed);
}

export async function setVideoCategoryActiveAction(
  categoryId: string,
  active: boolean,
): Promise<void> {
  const subject = await requirePermission("lessons.update");
  await setVideoCategoryActive(subject, id.parse(categoryId), z.boolean().parse(active));
}

export async function deleteVideoCategoryAction(categoryId: string): Promise<void> {
  const subject = await requirePermission("lessons.delete");
  await deleteVideoCategory(subject, id.parse(categoryId));
}

export async function reorderVideoCategoriesAction(ids: string[]): Promise<void> {
  const subject = await requirePermission("lessons.update");
  await reorderVideoCategories(subject, reorderVideoCategoriesSchema.parse({ ids }));
}
