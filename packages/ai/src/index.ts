// @repo/ai — the AI platform (Module 18, ADR-097/098/099/100).
//
// **One door.** `runAiTask` and `streamAiTask` are the only exports that reach
// a provider, and metering lives in their `finally` — a feature cannot forget
// to log because a feature never logs. `index.test.ts` pins this export
// surface, so a later `export { anthropicDriver }` fails the suite rather than
// quietly giving a caller a second way in.
//
// **AI never writes to the database.** Nothing in this package writes anything
// but its own usage, rollup and budget rows. Every result lands in a form field
// a human then saves through the existing action, with the existing Zod schema
// and the existing permission check — which is what makes a prompt injection
// produce, at worst, a bad suggestion an admin reads and discards.

export { runAiTask, streamAiTask, type AiTaskInput, type AiTaskResult } from "./run.ts";

export { getAiAvailability, type AiAvailability } from "./availability.ts";

export {
  loadAiLimits,
  resolveFeature,
  loadEnabledFeatureKeys,
  type AiLimits,
  type ResolvedFeature,
  type ResolvedModel,
} from "./config.ts";

export {
  getBudgetState,
  currentPeriod,
  applyBudgetSettings,
  resetBudgetPeriod,
  type BudgetState,
  type BudgetStatus,
} from "./budget.ts";

export {
  computeCostUsd,
  estimateCostUsd,
  formatUsd,
  type ModelPrices,
  type TokenCounts,
} from "./pricing.ts";

export {
  AI_REASONS,
  AI_REFUSAL_REASONS,
  AiError,
  isRefusalReason,
  type AiReason,
} from "./errors.ts";

export {
  AI_SECRET_KEY_ENV,
  AiSecretInvalidError,
  AiSecretKeyMissingError,
  generateAiSecretKey,
  hasAiSecretKey,
  sealAiSecret,
} from "./secret.ts";

// The "test connection" path, and the one key reader's public face. Note what
// is NOT exported: `loadProviderDriver` itself, the three drivers, and anything
// that would let a caller build a request without going through the door.
export { testProviderConnection, type ProviderTestResult } from "./run.ts";

export { buildPrompt, PROMPT_BUILDERS, type BuiltPrompt } from "./prompts/index.ts";

export type { AiImage, AiRequest, AiResult, AiUsageCounts, AiChunk } from "./provider.ts";

export {
  listUsageRows,
  summarizeUsage,
  usageDailySeries,
  purgeUsageOlderThan,
  AI_USAGE_RETENTION_DAYS,
  type AiUsageRow,
  type AiUsageSummary,
  type AiUsageDailyPoint,
} from "./usage.ts";
