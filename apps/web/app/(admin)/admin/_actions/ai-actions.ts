"use server";

// AI platform configuration actions (Module 18, ADR-097/098/100).
//
// Gate order per security.md #1: `requirePermission()` first, then the parse,
// then the `@repo/core` service. Never Prisma (architecture.md #2).
//
// **Two gates, not one, and the split is ADR-098's whole argument.** Switches,
// budget and tiers are `ai.settings.manage` and stay with `admin`. Providers,
// keys and models are `ai.providers.manage`, seeded to super_admin only —
// because a repointed `baseUrl` receives every prompt the platform sends,
// which is the site's unpublished editorial pipeline, continuously, without
// touching the database or leaving an audit trail.
//
// It is a KEY rather than a hardcoded `userType` test so that a later
// organisation can grant it to a non-super_admin deliberately, with its own
// ADR, instead of by editing a condition.
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { aiFeatureSchema, aiLimitsSchema, aiModelSchema, aiProviderSchema } from "@repo/contracts";
import {
  suggestAltText,
  suggestAltTextForUndescribed,
  type AltTextSuggestion,
  deleteAiModel,
  deleteAiProvider,
  resetAiBudget,
  saveAiFeature,
  saveAiLimits,
  saveAiModel,
  saveAiProvider,
  testAiProvider,
  type AiProviderTestResult,
} from "@repo/core";
import { ForbiddenError, can, requirePermission, type Subject } from "@repo/rbac";

/**
 * A SECOND permission check on a subject already loaded.
 *
 * `requirePermission` loads the session; asking it twice in one action would
 * mean two session reads to answer two questions about the same person. The
 * throw is the same `ForbiddenError` the boundary raises, so a caller cannot
 * tell the two apart — which is right, because they are the same refusal.
 */
function requirePermissionOn(subject: Subject, permission: string): void {
  if (!can(subject, permission)) throw new ForbiddenError(`Missing ${permission}`);
}

const id = z.string().min(1).max(64);

/**
 * The AI settings live in the `ai` settings group, so a limits write drops
 * `settings:ai` — architecture.md #12's frozen tag shape, with its mandatory
 * second argument.
 *
 * Providers, models and features are NOT settings and carry no cache tag at
 * all: every read of them happens inside a `force-dynamic` admin request, and
 * a tag for something nothing caches is a tag nobody maintains.
 */
function invalidateLimits(): void {
  revalidateTag("settings:ai", { expire: 0 });
}

// ─── Providers, models: ai.providers.manage ──────────────────

export async function saveAiProviderAction(input: unknown): Promise<string> {
  const subject = await requirePermission("ai.providers.manage");
  const parsed = aiProviderSchema.parse(input);
  const provider = await saveAiProvider(subject, parsed);
  return provider.id;
}

export async function deleteAiProviderAction(providerId: unknown): Promise<void> {
  const subject = await requirePermission("ai.providers.manage");
  await deleteAiProvider(subject, id.parse(providerId));
}

/**
 * "Test connection".
 *
 * Takes the key the admin has just typed, when there is one: the field is
 * write-only, so an unsaved credential has nowhere else to be proved. With no
 * key it tests the STORED one through the same `loadProviderDriver()` path a
 * generation takes, so a pass means the real path works.
 */
export async function testAiProviderAction(
  providerId: unknown,
  apiKey?: unknown,
): Promise<AiProviderTestResult> {
  const subject = await requirePermission("ai.providers.manage");
  const key = z.string().max(400).optional().parse(apiKey);
  return testAiProvider(subject, {
    id: id.parse(providerId),
    ...(key ? { apiKey: key } : {}),
  });
}

export async function saveAiModelAction(input: unknown): Promise<void> {
  const subject = await requirePermission("ai.providers.manage");
  const parsed = aiModelSchema.parse(input);
  await saveAiModel(subject, parsed);
}

export async function deleteAiModelAction(modelId: unknown): Promise<void> {
  const subject = await requirePermission("ai.providers.manage");
  await deleteAiModel(subject, id.parse(modelId));
}

// ─── Features, limits, budget: ai.settings.manage ────────────

export async function saveAiFeatureAction(input: unknown): Promise<void> {
  const subject = await requirePermission("ai.settings.manage");
  const parsed = aiFeatureSchema.parse(input);
  await saveAiFeature(subject, parsed);
}

export async function saveAiLimitsAction(input: unknown): Promise<void> {
  const subject = await requirePermission("ai.settings.manage");
  const parsed = aiLimitsSchema.parse(input);
  await saveAiLimits(subject, parsed);
  invalidateLimits();
}

/**
 * Zero the current period's spend.
 *
 * Audited, and deliberately reachable from a screen: a spend cap that only a
 * deploy can lift is a cap that gets worked around.
 */
export async function resetAiBudgetPeriodAction(): Promise<void> {
  const subject = await requirePermission("ai.settings.manage");
  await resetAiBudget(subject);
  invalidateLimits();
}

// ─── Alt text (B5) ───────────────────────────────────────────
//
// Server actions rather than the run endpoint, because the bytes are read
// SERVER-side through `readStoredFile` — `@repo/ai` never touches storage and
// the browser never sends an image it already has on the server
// (security.md #9).
//
// Gated on `ai.use` AND `media.update`: the first is the spend, the second is
// what a suggestion may eventually be saved into. Neither of them writes
// anything — the admin saves through `updateMediaMetaAction` as always.

export async function suggestAltTextAction(assetId: unknown): Promise<AltTextSuggestion> {
  const subject = await requirePermission("ai.use");
  // The SURFACE key, checked here for the same reason the run endpoint checks
  // it: the key that governs the entity governs the AI that writes into it.
  requirePermissionOn(subject, "media.update");
  return suggestAltText({ actorId: subject.id, assetId: id.parse(assetId) });
}

export async function suggestAltTextBulkAction(input: {
  assetIds?: unknown;
  limit?: unknown;
}): Promise<AltTextSuggestion[]> {
  const subject = await requirePermission("ai.use");
  requirePermissionOn(subject, "media.update");
  const assetIds = z.array(id).max(25).optional().parse(input.assetIds);
  const limit = z.number().int().min(1).max(25).optional().parse(input.limit);
  return suggestAltTextForUndescribed({
    actorId: subject.id,
    ...(assetIds ? { assetIds } : {}),
    ...(limit ? { limit } : {}),
  });
}
