"use server";

// Promotion actions (ADR-167, changes-52 P3).
//
// Gate order per security.md #1: `requirePermission()` first, then the parse
// through `@repo/contracts`, then the `@repo/core` service — which re-checks
// its own key and holds the one rule a key cannot express (editing a LIVE
// promotion needs `promotions.publish`).
//
// Refusals an editor can act on come back as a RESULT, not a throw. A thrown
// error's message is replaced by a generic one in production builds, so a
// "the window has already ended" thrown from here would reach the screen as
// "An error occurred" — the result carries the reason, and the client turns
// it into a catalog string.
import { z } from "zod";
import {
  PromotionPermissionError,
  PromotionRefusedError,
  duplicatePromotion,
  restorePromotion,
  savePromotion,
  savePromotionTranslation,
  searchLinkableContent,
  setPromotionStatus,
  softDeletePromotion,
  type LinkableContent,
  type PromotionRefusal,
} from "@repo/core";
import {
  promotionSaveSchema,
  promotionStatusChangeSchema,
  promotionTargetTypeSchema,
  promotionTranslationSaveSchema,
} from "@repo/contracts";
import { requirePermission } from "@repo/rbac";
import { translateSoon } from "./translate-soon.ts";

const idSchema = z.string().min(1).max(64);

export type PromotionRefused = { ok: false; reason: PromotionRefusal | "forbidden" };

async function refusals<T extends { ok: true }>(
  work: () => Promise<T>,
): Promise<T | PromotionRefused> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof PromotionRefusedError) return { ok: false, reason: error.reason };
    // The action's own gate passed, so this is the service's publish rule for
    // a LIVE promotion — expected, and the editor needs to be told which.
    if (error instanceof PromotionPermissionError) return { ok: false, reason: "forbidden" };
    throw error;
  }
}

/** Create (no id) or update. Returns the id, so a new promotion can open its editor. */
export async function savePromotionAction(
  input: unknown,
): Promise<{ ok: true; id: string } | PromotionRefused> {
  const subject = await requirePermission(
    typeof input === "object" && input !== null && "id" in input && input.id
      ? "promotions.update"
      : "promotions.create",
  );
  const parsed = promotionSaveSchema.parse(input);
  return refusals(async () => {
    const id = await savePromotion(subject, parsed);
    // The service queued one job per active language (ADR-164); this runs them
    // after the response, so a translation is ready without waiting for the cron.
    translateSoon("promotion", id);
    return { ok: true as const, id };
  });
}

export async function savePromotionTranslationAction(
  input: unknown,
): Promise<{ ok: true } | PromotionRefused> {
  const subject = await requirePermission("promotions.update");
  const parsed = promotionTranslationSaveSchema.parse(input);
  return refusals(async () => {
    await savePromotionTranslation(subject, parsed);
    return { ok: true as const };
  });
}

export async function setPromotionStatusAction(
  input: unknown,
): Promise<{ ok: true } | PromotionRefused> {
  const subject = await requirePermission("promotions.publish");
  const parsed = promotionStatusChangeSchema.parse(input);
  return refusals(async () => {
    await setPromotionStatus(subject, parsed);
    return { ok: true as const };
  });
}

// `promotions.create`, not `.update` — a duplicate mints a promotion.
export async function duplicatePromotionAction(id: string): Promise<string> {
  const subject = await requirePermission("promotions.create");
  // Nothing to translate: the copy carries every language's row and hash.
  return duplicatePromotion(subject, idSchema.parse(id));
}

export async function setPromotionDeletedAction(id: string, deleted: boolean): Promise<void> {
  const subject = await requirePermission("promotions.delete");
  const promotionId = idSchema.parse(id);
  if (z.boolean().parse(deleted)) await softDeletePromotion(subject, promotionId);
  else await restorePromotion(subject, promotionId);
}

/**
 * The link picker's search. A read, but a server action rather than a route
 * because only the editor calls it and it returns titles of DRAFTS — gated on
 * the key that opens the editor, never on a public path.
 */
export async function searchPromotionTargetsAction(
  query: unknown,
  type: unknown,
): Promise<LinkableContent[]> {
  await requirePermission("promotions.view");
  const q = z.string().max(100).parse(query);
  const types = type === "" || type == null ? undefined : [promotionTargetTypeSchema.parse(type)];
  return searchLinkableContent(q, types);
}
