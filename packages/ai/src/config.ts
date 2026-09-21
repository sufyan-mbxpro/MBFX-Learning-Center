// Resolving a feature: registry + row + tier settings → `ResolvedFeature`.
//
// Two rules live here and nowhere else.
//
// **Model resolution is three steps** (ADR-099 #4, skill invariant #8):
//
//     AiFeature.modelId (an explicit admin override)
//       → the tier model for the entry's `modelRole`
//       → the default provider's first enabled model
//
// The tier exists because `fix_grammar` is an ACTION inside
// `writing_assistant`, and a per-feature column cannot say "grammar on Haiku,
// drafting on Opus". It also puts the cost dial in ONE place: when a cheaper
// model lands, an admin moves the tier once rather than editing six dropdowns.
// A tier naming a retired model falls THROUGH — it never throws, because a
// price list an admin edited last month must not be able to break generation.
//
// **The output ceiling is the MINIMUM of three**: the registry's own cap, the
// admin's `ai.maxTokensPerRequest`, and the model's own `maxOutputTokens`. A
// feature's row may lower the first; nothing may raise any of them.
import {
  AI_FEATURES,
  type AiEffort,
  type AiFeatureKey,
  type AiModelRole,
  aiFeature,
} from "@repo/contracts";
import { db, type AiProviderKind } from "@repo/db";
import { loadSetting } from "@repo/settings";

import { AiError } from "./errors.ts";

export interface ResolvedModel {
  /** The `AiModel` row id — what a usage row's provider/model FKs came from. */
  rowId: string;
  /** The provider's own opaque id, e.g. "claude-opus-5". */
  modelId: string;
  label: string;
  providerId: string;
  providerKind: AiProviderKind;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsStream: boolean;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  cachedInputPricePerMTok: number | null;
}

export interface ResolvedFeature {
  key: AiFeatureKey;
  model: ResolvedModel;
  /** After the three-way clamp. */
  maxOutputTokens: number;
  effort: AiEffort;
  streams: boolean;
  vision: boolean;
  /** ≤1000 escaped characters of house style, or null. */
  extraInstructions: string | null;
}

export interface AiLimits {
  enabled: boolean;
  maxTokensPerRequest: number;
  monthlyBudgetUsd: number;
  budgetWarnPercent: number;
  capBehavior: "DISABLE" | "NOTIFY_ONLY";
  rateLimitPerUserHour: number;
  tiers: Record<AiModelRole, string>;
}

/**
 * The admin's switches, with the seeded defaults as the floor.
 *
 * `loadSetting` rather than `getSetting`: every caller is inside a
 * `force-dynamic` admin request or a route handler, and a cached global switch
 * is a switch that stays off for five minutes after an admin turns it on.
 */
export async function loadAiLimits(): Promise<AiLimits> {
  const [
    enabled,
    maxTokensPerRequest,
    monthlyBudgetUsd,
    budgetWarnPercent,
    capBehavior,
    rateLimitPerUserHour,
    light,
    standard,
    heavy,
  ] = await Promise.all([
    loadSetting("ai.enabled"),
    loadSetting("ai.maxTokensPerRequest"),
    loadSetting("ai.monthlyBudgetUsd"),
    loadSetting("ai.budgetWarnPercent"),
    loadSetting("ai.capBehavior"),
    loadSetting("ai.rateLimitPerUserHour"),
    loadSetting("ai.model.light"),
    loadSetting("ai.model.standard"),
    loadSetting("ai.model.heavy"),
  ]);

  return {
    enabled: enabled ?? false,
    maxTokensPerRequest: maxTokensPerRequest ?? 2000,
    monthlyBudgetUsd: monthlyBudgetUsd ?? 50,
    budgetWarnPercent: budgetWarnPercent ?? 80,
    capBehavior: capBehavior ?? "DISABLE",
    rateLimitPerUserHour: rateLimitPerUserHour ?? 120,
    tiers: {
      light: light ?? "claude-haiku-4-5",
      standard: standard ?? "claude-sonnet-5",
      heavy: heavy ?? "claude-opus-5",
    },
  };
}

const MODEL_SELECT = {
  id: true,
  isEnabled: true,
  modelId: true,
  label: true,
  providerId: true,
  maxOutputTokens: true,
  supportsVision: true,
  supportsStream: true,
  inputPricePerMTok: true,
  outputPricePerMTok: true,
  cachedInputPricePerMTok: true,
  provider: { select: { kind: true, isEnabled: true } },
} as const;

type ModelRow = {
  id: string;
  isEnabled: boolean;
  modelId: string;
  label: string;
  providerId: string;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsStream: boolean;
  inputPricePerMTok: unknown;
  outputPricePerMTok: unknown;
  cachedInputPricePerMTok: unknown;
  provider: { kind: AiProviderKind; isEnabled: boolean };
};

function toResolvedModel(row: ModelRow): ResolvedModel {
  return {
    rowId: row.id,
    modelId: row.modelId,
    label: row.label,
    providerId: row.providerId,
    providerKind: row.provider.kind,
    maxOutputTokens: row.maxOutputTokens,
    supportsVision: row.supportsVision,
    supportsStream: row.supportsStream,
    inputPricePerMTok: Number(row.inputPricePerMTok),
    outputPricePerMTok: Number(row.outputPricePerMTok),
    cachedInputPricePerMTok:
      row.cachedInputPricePerMTok === null ? null : Number(row.cachedInputPricePerMTok),
  };
}

/**
 * Step three of the resolution order: the default provider's first enabled
 * model.
 *
 * `isDefault` is enforced in the service inside a transaction rather than by a
 * constraint (MariaDB has no partial unique index), so this reads the flag and
 * falls back to ANY enabled provider if a database has somehow lost it. A
 * platform with a key and no default is a platform that should still work.
 */
async function defaultProviderModel(): Promise<ResolvedModel | null> {
  const rows = await db.aiModel.findMany({
    where: { isEnabled: true, provider: { isEnabled: true } },
    orderBy: [{ provider: { isDefault: "desc" } }, { sortOrder: "asc" }, { modelId: "asc" }],
    select: MODEL_SELECT,
    take: 1,
  });
  const row = rows[0];
  return row ? toResolvedModel(row as ModelRow) : null;
}

/**
 * Resolve everything a call needs, or throw a taxonomy reason.
 *
 * `runAiTask` is the only caller that matters, but the admin screens use it too
 * — the features screen names which tier a feature falls back to and what one
 * call costs at current prices, and both come from here rather than from a
 * second copy of the rule.
 */
export async function resolveFeature(
  key: AiFeatureKey,
  options?: { limits?: AiLimits; modelRole?: AiModelRole; effort?: AiEffort },
): Promise<ResolvedFeature> {
  const definition = aiFeature(key);
  const limits = options?.limits ?? (await loadAiLimits());
  // An action inside a feature may ask for a different tier and effort than the
  // feature declares — that is the whole of ADR-099 #4.
  const role = options?.modelRole ?? definition.modelRole;
  const effort = options?.effort ?? definition.effort;

  const row = await db.aiFeature.findUnique({
    where: { key },
    select: { providerId: true, modelId: true, maxOutputTokens: true, extraInstructions: true },
  });

  let model: ResolvedModel | null = null;

  // 1. An explicit admin override, first in the order because the brief asked
  //    for per-feature model selection and the tier must not take it away.
  if (row?.modelId) {
    const pinned = await db.aiModel.findUnique({
      where: { id: row.modelId },
      select: MODEL_SELECT,
    });
    if (pinned?.isEnabled !== false && pinned && pinned.provider.isEnabled) {
      model = toResolvedModel(pinned as ModelRow);
    }
  }

  // 2. The tier. A tier holds a model ID STRING, so it survives a provider row
  //    being deleted and re-created — and if it names nothing, we fall through
  //    rather than throw.
  if (!model) {
    const tierModelId = limits.tiers[role];
    const candidates = await db.aiModel.findMany({
      where: { modelId: tierModelId, isEnabled: true, provider: { isEnabled: true } },
      orderBy: [{ provider: { isDefault: "desc" } }, { sortOrder: "asc" }],
      select: MODEL_SELECT,
      take: 1,
    });
    const candidate = candidates[0];
    if (candidate) model = toResolvedModel(candidate as ModelRow);
  }

  // 3. The default provider's first enabled model.
  model ??= await defaultProviderModel();

  if (!model) throw new AiError("no_provider", "No enabled AI provider has an enabled model");

  const maxOutputTokens = Math.max(
    1,
    Math.min(
      row?.maxOutputTokens ?? definition.maxOutputTokens,
      limits.maxTokensPerRequest,
      model.maxOutputTokens,
    ),
  );

  return {
    key,
    model,
    maxOutputTokens,
    effort,
    streams: definition.streams,
    vision: definition.vision,
    extraInstructions: row?.extraInstructions?.trim() ? row.extraInstructions.trim() : null,
  };
}

/** Which features an admin has switched on. Read by the availability probe. */
export async function loadEnabledFeatureKeys(): Promise<Set<AiFeatureKey>> {
  const rows = await db.aiFeature.findMany({
    where: { isEnabled: true },
    select: { key: true },
  });
  const known = new Set(AI_FEATURES.map((f) => f.key as string));
  // A row for an unknown key is IGNORED, the way an unknown `Tool` key is
  // (ADR-086 #1): a database seeded by a later build must not make this one
  // offer a feature it has no builder for.
  return new Set(rows.map((r) => r.key).filter((k) => known.has(k)) as AiFeatureKey[]);
}
