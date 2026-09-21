// The one door (ADR-097 #2).
//
// Order of operations, and every step before the call is a refusal point that
// writes a `REFUSED` row rather than throwing an opaque error:
//
//   1. `ai.enabled`?                    → globally_disabled
//   2. `AiFeature.isEnabled`?           → feature_disabled
//   3. budget capped + DISABLE?         → budget_exceeded
//   4. per-user hourly window?          → rate_limited
//   5. resolve provider + model         → no_provider
//   6. build the request from the CODE builder, clamp the ceiling
//   7. pre-flight worst case vs the cap → budget_exceeded
//   8. call the driver
//   9. **finally: meter** — row + rollup + period counter, one transaction
//  10. evaluate the budget transition, at most once per period
//
// Step 9 being in the `finally` and not on the happy path is the difference
// between a meter and an optimist.
import {
  AI_PAYLOAD_SCHEMAS,
  type AiDiscoveredModel,
  type AiEffort,
  type AiFeatureKey,
  type AiModelRole,
} from "@repo/contracts";
import type { AiProviderKind } from "@repo/db";

import { claimBudgetEvent, getBudgetState, type BudgetEvent } from "./budget.ts";
import {
  loadAiLimits,
  loadEnabledFeatureKeys,
  resolveFeature,
  type AiLimits,
  type ResolvedFeature,
} from "./config.ts";
import { AiError, classifyProviderError, type AiReason } from "./errors.ts";
import { computeCostUsd, estimateCostUsd } from "./pricing.ts";
import { buildPrompt } from "./prompts/index.ts";
import {
  driverForKey,
  loadProviderDriver,
  type AiDriver,
  type AiImage,
  type AiRequest,
  type AiUsageCounts,
} from "./provider.ts";
import { countRecentCalls, recordUsage } from "./usage.ts";

export interface AiTaskInput<K extends AiFeatureKey = AiFeatureKey> {
  feature: K;
  /** Parsed by the feature's own `@repo/contracts` schema before it is used. */
  payload: unknown;
  /** For the usage row. **NOT an authorization input** — the route did that. */
  actorId?: string | null;
  entity?: { type: string; id: string } | null;
  images?: readonly AiImage[];
  /** An action inside a feature may ask for its own tier (ADR-099 #4). */
  modelRole?: AiModelRole;
  effort?: AiEffort;
  signal?: AbortSignal;
  /**
   * Called at most once per period when the budget crosses a threshold.
   *
   * `@repo/ai` never notifies, because it does not know who a subject is: the
   * caller in `@repo/core` supplies a handler that reaches `recordNotification`.
   * Best-effort by the same contract — a throw here never fails the task.
   */
  onBudgetEvent?: (event: BudgetEvent) => Promise<void> | void;
}

export interface AiTaskResult {
  text: string;
  feature: AiFeatureKey;
  modelId: string;
  provider: AiProviderKind;
  usage: AiUsageCounts;
  costUsd: number;
  durationMs: number;
}

interface Prepared {
  resolved: ResolvedFeature;
  request: AiRequest;
  driver: AiDriver;
  limits: AiLimits;
}

/**
 * Write the refusal row and return the error to throw.
 *
 * It RETURNS rather than throws so that every call site reads
 * `throw await refusal(...)` — an `await` of a `Promise<never>` does not tell
 * TypeScript the code after it is unreachable, and the alternative was a file
 * full of definite-assignment noise around a function that always throws.
 */
async function refusal(
  input: AiTaskInput,
  reason: AiReason,
  context?: { modelId?: string; provider?: AiProviderKind },
): Promise<AiError> {
  await recordUsage({
    feature: input.feature,
    // A refusal before a provider is resolved still needs a provider column.
    // ECHO is the honest value: nothing was called.
    provider: context?.provider ?? "ECHO",
    modelId: context?.modelId ?? "-",
    status: "REFUSED",
    reason,
    costUsd: 0,
    userId: input.actorId ?? null,
    entityType: input.entity?.type ?? null,
    entityId: input.entity?.id ?? null,
  });
  return new AiError(reason);
}

/** Steps 1–7. Everything that can refuse, before anything can cost money. */
async function prepare(input: AiTaskInput): Promise<Prepared> {
  const limits = await loadAiLimits();

  if (!limits.enabled) throw await refusal(input, "globally_disabled");

  const enabled = await loadEnabledFeatureKeys();
  if (!enabled.has(input.feature)) throw await refusal(input, "feature_disabled");

  const budget = await getBudgetState({
    budgetUsd: limits.monthlyBudgetUsd,
    warnPercent: limits.budgetWarnPercent,
  });
  // NOTIFY_ONLY keeps serving and keeps warning. It exists because "the CMS
  // must keep working" and "stop spending" can genuinely conflict at 3am before
  // a launch, and that is the owner's call to make in a form.
  if (budget.status === "capped" && limits.capBehavior === "DISABLE") {
    throw await refusal(input, "budget_exceeded");
  }

  if (input.actorId) {
    const recent = await countRecentCalls(input.actorId);
    if (recent >= limits.rateLimitPerUserHour) throw await refusal(input, "rate_limited");
  }

  let resolved: ResolvedFeature;
  try {
    resolved = await resolveFeature(input.feature, {
      limits,
      ...(input.modelRole ? { modelRole: input.modelRole } : {}),
      ...(input.effort ? { effort: input.effort } : {}),
    });
  } catch (error) {
    throw await refusal(input, error instanceof AiError ? error.reason : "no_provider");
  }

  // Parse, don't spread (security.md #6). The payload reaches a builder only
  // after its own schema has accepted it.
  const schema = AI_PAYLOAD_SCHEMAS[input.feature];
  const parsed = schema.safeParse(input.payload);
  if (!parsed.success) throw new AiError("invalid_output", "Payload failed its schema");

  const images = input.images ?? [];
  if (images.length > 0 && !resolved.model.supportsVision) {
    throw await refusal(input, "model_no_vision", {
      modelId: resolved.model.modelId,
      provider: resolved.model.providerKind,
    });
  }

  const prompt = buildPrompt(input.feature, parsed.data as never, resolved.extraInstructions);

  const request: AiRequest = {
    modelId: resolved.model.modelId,
    system: prompt.system,
    messages: prompt.messages,
    maxOutputTokens: resolved.maxOutputTokens,
    effort: resolved.effort,
    ...(images.length > 0 ? { images } : {}),
  };

  let driver: AiDriver;
  try {
    driver = await loadProviderDriver(resolved.model.providerId);
  } catch (error) {
    throw await refusal(input, error instanceof AiError ? error.reason : "no_provider", {
      modelId: resolved.model.modelId,
      provider: resolved.model.providerKind,
    });
  }

  // Step 7 — the pre-flight worst case. It over-estimates on purpose: a budget
  // check that under-estimates is not a budget (ADR-100 #1).
  //
  // Skipped entirely under NOTIFY_ONLY. Without that, the pre-flight refusal
  // would stop calls the moment the cap was reached and NOTIFY_ONLY would
  // behave exactly like DISABLE — a setting that looks like a choice and is
  // not, which is the failure ADR-096 named in another domain.
  if (!budget.unlimited && limits.capBehavior === "DISABLE") {
    let inputTokens = 0;
    try {
      inputTokens = await driver.countInputTokens(request);
    } catch {
      // A provider that cannot count is not a provider that may skip the check.
      // Fall back to the request's own length, still over-estimated.
      inputTokens = Math.ceil(
        (request.system.length + request.messages.reduce((n, m) => n + m.content.length, 0)) / 3,
      );
    }
    const worstCase = estimateCostUsd(
      { inputTokens, maxOutputTokens: request.maxOutputTokens },
      resolved.model,
    );
    if (worstCase > budget.availableUsd) {
      throw await refusal(input, "budget_exceeded", {
        modelId: resolved.model.modelId,
        provider: resolved.model.providerKind,
      });
    }
  }

  return { resolved, request, driver, limits };
}

/** Step 10, best-effort by contract like the notification it triggers. */
async function settleBudget(input: AiTaskInput, limits: AiLimits): Promise<void> {
  try {
    const { event } = await claimBudgetEvent({ warnPercent: limits.budgetWarnPercent });
    if (event && input.onBudgetEvent) await input.onBudgetEvent(event);
  } catch {
    // A failed budget notice must never fail the task it decorates (ADR-014's
    // contract, one domain over).
  }
}

/** One non-streaming generation. */
export async function runAiTask<K extends AiFeatureKey>(
  input: AiTaskInput<K>,
): Promise<AiTaskResult> {
  const { resolved, request, driver, limits } = await prepare(input);
  const startedAt = Date.now();

  let usage: AiUsageCounts = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  let status: "OK" | "FAILED" | "ABORTED" = "OK";
  let reason: AiReason | null = null;
  let text = "";

  try {
    const result = await driver.complete(request, input.signal);
    text = result.text;
    usage = result.usage;
  } catch (error) {
    reason = classifyProviderError(error);
    status = reason === "aborted" ? "ABORTED" : "FAILED";
    throw new AiError(reason, (error as Error)?.message);
  } finally {
    const costUsd = computeCostUsd(usage, resolved.model);
    await recordUsage({
      feature: input.feature,
      provider: resolved.model.providerKind,
      modelId: resolved.model.modelId,
      status,
      reason,
      ...usage,
      costUsd,
      durationMs: Date.now() - startedAt,
      userId: input.actorId ?? null,
      entityType: input.entity?.type ?? null,
      entityId: input.entity?.id ?? null,
    });
    await settleBudget(input, limits);
  }

  return {
    text,
    feature: input.feature,
    modelId: resolved.model.modelId,
    provider: resolved.model.providerKind,
    usage,
    costUsd: computeCostUsd(usage, resolved.model),
    durationMs: Date.now() - startedAt,
  };
}

/**
 * The streaming door — the same list, with step 8 an async iterable and step 9
 * moved into the stream's own `finally`, so an abort still meters.
 */
export async function* streamAiTask<K extends AiFeatureKey>(
  input: AiTaskInput<K>,
): AsyncGenerator<string, void, undefined> {
  const { resolved, request, driver, limits } = await prepare(input);
  const startedAt = Date.now();

  let usage: AiUsageCounts = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  let status: "OK" | "FAILED" | "ABORTED" = "OK";
  let reason: AiReason | null = null;

  try {
    for await (const chunk of driver.stream(request, input.signal)) {
      if (chunk.usage) usage = chunk.usage;
      if (chunk.text) yield chunk.text;
    }
  } catch (error) {
    reason = classifyProviderError(error);
    status = reason === "aborted" ? "ABORTED" : "FAILED";
    throw new AiError(reason, (error as Error)?.message);
  } finally {
    // A generator abandoned by its consumer runs this too — which is the whole
    // reason the counts are accumulated as they arrive rather than read at the
    // end. Tokens seen so far are still billed by the provider.
    await recordUsage({
      feature: input.feature,
      provider: resolved.model.providerKind,
      modelId: resolved.model.modelId,
      status,
      reason,
      ...usage,
      costUsd: computeCostUsd(usage, resolved.model),
      durationMs: Date.now() - startedAt,
      userId: input.actorId ?? null,
      entityType: input.entity?.type ?? null,
      entityId: input.entity?.id ?? null,
    });
    await settleBudget(input, limits);
  }
}

// ─── The test-connection path ────────────────────────────────

export interface ProviderTestResult {
  ok: boolean;
  /** A taxonomy reason, never a provider message. */
  reason: AiReason | null;
}

/**
 * Prove a credential without committing it.
 *
 * `apiKey` may be the one the admin has just typed (the field is write-only, so
 * an unsaved key has nowhere else to be proved) or omitted, in which case the
 * stored one is used. Either way it is used once and never returned.
 */
export interface ModelDiscoveryResult {
  ok: boolean;
  reason: AiReason | null;
  models: AiDiscoveredModel[];
}

/**
 * Test a connection AND read the provider's model list (ADR-120).
 *
 * Same key rule as `testProviderConnection`: a typed key is used once and never
 * returned; without one the STORED key is opened by `loadProviderDriver()`,
 * which stays its only reader. `test()` runs first because on one gateway the
 * list is public and would pass on any key at all.
 */
export async function discoverProviderModels(input: {
  providerId?: string | null;
  kind: AiProviderKind;
  apiKey?: string;
  baseUrl?: string | null;
}): Promise<ModelDiscoveryResult> {
  try {
    if (input.kind !== "ECHO" && !input.apiKey && !input.providerId) {
      throw new AiError("missing_key", "No key typed and no stored provider");
    }
    const driver =
      input.apiKey || input.kind === "ECHO" || !input.providerId
        ? driverForKey({
            kind: input.kind,
            apiKey: input.apiKey ?? "",
            baseUrl: input.baseUrl ?? null,
          })
        : await loadProviderDriver(input.providerId, {
            includeDisabled: true,
            baseUrl: input.baseUrl ?? null,
          });
    await driver.test();
    const models = await driver.listModels();
    return { ok: true, reason: null, models };
  } catch (error) {
    return { ok: false, reason: classifyProviderError(error), models: [] };
  }
}

export async function testProviderConnection(input: {
  providerId?: string;
  kind?: AiProviderKind;
  apiKey?: string;
  baseUrl?: string | null;
}): Promise<ProviderTestResult> {
  try {
    const driver =
      input.apiKey && input.kind
        ? driverForKey({ kind: input.kind, apiKey: input.apiKey, baseUrl: input.baseUrl ?? null })
        : await loadProviderDriver(input.providerId ?? "");
    await driver.test();
    return { ok: true, reason: null };
  } catch (error) {
    return { ok: false, reason: classifyProviderError(error) };
  }
}
