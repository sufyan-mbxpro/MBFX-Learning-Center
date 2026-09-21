// The closed reason taxonomy (ADR-097 #7).
//
// Every refusal and every failure resolves to one of these strings, and that
// string is what the usage row stores. It is deliberately NOT the provider's
// own message: a provider error can quote the prompt back, and a log that
// holds quoted prompts is the second copy of unpublished drafts that ADR-078
// #10 keeps out of the delivery log.
//
// The admin UI maps each value to one catalog string. A value added here needs
// a catalog key in the same PR; `ai.test.ts` is what says so.

export const AI_REASONS = [
  // Refused by us, before any HTTP call.
  "globally_disabled",
  "feature_disabled",
  "budget_exceeded",
  "rate_limited",
  "no_provider",
  "missing_key",
  "secret_unreadable",
  "content_too_large",
  // The request carries an image and the resolved model is not marked
  // "Reads images". Its own reason: reported as `content_too_large` it sent
  // admins resizing a 200 KB photo that was never the problem.
  "model_no_vision",
  // The provider answered, or failed to.
  "provider_auth",
  "provider_rate_limit",
  "provider_timeout",
  "provider_error",
  "invalid_output",
  // The caller went away.
  "aborted",
] as const;

export type AiReason = (typeof AI_REASONS)[number];

/** Reasons that mean "we declined": zero cost, and no HTTP request happened. */
export const AI_REFUSAL_REASONS = [
  "globally_disabled",
  "feature_disabled",
  "budget_exceeded",
  "rate_limited",
  "no_provider",
  "missing_key",
  "secret_unreadable",
  "content_too_large",
  // The request carries an image and the resolved model is not marked
  // "Reads images". Its own reason: reported as `content_too_large` it sent
  // admins resizing a 200 KB photo that was never the problem.
  "model_no_vision",
] as const satisfies readonly AiReason[];

export function isRefusalReason(reason: AiReason): boolean {
  return (AI_REFUSAL_REASONS as readonly string[]).includes(reason);
}

/**
 * Every failure this package raises.
 *
 * `message` is for a developer reading a stack trace; `reason` is what the
 * usage row and the admin screen use. Nothing downstream should ever render
 * `message` — that is the rule the taxonomy exists to make easy to follow.
 */
export class AiError extends Error {
  readonly reason: AiReason;

  constructor(reason: AiReason, message?: string) {
    super(message ?? reason);
    this.name = "AiError";
    this.reason = reason;
  }
}

/**
 * Map an unknown thrown value onto the taxonomy.
 *
 * Both SDKs expose a `status` on their API errors, which is all we read: the
 * body may quote the request. An `AbortError` is the client going away, not a
 * provider fault, and it is the one case that still meters what was billed.
 */
export function classifyProviderError(error: unknown): AiReason {
  if (error instanceof AiError) return error.reason;

  const name = (error as { name?: unknown })?.name;
  if (name === "AbortError" || name === "APIUserAbortError") return "aborted";
  if (name === "TimeoutError" || name === "APIConnectionTimeoutError") return "provider_timeout";

  const status = (error as { status?: unknown })?.status;
  if (typeof status === "number") {
    if (status === 401 || status === 403) return "provider_auth";
    if (status === 408) return "provider_timeout";
    if (status === 413) return "content_too_large";
    if (status === 429) return "provider_rate_limit";
  }
  return "provider_error";
}
