// The admin's door to the AI platform (Module 18, ADR-097/098/100).
//
// Server actions never touch Prisma (architecture.md #2), so everything the
// five AI screens need is here. The division is the one `email-admin.ts`
// already uses: **`@repo/ai` never audits and never notifies**, because it
// does not know who a subject is, and this file does both around its reads and
// writes.
//
// Three properties this file is responsible for, none of which a screen can be
// trusted to remember:
//
//   1. **The API key leaves by no route.** `AiProviderView` has no key
//      property at all, so a leak has to get past the TYPE, not just past a
//      reviewer (ADR-098 (b)). `loadProviderDriver()` in `@repo/ai` stays the
//      one reader of `apiKeyCipher`; nothing here selects it, and
//      `saveAiProvider` only ever writes it.
//   2. **A blank key field means UNCHANGED, never erase.** Write-only means
//      the field renders empty over a stored key, so treating empty as a
//      deletion would wipe the credential every time somebody renamed the
//      provider.
//   3. **Exactly one provider is the default.** Enforced here, in a
//      transaction — MariaDB has no partial unique index, and a
//      nullable-unique trick would encode "default" as "not null", a second
//      meaning for a column that already has one.
import {
  AI_FEATURES,
  AI_PROVIDER_PRESETS,
  isAiFeatureKey,
  type AiConnectionTestInput,
  type AiDiscoveredModel,
  type AiFeatureKey,
  type AiFeatureSaveInput,
  type AiLimitsSaveInput,
  type AiSetupSaveInput,
  type AiUsageLimitsSaveInput,
  type AiModelSaveInput,
  type AiProviderSaveInput,
  type AiUsageFilter,
} from "@repo/contracts";
import {
  AI_USAGE_RETENTION_DAYS,
  applyBudgetSettings,
  currentPeriod,
  discoverProviderModels,
  estimateCostUsd,
  getBudgetState,
  hasAiSecretKey,
  listUsageRows,
  purgeUsageOlderThan,
  resetBudgetPeriod,
  resolveFeature,
  sealAiSecret,
  summarizeUsage,
  testProviderConnection,
  usageDailySeries,
  loadAiLimits,
  type AiReason,
  type AiUsageDailyPoint,
  type AiUsageSummary,
  type BudgetState,
} from "@repo/ai";
import { db, type AiCallStatus, type AiProviderKind, type Prisma } from "@repo/db";
import type { Subject } from "@repo/rbac";
import { updateSetting } from "@repo/settings";

import { recordAudit } from "./index.ts";
import { recordNotification } from "./notifications.ts";

// ─── Providers ───────────────────────────────────────────────

/**
 * What the providers screen renders.
 *
 * Note what is NOT here: there is no `apiKey` and no `apiKeyCipher`.
 * `hasApiKey` is the only thing the screen is told, which is enough to say
 * "saved — replace" and nothing more.
 */
export interface AiProviderView {
  id: string;
  kind: AiProviderKind;
  label: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  isEnabled: boolean;
  isDefault: boolean;
  lastTestAt: Date | null;
  lastTestError: string | null;
  modelCount: number;
  /**
   * Whether `AI_SECRET_KEY` is present and usable. Without it a stored key
   * cannot be opened, so the screen warns rather than letting an admin save a
   * credential that will never work — and it names the variable, because an
   * absent key reads exactly like a rejected one.
   */
  hasSecretKey: boolean;
}

const PROVIDER_SELECT = {
  id: true,
  kind: true,
  label: true,
  baseUrl: true,
  // Selected ONLY to compute `hasApiKey`, and not carried out of the mapper
  // below. The view type is what enforces that.
  apiKeyCipher: true,
  isEnabled: true,
  isDefault: true,
  lastTestAt: true,
  lastTestError: true,
  _count: { select: { models: true } },
} satisfies Prisma.AiProviderSelect;

function toProviderView(row: {
  id: string;
  kind: AiProviderKind;
  label: string;
  baseUrl: string | null;
  apiKeyCipher: string | null;
  isEnabled: boolean;
  isDefault: boolean;
  lastTestAt: Date | null;
  lastTestError: string | null;
  _count: { models: number };
}): AiProviderView {
  const { apiKeyCipher, _count, ...rest } = row;
  return {
    ...rest,
    hasApiKey: Boolean(apiKeyCipher),
    modelCount: _count.models,
    hasSecretKey: hasAiSecretKey(),
  };
}

export async function listAiProviders(): Promise<AiProviderView[]> {
  const rows = await db.aiProvider.findMany({
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
    select: PROVIDER_SELECT,
  });
  return rows.map(toProviderView);
}

export async function loadAiProvider(id: string): Promise<AiProviderView | null> {
  const row = await db.aiProvider.findUnique({ where: { id }, select: PROVIDER_SELECT });
  return row ? toProviderView(row) : null;
}

export async function saveAiProvider(
  subject: Subject,
  input: AiProviderSaveInput,
): Promise<AiProviderView> {
  const data: Prisma.AiProviderUncheckedCreateInput = {
    kind: input.kind,
    label: input.label,
    baseUrl: input.baseUrl || null,
    isEnabled: input.isEnabled,
    isDefault: input.isDefault,
  };

  // A blank key leaves the stored one alone (#2 above).
  if (input.apiKey) data.apiKeyCipher = sealAiSecret(input.apiKey);

  const row = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const saved = input.id
      ? await tx.aiProvider.update({ where: { id: input.id }, data })
      : await tx.aiProvider.create({ data });

    // #3: exactly one default. Clearing the others AFTER the write means a
    // provider promoting itself demotes the incumbent in the same transaction,
    // so there is no instant where two rows or zero rows are the default.
    if (input.isDefault) {
      await tx.aiProvider.updateMany({
        where: { id: { not: saved.id }, isDefault: true },
        data: { isDefault: false },
      });
    }
    return saved;
  });

  await recordAudit({
    userId: subject.id,
    action: input.id ? "ai.provider.update" : "ai.provider.create",
    entityType: "AiProvider",
    entityId: row.id,
    // The key is never in the audit payload either — an audit row is readable
    // by anyone with `audit.view`, which is a wider set than `ai.providers.manage`.
    changes: { after: { kind: input.kind, label: input.label, keyChanged: Boolean(input.apiKey) } },
  });

  return (await loadAiProvider(row.id))!;
}

export async function deleteAiProvider(subject: Subject, id: string): Promise<void> {
  const row = await db.aiProvider.findUnique({
    where: { id },
    select: { label: true, kind: true, isDefault: true },
  });
  if (!row) return;

  // Models cascade; features hold `SetNull`, so a feature pointing here falls
  // back to the default rather than breaking. That is the whole reason the FK
  // is SetNull and not Restrict: a deleted provider must not take the editor's
  // buttons with it.
  await db.aiProvider.delete({ where: { id } });

  await recordAudit({
    userId: subject.id,
    action: "ai.provider.delete",
    entityType: "AiProvider",
    entityId: id,
    changes: { after: { label: row.label, kind: row.kind, wasDefault: row.isDefault } },
  });
}

export interface AiProviderTestResult {
  ok: boolean;
  /** A taxonomy value the screen maps to one catalog string, never a message. */
  reason: AiReason | null;
}

/**
 * The "Test connection" button.
 *
 * Takes an UNSAVED key when the admin has just typed one, because the field is
 * write-only and an unsaved credential has nowhere else to be proved. The
 * result is stamped on the row so the list can say when it last worked.
 */
export async function testAiProvider(
  subject: Subject,
  input: { id: string; apiKey?: string },
): Promise<AiProviderTestResult> {
  const row = await db.aiProvider.findUnique({
    where: { id: input.id },
    select: { kind: true, baseUrl: true },
  });
  if (!row) return { ok: false, reason: "no_provider" };

  const result = await testProviderConnection({
    providerId: input.id,
    ...(input.apiKey ? { kind: row.kind, apiKey: input.apiKey, baseUrl: row.baseUrl } : {}),
  });

  await db.aiProvider.update({
    where: { id: input.id },
    data: {
      lastTestAt: new Date(),
      // The taxonomy value, not the provider's message: a provider error can
      // quote the request back, and this column is read by a screen.
      lastTestError: result.ok ? null : result.reason,
    },
  });

  await recordAudit({
    userId: subject.id,
    action: "ai.provider.test",
    entityType: "AiProvider",
    entityId: input.id,
    changes: { after: { ok: result.ok, reason: result.reason } },
  });

  return result;
}

// ─── Models ──────────────────────────────────────────────────

export interface AiModelView {
  id: string;
  providerId: string;
  providerLabel: string;
  providerKind: AiProviderKind;
  modelId: string;
  label: string;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  cachedInputPricePerMTok: number | null;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsStream: boolean;
  isEnabled: boolean;
  /** "Prices as of" — shown beside every spend figure (ADR-100 #2). */
  pricedAt: Date;
  sortOrder: number;
}

export async function listAiModels(providerId?: string): Promise<AiModelView[]> {
  const rows = await db.aiModel.findMany({
    ...(providerId ? { where: { providerId } } : {}),
    orderBy: [{ provider: { label: "asc" } }, { sortOrder: "asc" }, { modelId: "asc" }],
    include: { provider: { select: { label: true, kind: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    providerId: row.providerId,
    providerLabel: row.provider.label,
    providerKind: row.provider.kind,
    modelId: row.modelId,
    label: row.label,
    inputPricePerMTok: Number(row.inputPricePerMTok),
    outputPricePerMTok: Number(row.outputPricePerMTok),
    cachedInputPricePerMTok:
      row.cachedInputPricePerMTok === null ? null : Number(row.cachedInputPricePerMTok),
    maxOutputTokens: row.maxOutputTokens,
    supportsVision: row.supportsVision,
    supportsStream: row.supportsStream,
    isEnabled: row.isEnabled,
    pricedAt: row.pricedAt,
    sortOrder: row.sortOrder,
  }));
}

export async function saveAiModel(
  subject: Subject,
  input: AiModelSaveInput,
): Promise<AiModelView | null> {
  const previous = input.id
    ? await db.aiModel.findUnique({
        where: { id: input.id },
        select: { inputPricePerMTok: true, outputPricePerMTok: true },
      })
    : null;

  // `pricedAt` moves only when a PRICE moves. Touching it on every save would
  // make "prices last updated <date>" say today because somebody renamed a
  // model, which is exactly the kind of control that looks live and is not.
  const priceChanged =
    !previous ||
    Number(previous.inputPricePerMTok) !== input.inputPricePerMTok ||
    Number(previous.outputPricePerMTok) !== input.outputPricePerMTok;

  const data = {
    providerId: input.providerId,
    modelId: input.modelId,
    label: input.label,
    inputPricePerMTok: input.inputPricePerMTok,
    outputPricePerMTok: input.outputPricePerMTok,
    cachedInputPricePerMTok: input.cachedInputPricePerMTok ?? null,
    maxOutputTokens: input.maxOutputTokens,
    supportsVision: input.supportsVision,
    supportsStream: input.supportsStream,
    isEnabled: input.isEnabled,
    sortOrder: input.sortOrder,
    ...(priceChanged ? { pricedAt: new Date() } : {}),
  };

  const row = input.id
    ? await db.aiModel.update({ where: { id: input.id }, data })
    : await db.aiModel.create({ data });

  await recordAudit({
    userId: subject.id,
    action: input.id ? "ai.model.update" : "ai.model.create",
    entityType: "AiModel",
    entityId: row.id,
    changes: {
      after: {
        modelId: input.modelId,
        inputPricePerMTok: input.inputPricePerMTok,
        outputPricePerMTok: input.outputPricePerMTok,
        priceChanged,
      },
    },
  });

  const models = await listAiModels(input.providerId);
  return models.find((m) => m.id === row.id) ?? null;
}

export async function deleteAiModel(subject: Subject, id: string): Promise<void> {
  const row = await db.aiModel.findUnique({ where: { id }, select: { modelId: true } });
  if (!row) return;
  await db.aiModel.delete({ where: { id } });
  await recordAudit({
    userId: subject.id,
    action: "ai.model.delete",
    entityType: "AiModel",
    entityId: id,
    changes: { after: { modelId: row.modelId } },
  });
}

// ─── Guided setup (ADR-120) ──────────────────────────────────
//
// `/admin/settings/ai` in one flow: choose a provider, type its key, test it,
// pick models from the list the provider itself returns, save. Everything here
// is composed from the same rules the providers screen follows — the key is
// write-only and sealed on save, blank means unchanged, exactly one default —
// so the two screens cannot disagree about what a provider row means.

/** A discovered model, with what this database already knows about it. */
export interface AiSetupModelOption extends AiDiscoveredModel {
  /**
   * A price already on record for this model ID — this provider's row first,
   * then any provider's. Null means nobody has priced it and the admin must.
   */
  knownInputPricePerMTok: number | null;
  knownOutputPricePerMTok: number | null;
  knownCachedInputPricePerMTok: number | null;
  /** This provider already offers it, enabled. Pre-ticks the checkbox. */
  isSelected: boolean;
}

export interface AiSetupDiscoveryResult {
  ok: boolean;
  reason: AiReason | null;
  models: AiSetupModelOption[];
}

/** The stored models of one provider, in the shape the setup form edits. */
export interface AiSetupStoredModel {
  modelId: string;
  label: string;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  cachedInputPricePerMTok: number | null;
  maxOutputTokens: number;
  supportsVision: boolean;
}

export interface AiSetupView {
  providers: AiProviderView[];
  /** Enabled models per provider id — what the form shows before any test. */
  models: Record<string, AiSetupStoredModel[]>;
  limits: AiLimitsView;
  hasSecretKey: boolean;
}

export async function loadAiSetupView(): Promise<AiSetupView> {
  const [providers, rows, limits] = await Promise.all([
    listAiProviders(),
    db.aiModel.findMany({
      where: { isEnabled: true },
      orderBy: [{ sortOrder: "asc" }, { modelId: "asc" }],
    }),
    loadAiLimitsView(),
  ]);

  const models: Record<string, AiSetupStoredModel[]> = {};
  for (const row of rows) {
    (models[row.providerId] ??= []).push({
      modelId: row.modelId,
      label: row.label,
      inputPricePerMTok: Number(row.inputPricePerMTok),
      outputPricePerMTok: Number(row.outputPricePerMTok),
      cachedInputPricePerMTok:
        row.cachedInputPricePerMTok === null ? null : Number(row.cachedInputPricePerMTok),
      maxOutputTokens: row.maxOutputTokens,
      supportsVision: row.supportsVision,
    });
  }

  return { providers, models, limits, hasSecretKey: hasAiSecretKey() };
}

/** Upper bound a discovered ceiling is clamped to — the form schema's own max. */
const MAX_OUTPUT_TOKENS_CEILING = 200_000;

/**
 * "Test connection" on the setup screen: prove the key, then return the models.
 *
 * A stored key is used only when the provider id names a row of the SAME kind —
 * switching the dropdown from Anthropic to Gemini must never send the stored
 * Anthropic key to Google.
 */
export async function discoverAiModels(
  subject: Subject,
  input: AiConnectionTestInput,
): Promise<AiSetupDiscoveryResult> {
  const row = input.providerId
    ? await db.aiProvider.findUnique({
        where: { id: input.providerId },
        select: { id: true, kind: true },
      })
    : null;
  const providerId = row && row.kind === input.kind ? row.id : null;

  const result = await discoverProviderModels({
    kind: input.kind,
    providerId,
    ...(input.apiKey ? { apiKey: input.apiKey } : {}),
    baseUrl: input.baseUrl || null,
  });

  if (providerId) {
    await db.aiProvider.update({
      where: { id: providerId },
      data: { lastTestAt: new Date(), lastTestError: result.ok ? null : result.reason },
    });
  }

  await recordAudit({
    userId: subject.id,
    action: "ai.provider.test",
    entityType: "AiProvider",
    entityId: providerId ?? `new:${input.kind}`,
    changes: {
      after: { ok: result.ok, reason: result.reason, modelCount: result.models.length },
    },
  });

  if (!result.ok) return { ok: false, reason: result.reason, models: [] };

  const known = await db.aiModel.findMany({
    where: { modelId: { in: result.models.map((model) => model.modelId) } },
    select: {
      providerId: true,
      modelId: true,
      isEnabled: true,
      inputPricePerMTok: true,
      outputPricePerMTok: true,
      cachedInputPricePerMTok: true,
    },
  });

  const models = result.models.map((model): AiSetupModelOption => {
    const own = providerId
      ? known.find((k) => k.providerId === providerId && k.modelId === model.modelId)
      : undefined;
    const priced = own ?? known.find((k) => k.modelId === model.modelId);
    return {
      ...model,
      maxOutputTokens:
        model.maxOutputTokens === null
          ? null
          : Math.min(model.maxOutputTokens, MAX_OUTPUT_TOKENS_CEILING),
      knownInputPricePerMTok: priced ? Number(priced.inputPricePerMTok) : null,
      knownOutputPricePerMTok: priced ? Number(priced.outputPricePerMTok) : null,
      knownCachedInputPricePerMTok:
        priced?.cachedInputPricePerMTok == null ? null : Number(priced.cachedInputPricePerMTok),
      isSelected: Boolean(own?.isEnabled),
    };
  });

  return { ok: true, reason: null, models };
}

export class AiSetupKeyRequiredError extends Error {
  constructor() {
    super("An API key is required to connect this provider");
    this.name = "AiSetupKeyRequiredError";
  }
}

/**
 * Connect a provider: one save for the row, its key, its models and the tiers.
 *
 * The provider becomes enabled AND the default in the same transaction that
 * demotes the incumbent (#3 above). A stored model the admin un-ticked is
 * DISABLED, never deleted — usage rows and feature overrides still point at it,
 * and ticking it again restores its price history rather than starting over.
 */
export async function saveAiSetup(
  subject: Subject,
  input: AiSetupSaveInput,
): Promise<AiProviderView> {
  const preset = AI_PROVIDER_PRESETS[input.kind];

  const existing = input.providerId
    ? await db.aiProvider.findUnique({
        where: { id: input.providerId },
        select: { id: true, kind: true, apiKeyCipher: true },
      })
    : null;
  // A row of another kind is not this provider. Reusing it would carry its
  // sealed key across vendors.
  const target = existing && existing.kind === input.kind ? existing : null;

  if (preset.protocol !== "echo" && !input.apiKey && !target?.apiKeyCipher) {
    throw new AiSetupKeyRequiredError();
  }

  const saved = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const data = {
      kind: input.kind,
      baseUrl: input.baseUrl || null,
      isEnabled: true,
      isDefault: true,
      ...(input.apiKey ? { apiKeyCipher: sealAiSecret(input.apiKey) } : {}),
    };
    const provider = target
      ? await tx.aiProvider.update({ where: { id: target.id }, data })
      : await tx.aiProvider.create({ data: { ...data, label: preset.defaultLabel } });

    await tx.aiProvider.updateMany({
      where: { id: { not: provider.id }, isDefault: true },
      data: { isDefault: false },
    });

    // Echo's one placeholder model is seeded and never edited from here.
    if (preset.protocol === "echo") return provider;

    const stored = await tx.aiModel.findMany({
      where: { providerId: provider.id },
      select: {
        id: true,
        modelId: true,
        inputPricePerMTok: true,
        outputPricePerMTok: true,
        cachedInputPricePerMTok: true,
      },
    });
    const selected = new Set(input.models.map((model) => model.modelId));

    for (const [index, model] of input.models.entries()) {
      const previous = stored.find((row) => row.modelId === model.modelId);
      // The setup screen does not ask for prices: an absent one keeps what is
      // stored, and a model nobody has priced starts at 0 until someone prices
      // it on the providers screen.
      const inputPrice =
        model.inputPricePerMTok ?? (previous ? Number(previous.inputPricePerMTok) : 0);
      const outputPrice =
        model.outputPricePerMTok ?? (previous ? Number(previous.outputPricePerMTok) : 0);
      const cachedPrice =
        model.cachedInputPricePerMTok !== undefined
          ? model.cachedInputPricePerMTok
          : previous?.cachedInputPricePerMTok != null
            ? Number(previous.cachedInputPricePerMTok)
            : null;
      // `pricedAt` moves only when a price moves — `saveAiModel`'s rule.
      const priceChanged =
        !previous ||
        Number(previous.inputPricePerMTok) !== inputPrice ||
        Number(previous.outputPricePerMTok) !== outputPrice;
      const fields = {
        label: model.label,
        inputPricePerMTok: inputPrice,
        outputPricePerMTok: outputPrice,
        cachedInputPricePerMTok: cachedPrice,
        maxOutputTokens: model.maxOutputTokens,
        supportsVision: model.supportsVision,
        isEnabled: true,
        sortOrder: (index + 1) * 10,
        ...(priceChanged ? { pricedAt: new Date() } : {}),
      };
      if (previous) {
        await tx.aiModel.update({ where: { id: previous.id }, data: fields });
      } else {
        await tx.aiModel.create({
          data: { ...fields, providerId: provider.id, modelId: model.modelId },
        });
      }
    }

    const dropped = stored.filter((row) => !selected.has(row.modelId)).map((row) => row.id);
    if (dropped.length > 0) {
      await tx.aiModel.updateMany({ where: { id: { in: dropped } }, data: { isEnabled: false } });
    }
    return provider;
  });

  if (preset.protocol !== "echo") {
    await updateSetting("ai.model.light", input.tiers.light, subject.id);
    await updateSetting("ai.model.standard", input.tiers.standard, subject.id);
    await updateSetting("ai.model.heavy", input.tiers.heavy, subject.id);
  }

  await recordAudit({
    userId: subject.id,
    action: target ? "ai.setup.update" : "ai.setup.create",
    entityType: "AiProvider",
    entityId: saved.id,
    // No key, as everywhere: `keyChanged` is the only thing the log is told.
    changes: {
      after: {
        kind: input.kind,
        keyChanged: Boolean(input.apiKey),
        models: input.models.map((model) => model.modelId),
        tiers: preset.protocol === "echo" ? null : input.tiers,
      },
    },
  });

  return (await loadAiProvider(saved.id))!;
}

// ─── Features ────────────────────────────────────────────────

export interface AiFeatureCard {
  key: AiFeatureKey;
  isEnabled: boolean;
  providerId: string | null;
  modelId: string | null;
  maxOutputTokens: number | null;
  extraInstructions: string | null;
  /** Registry facts the screen names beside the switches. */
  surface: string;
  modelRole: "light" | "standard" | "heavy";
  streams: boolean;
  vision: boolean;
  registryMaxOutputTokens: number;
  /**
   * What the empty model option READS as: "Standard tier (Sonnet 5)". A blank
   * dropdown that silently means something is the bug ADR-087's key caption
   * exists to prevent, one field over — leaving a field alone has to be
   * legible as a choice.
   */
  tierModelLabel: string | null;
  /** The model a call would actually use right now, after all three steps. */
  resolvedModelLabel: string | null;
  /**
   * One call at current prices, worst case. This is the number that makes the
   * switch a decision, and it says "estimated" wherever it is rendered
   * (ADR-100 #4).
   */
  estimatedCostPerCallUsd: number | null;
}

export async function listAiFeatureCards(): Promise<AiFeatureCard[]> {
  const limits = await loadAiLimits();
  const rows = await db.aiFeature.findMany();
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const models = await listAiModels();

  const cards: AiFeatureCard[] = [];
  for (const definition of AI_FEATURES) {
    const row = byKey.get(definition.key);
    const tierModelId = limits.tiers[definition.modelRole];
    const tierModel = models.find((m) => m.modelId === tierModelId && m.isEnabled);

    let resolvedModelLabel: string | null = null;
    let estimatedCostPerCallUsd: number | null = null;
    try {
      const resolved = await resolveFeature(definition.key, { limits });
      resolvedModelLabel = resolved.model.label;
      // A rough but honest per-call figure: a typical prompt plus the full
      // output ceiling, priced the way the pre-flight check prices it.
      estimatedCostPerCallUsd = estimateCostUsd(
        { inputTokens: 2000, maxOutputTokens: resolved.maxOutputTokens },
        resolved.model,
      );
    } catch {
      // No enabled provider. The card still renders and says so — a screen that
      // throws because nothing is configured is a screen nobody can configure.
    }

    cards.push({
      key: definition.key,
      isEnabled: row?.isEnabled ?? false,
      providerId: row?.providerId ?? null,
      modelId: row?.modelId ?? null,
      maxOutputTokens: row?.maxOutputTokens ?? null,
      extraInstructions: row?.extraInstructions ?? null,
      surface: definition.surface,
      modelRole: definition.modelRole,
      streams: definition.streams,
      vision: definition.vision,
      registryMaxOutputTokens: definition.maxOutputTokens,
      tierModelLabel: tierModel?.label ?? tierModelId,
      resolvedModelLabel,
      estimatedCostPerCallUsd,
    });
  }
  return cards;
}

export async function saveAiFeature(subject: Subject, input: AiFeatureSaveInput): Promise<void> {
  if (!isAiFeatureKey(input.key)) return;

  const data = {
    isEnabled: input.isEnabled,
    providerId: input.providerId || null,
    modelId: input.modelId || null,
    maxOutputTokens: input.maxOutputTokens ?? null,
    extraInstructions: input.extraInstructions || null,
  };

  await db.aiFeature.upsert({
    where: { key: input.key },
    update: data,
    create: { key: input.key, ...data },
  });

  await recordAudit({
    userId: subject.id,
    action: "ai.feature.update",
    entityType: "AiFeature",
    entityId: input.key,
    changes: { after: { isEnabled: input.isEnabled, modelId: data.modelId } },
  });
}

// ─── Limits, tiers, and the budget ───────────────────────────

export interface AiLimitsView {
  enabled: boolean;
  maxTokensPerRequest: number;
  monthlyBudgetUsd: number;
  budgetWarnPercent: number;
  capBehavior: "DISABLE" | "NOTIFY_ONLY";
  rateLimitPerUserHour: number;
  tiers: { light: string; standard: string; heavy: string };
  budget: BudgetState;
  /** Which features resolve through each tier — the screen states the blast radius. */
  tierFeatures: { light: string[]; standard: string[]; heavy: string[] };
}

export async function loadAiLimitsView(): Promise<AiLimitsView> {
  const limits = await loadAiLimits();
  const budget = await getBudgetState({
    budgetUsd: limits.monthlyBudgetUsd,
    warnPercent: limits.budgetWarnPercent,
  });

  const tierFeatures = { light: [] as string[], standard: [] as string[], heavy: [] as string[] };
  for (const definition of AI_FEATURES) tierFeatures[definition.modelRole].push(definition.key);

  return { ...limits, budget, tierFeatures };
}

async function writeUsageLimits(subject: Subject, input: AiUsageLimitsSaveInput): Promise<void> {
  await updateSetting("ai.enabled", input.enabled, subject.id);
  await updateSetting("ai.maxTokensPerRequest", input.maxTokensPerRequest, subject.id);
  await updateSetting("ai.monthlyBudgetUsd", input.monthlyBudgetUsd, subject.id);
  await updateSetting("ai.budgetWarnPercent", input.budgetWarnPercent, subject.id);
  await updateSetting("ai.capBehavior", input.capBehavior, subject.id);
  await updateSetting("ai.rateLimitPerUserHour", input.rateLimitPerUserHour, subject.id);
}

/**
 * The setup screen's usage section — the limits without the tiers, which that
 * screen sets together with the models they must name (ADR-120).
 */
export async function saveAiUsageLimits(
  subject: Subject,
  input: AiUsageLimitsSaveInput,
): Promise<void> {
  await writeUsageLimits(subject, input);
  await applyBudgetSettings({ budgetUsd: input.monthlyBudgetUsd });
  await recordAudit({
    userId: subject.id,
    action: "ai.limits.update",
    entityType: "Setting",
    entityId: "ai",
    changes: {
      after: {
        enabled: input.enabled,
        monthlyBudgetUsd: input.monthlyBudgetUsd,
        capBehavior: input.capBehavior,
        maxTokensPerRequest: input.maxTokensPerRequest,
        rateLimitPerUserHour: input.rateLimitPerUserHour,
      },
    },
  });
}

export async function saveAiLimits(subject: Subject, input: AiLimitsSaveInput): Promise<void> {
  await writeUsageLimits(subject, input);
  await updateSetting("ai.model.light", input.modelLight, subject.id);
  await updateSetting("ai.model.standard", input.modelStandard, subject.id);
  await updateSetting("ai.model.heavy", input.modelHeavy, subject.id);

  // The visible half of "copied, not read live": changing the budget rewrites
  // the CURRENT period, and the screen says so above the field. Without this
  // an admin raising the cap would see no change until next month.
  await applyBudgetSettings({ budgetUsd: input.monthlyBudgetUsd });

  await recordAudit({
    userId: subject.id,
    action: "ai.limits.update",
    entityType: "Setting",
    entityId: "ai",
    changes: {
      after: {
        enabled: input.enabled,
        monthlyBudgetUsd: input.monthlyBudgetUsd,
        capBehavior: input.capBehavior,
        tiers: { light: input.modelLight, standard: input.modelStandard, heavy: input.modelHeavy },
      },
    },
  });
}

/**
 * Zero the current period's spend.
 *
 * Audited, because a spend cap that only a deploy can lift is a cap that gets
 * worked around — and because "who turned the meter back to zero" is exactly
 * the question an audit log exists to answer.
 */
export async function resetAiBudget(subject: Subject): Promise<void> {
  const limits = await loadAiLimits();
  const before = await getBudgetState({
    budgetUsd: limits.monthlyBudgetUsd,
    warnPercent: limits.budgetWarnPercent,
  });

  await resetBudgetPeriod({ budgetUsd: limits.monthlyBudgetUsd });

  await recordAudit({
    userId: subject.id,
    action: "ai.budget.reset",
    entityType: "AiBudgetPeriod",
    entityId: currentPeriod(),
    changes: { after: { clearedSpendUsd: before.spentUsd, budgetUsd: limits.monthlyBudgetUsd } },
  });
}

// ─── The usage dashboard (A7) ────────────────────────────────

export interface AiUsageDashboardInput {
  since: Date;
  filter?: AiUsageFilter;
  limit?: number;
  cursor?: string | null;
}

export interface AiUsageDashboardRow {
  id: string;
  feature: string;
  provider: AiProviderKind;
  modelId: string;
  status: AiCallStatus;
  reason: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  createdAt: Date;
  /** The staff member's display name, resolved here so the screen renders no id. */
  actorName: string | null;
  entityType: string | null;
  entityId: string | null;
}

export async function loadAiUsageRows(input: AiUsageDashboardInput): Promise<{
  rows: AiUsageDashboardRow[];
  nextCursor: string | null;
}> {
  const page = await listUsageRows({
    since: input.since,
    feature: input.filter?.feature ?? null,
    status: input.filter?.status ?? null,
    userId: input.filter?.userId ?? null,
    limit: input.limit ?? 50,
    cursor: input.cursor ?? null,
  });

  const userIds = [...new Set(page.rows.map((r) => r.userId).filter((id): id is string => !!id))];
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, firstName: true, lastName: true },
      })
    : [];
  const nameById = new Map(
    users.map((u) => [
      u.id,
      // ADR-044 #5: a raw identifier never renders. A deleted account's rows
      // survive with `userId: null`, and the screen shows nothing rather than
      // a cuid.
      [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || null,
    ]),
  );

  return {
    rows: page.rows.map((row) => ({
      id: row.id,
      feature: row.feature,
      provider: row.provider,
      modelId: row.modelId,
      status: row.status,
      reason: row.reason,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      costUsd: row.costUsd,
      durationMs: row.durationMs,
      createdAt: row.createdAt,
      actorName: row.userId ? (nameById.get(row.userId) ?? null) : null,
      entityType: row.entityType,
      entityId: row.entityId,
    })),
    nextCursor: page.nextCursor,
  };
}

export async function loadAiUsageSummary(since: Date): Promise<AiUsageSummary> {
  return summarizeUsage(since);
}

export async function loadAiUsageSeries(since: Date): Promise<AiUsageDailyPoint[]> {
  return usageDailySeries(since);
}

/** The "prices last updated" date beside every spend figure (ADR-100 #2). */
export async function loadPricesUpdatedAt(): Promise<Date | null> {
  const row = await db.aiModel.findFirst({
    where: { isEnabled: true },
    orderBy: { pricedAt: "desc" },
    select: { pricedAt: true },
  });
  return row?.pricedAt ?? null;
}

// ─── Generation, with the notification the package cannot send ──

/**
 * Who hears about a budget threshold.
 *
 * Holders of `ai.settings.manage` — the people who can actually raise the cap.
 * Resolved from roles and direct grants, and `recordNotification` is
 * best-effort by contract (ADR-014), so a failed notice never fails the
 * generation it decorates.
 */
export async function notifyAiBudget(event: "warning" | "capped"): Promise<void> {
  const grants = await db.userPermission.findMany({
    where: { permission: { key: "ai.settings.manage" }, effect: "ALLOW" },
    select: { userId: true },
  });
  const roleGrants = await db.userRole.findMany({
    where: { role: { permissions: { some: { permission: { key: "ai.settings.manage" } } } } },
    select: { userId: true },
  });

  const denied = new Set(
    (
      await db.userPermission.findMany({
        where: { permission: { key: "ai.settings.manage" }, effect: "DENY" },
        select: { userId: true },
      })
    ).map((row) => row.userId),
  );

  // Deny beats allow (security.md #2), even for a notification: somebody whose
  // access was explicitly removed should not keep receiving the alerts it came
  // with.
  const recipients = [...new Set([...grants, ...roleGrants].map((row) => row.userId))].filter(
    (id) => !denied.has(id),
  );

  for (const userId of recipients) {
    await recordNotification({
      userId,
      type: event === "capped" ? "aiBudgetReached" : "aiBudgetWarning",
      href: "/admin/ai/limits",
    });
  }
}

/** The retention sweep, called by `/api/cron/housekeeping`. */
export async function purgeAiUsage(days = AI_USAGE_RETENTION_DAYS): Promise<number> {
  return purgeUsageOlderThan(days);
}
