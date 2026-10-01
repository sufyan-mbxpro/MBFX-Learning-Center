"use server";

// Video actions (changes-16 PRs 4–6, ADR-068).
//
// Gate order per security.md #1: `requirePermission()` first, then the parse,
// then the `@repo/core` service. Nothing here touches Prisma
// (architecture.md #2).
//
// Gated on `videos.*` (ADR-177, superseding ADR-068 §3, which had videos on
// the lesson keys). Video categories use the same keys as video topics: they
// are edited from the same screen by the same people.
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
import { translateSoon } from "./translate-soon.ts";

const id = z.string().min(1).max(64);

// ─── Topics ──────────────────────────────────────────────────

export async function createVideoTopicAction(
  input: z.input<typeof createVideoTopicSchema>,
): Promise<string> {
  const subject = await requirePermission("videos.create");
  return createVideoTopic(subject, createVideoTopicSchema.parse(input));
}

export async function saveVideoTopicAction(
  input: z.input<typeof videoTopicInputSchema>,
): Promise<void> {
  const subject = await requirePermission("videos.update");
  const parsed = videoTopicInputSchema.parse(input);
  await saveVideoTopic(subject, parsed);
  translateSoon("video_topic", parsed.topicId);
}

export async function setVideoTopicDeletedAction(topicId: string, deleted: boolean): Promise<void> {
  // Restore is not a destructive act, so it gates on update rather than delete
  // — the same split `setQuizDeleted`'s action makes. Undo must not need a
  // permission the original action did not (code-style #7).
  const subject = await requirePermission(deleted ? "videos.delete" : "videos.update");
  await setVideoTopicDeleted(subject, id.parse(topicId), z.boolean().parse(deleted));
  if (!deleted) translateSoon("video_topic", topicId);
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
  const subject = await requirePermission("videos.update");
  await transitionContentStatus(
    subject,
    "videos",
    id.parse(topicId),
    contentStatusSchema.parse(to),
    parseScheduledFor(scheduledForIso),
  );
  translateSoon("video_topic", topicId);
}

// ─── Categories ──────────────────────────────────────────────

export async function saveVideoCategoryAction(
  input: z.input<typeof videoCategoryInputSchema>,
): Promise<string> {
  const parsed = videoCategoryInputSchema.parse(input);
  const subject = await requirePermission(parsed.categoryId ? "videos.update" : "videos.create");
  const categoryId = await saveVideoCategory(subject, parsed);
  translateSoon("video_category", categoryId);
  return categoryId;
}

export async function setVideoCategoryActiveAction(
  categoryId: string,
  active: boolean,
): Promise<void> {
  const subject = await requirePermission("videos.update");
  await setVideoCategoryActive(subject, id.parse(categoryId), z.boolean().parse(active));
}

export async function deleteVideoCategoryAction(categoryId: string): Promise<void> {
  const subject = await requirePermission("videos.delete");
  await deleteVideoCategory(subject, id.parse(categoryId));
}

export async function reorderVideoCategoriesAction(ids: string[]): Promise<void> {
  const subject = await requirePermission("videos.update");
  await reorderVideoCategories(subject, reorderVideoCategoriesSchema.parse({ ids }));
}
