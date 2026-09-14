// Tokens + a price row → a dollar figure (ADR-100).
//
// Four properties, and each one had an alternative that was rejected:
//
//  1. **Tokens are never estimated by us** where the provider reports them.
//     Every response carries a `usage` block; a local tokenizer is a
//     third-party guess at a first-party fact, and it is wrong for exactly the
//     cases that cost most — cache reads, images, thinking tokens.
//  2. **Prices are DATA**, read from an `AiModel` row. A `PRICES` constant
//     makes a price correction a deploy.
//  3. **The figure is frozen at write time.** `AiUsage.costUsd` stores the
//     number computed from the price in force when the call happened; joining
//     today's price at read time would make every historical chart change
//     shape when an admin fixes a typo.
//  4. **The word "estimated" stays on every figure in the UI.** Rounding,
//     per-request minimums and provider-side discounts make our arithmetic
//     close, not authoritative — ADR-088's discipline in a new domain.
//
// Everything here is pure, and it holds the 90% floor: a wrong cost figure is a
// wrong invoice, and this is the only file that computes one.

export interface ModelPrices {
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  /**
   * `null` means "price them as input", which is the honest answer for a
   * provider that does not report cache reads separately — never 0, which would
   * quietly make the cheapest tokens free.
   */
  cachedInputPricePerMTok: number | null;
}

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

const PER_MILLION = 1_000_000;

/** Six decimal places — the `Decimal(12, 6)` the column stores. */
const SCALE = 1_000_000;

/**
 * Round to the column's precision.
 *
 * Done once, at the end, on the total: rounding each leg separately would
 * accumulate a bias, and the bias would be upward for every row with three
 * legs. A negative token count cannot produce a negative cost — a provider
 * reporting nonsense should show as zero, not as a credit.
 */
function round6(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * SCALE) / SCALE;
}

/** What one call cost, in USD, at the prices in force right now. */
export function computeCostUsd(tokens: TokenCounts, prices: ModelPrices): number {
  const input = Math.max(0, tokens.inputTokens);
  const output = Math.max(0, tokens.outputTokens);
  const cached = Math.max(0, tokens.cachedInputTokens);

  const cachedRate = prices.cachedInputPricePerMTok ?? prices.inputPricePerMTok;

  const total =
    (input * Math.max(0, prices.inputPricePerMTok)) / PER_MILLION +
    (output * Math.max(0, prices.outputPricePerMTok)) / PER_MILLION +
    (cached * Math.max(0, cachedRate)) / PER_MILLION;

  return round6(total);
}

/**
 * The PRE-FLIGHT worst case, used by the budget check before any HTTP call.
 *
 * It deliberately over-estimates: the input count is the provider's own, and
 * the output count is the request's full ceiling rather than a likely length.
 * A 700-token SEO call is therefore estimated at its ceiling, not at its likely
 * 200 — which is why the last few dollars of a budget period are effectively
 * unusable (ADR-100's consequence, and the reason the limits screen shows
 * "available to spend" rather than only "spent").
 *
 * The alternative — estimate optimistically and overshoot the cap — fails the
 * one job the cap has.
 */
export function estimateCostUsd(
  input: { inputTokens: number; maxOutputTokens: number },
  prices: ModelPrices,
): number {
  return computeCostUsd(
    {
      inputTokens: Math.max(0, input.inputTokens),
      outputTokens: Math.max(0, input.maxOutputTokens),
      cachedInputTokens: 0,
    },
    prices,
  );
}

/** A dollar figure for a screen. The caller adds the word "estimated". */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0.00";
  // Below a cent, two decimals reads as "$0.00" — which is a claim that it was
  // free. Four decimals is what makes a per-call cost legible at all.
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}
