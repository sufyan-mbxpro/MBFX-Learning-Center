// Market statistics (Module 13, changes-25 T2) — pure, no I/O, 90% floor.
//
// ADR-088 decides what these numbers MEAN; this file is the only place that
// computes them, which is why the "not enough data" decision is made here and
// not in eight render sites. **Every function returns `null` rather than a
// number when the sample is below its minimum** — a coefficient computed from
// twelve points and printed to two decimals is a lie with a confident face.

/** `ln(close_t / close_t-1)` for each consecutive pair. */
export function logReturns(closes: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1]!;
    const curr = closes[i]!;
    // A non-positive or missing close has no log return. Skipping the PAIR
    // rather than the series keeps a single bad print from voiding a window.
    if (prev > 0 && curr > 0 && Number.isFinite(prev) && Number.isFinite(curr)) {
      out.push(Math.log(curr / prev));
    }
  }
  return out;
}

/**
 * Pearson's r over two equal-length samples.
 *
 * `null` when the samples differ in length, are shorter than 2, or either has
 * zero variance — a flat series correlates with nothing, and the formula would
 * divide by zero to say so.
 *
 * The result is clamped into [−1, 1]: floating-point error can put a perfect
 * correlation at 1.0000000000000002, and a bar that renders a coefficient as a
 * width would then overflow its track.
 */
export function pearson(a: readonly number[], b: readonly number[]): number | null {
  const n = a.length;
  if (n !== b.length || n < 2) return null;

  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i += 1) {
    sumA += a[i]!;
    sumB += b[i]!;
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i]! - meanA;
    const db = b[i]! - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA <= 0 || varB <= 0) return null;

  const r = cov / Math.sqrt(varA * varB);
  if (!Number.isFinite(r)) return null;
  return Math.max(-1, Math.min(1, r));
}

export interface CorrelationSeries {
  key: string;
  /** Daily closes, OLDEST first. */
  closes: readonly number[];
}

/** `matrix[a][b]` is a's correlation to b, or `null` below the minimum. */
export type CorrelationMatrix = Record<string, Record<string, number | null>>;

/**
 * Pearson over LOG RETURNS of closes, pairwise, for one window.
 *
 * Log returns, not prices (ADR-088 #1): price-level correlation reports two
 * trending series as correlated when their day-to-day moves are unrelated,
 * which is the exact misreading the tool exists to prevent.
 *
 * `window` is in RETURNS, so a 30d window needs 31 closes. A series with fewer
 * contributes `null` to every cell it appears in rather than a coefficient
 * computed from whatever it had.
 */
export function correlationMatrix(
  series: readonly CorrelationSeries[],
  window: number,
): CorrelationMatrix {
  if (window < 2) throw new RangeError("window must be at least 2 returns");

  const returns = new Map<string, number[] | null>();
  for (const s of series) {
    const all = logReturns(s.closes);
    returns.set(s.key, all.length >= window ? all.slice(-window) : null);
  }

  const matrix: CorrelationMatrix = {};
  for (const rowSeries of series) {
    const row: Record<string, number | null> = {};
    const a = returns.get(rowSeries.key) ?? null;
    for (const colSeries of series) {
      if (rowSeries.key === colSeries.key) {
        // Self-correlation is 1 by definition — but only when there is a
        // sample at all. A series with no data correlates with nothing,
        // including itself, and printing 1.00 there would be the one cell in
        // the row that looked like it had reported.
        row[colSeries.key] = a === null ? null : 1;
        continue;
      }
      const b = returns.get(colSeries.key) ?? null;
      row[colSeries.key] = a === null || b === null ? null : pearson(a, b);
    }
    matrix[rowSeries.key] = row;
  }
  return matrix;
}

/**
 * Where `value` sits in `sample`, as a percentage 0–100.
 *
 * The "mean rank" definition: ties count half, so a value equal to every other
 * value ranks at 50 rather than at 0 or 100. `null` for an empty sample.
 */
export function percentileRank(value: number, sample: readonly number[]): number | null {
  if (sample.length === 0 || !Number.isFinite(value)) return null;
  let below = 0;
  let equal = 0;
  for (const x of sample) {
    if (!Number.isFinite(x)) continue;
    if (x < value) below += 1;
    else if (x === value) equal += 1;
  }
  const counted = sample.filter((x) => Number.isFinite(x)).length;
  if (counted === 0) return null;
  return ((below + equal / 2) / counted) * 100;
}

export type RiskBand = "risk-off" | "neutral" | "risk-on";

export interface RiskComponentInput {
  key: string;
  /** Daily closes, OLDEST first. */
  closes: readonly number[];
  /** Relative weight; normalised here, never assumed to sum to anything. */
  weight: number;
  /** Which way this instrument moves when risk is ON. */
  direction: "risk-on" | "risk-off";
}

export interface RiskComponentContribution {
  key: string;
  /** 0–100 after the direction flip; what the gauge draws. */
  score: number;
  /** The raw percentile rank of the latest return, before the flip. */
  rank: number;
  weight: number;
  direction: "risk-on" | "risk-off";
}

export interface RiskSentimentResult {
  /** 0–100, or `null` when nothing in the basket could report. */
  score: number | null;
  band: RiskBand | null;
  contributions: RiskComponentContribution[];
  reporting: { reported: number; total: number; excluded: string[] };
}

export interface RiskSentimentOptions {
  /** Trading days of history the rank is taken over. */
  lookback: number;
  bands: { riskOffBelow: number; riskOnAbove: number };
}

/**
 * ADR-088 #4: a weighted mean of per-component percentile ranks, signed by
 * direction, on a 0–100 scale.
 *
 * Percentile rank rather than a z-score because a return distribution has fat
 * tails, and a z-score turns one 2008-shaped day into a score of 100 for a
 * week. A rank is bounded by construction and says something a reader can
 * restate out loud.
 *
 * **A component that cannot report is excluded and counted, never
 * zero-filled** (ADR-088 #5). A zero-fill is a claim that the market was
 * neutral; an exclusion is the truth, which is that we do not know.
 */
export function riskSentimentScore(
  components: readonly RiskComponentInput[],
  { lookback, bands }: RiskSentimentOptions,
): RiskSentimentResult {
  if (lookback < 2) throw new RangeError("lookback must be at least 2");

  const contributions: RiskComponentContribution[] = [];
  const excluded: string[] = [];

  for (const component of components) {
    const returns = logReturns(component.closes);
    const latest = returns[returns.length - 1];
    // The rank needs a history to rank AGAINST, so the window excludes the
    // value being ranked — otherwise every component is compared with a
    // sample it is a member of, and a short series ranks itself at 100.
    const history = returns.slice(-lookback, -1);
    const rank =
      latest === undefined || history.length < 2 ? null : percentileRank(latest, history);

    if (rank === null || component.weight <= 0) {
      excluded.push(component.key);
      continue;
    }
    contributions.push({
      key: component.key,
      rank,
      // A risk-off instrument (gold, the yen, treasuries) rising is risk
      // coming OFF, so its rank is flipped before it joins the mean.
      score: component.direction === "risk-off" ? 100 - rank : rank,
      weight: component.weight,
      direction: component.direction,
    });
  }

  const reporting = {
    reported: contributions.length,
    total: components.length,
    excluded,
  };

  if (contributions.length === 0) {
    return { score: null, band: null, contributions, reporting };
  }

  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
  // Guarded rather than assumed: the contract refuses a basket whose weights
  // sum to zero (ADR-088 #6), and this is the second lock on the same door.
  if (totalWeight <= 0) {
    return { score: null, band: null, contributions, reporting };
  }

  // Clamped for `pearson`'s reason: a weighted mean of values that are each
  // at most 100 can land on 100.00000000000001, and a gauge that draws the
  // score as a width would then overflow its own track.
  const score = Math.max(
    0,
    Math.min(100, contributions.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight),
  );
  const band: RiskBand =
    score < bands.riskOffBelow ? "risk-off" : score > bands.riskOnAbove ? "risk-on" : "neutral";

  return { score, band, contributions, reporting };
}

// ─── Volatility (ADR-136 §3) ─────────────────────────────────

export interface RangeBar {
  high: number;
  low: number;
  close: number;
}

/** Sessions each timeframe averages over. Trading sessions, not calendar days: a forex bar does not exist on a Saturday. */
export const VOLATILITY_WINDOWS = { daily: 1, weekly: 5, monthly: 22 } as const;

export type VolatilityTimeframe = keyof typeof VOLATILITY_WINDOWS;

/** The baseline "Average" is taken over, the same for every timeframe so Trend always compares against one ruler. */
export const VOLATILITY_BASELINE = 66;

export type VolatilityLevel = "low" | "medium" | "high" | "extreme";

/** The reference's published bands, applied to a range in percent. */
export const VOLATILITY_LEVELS = { mediumFrom: 0.5, highFrom: 1, extremeFrom: 2 } as const;

/**
 * One session's range as a share of its close: (high − low) ÷ close × 100.
 *
 * `null` for a bar that cannot be a real print: a non-positive close, a low
 * above its high, or anything non-finite.
 */
export function rangePercent(bar: RangeBar): number | null {
  const { high, low, close } = bar;
  if (![high, low, close].every(Number.isFinite) || close <= 0 || low < 0 || high < low) {
    return null;
  }
  return ((high - low) / close) * 100;
}

function validBars(bars: readonly RangeBar[]): RangeBar[] {
  return bars.filter((bar) => rangePercent(bar) !== null);
}

/**
 * The mean range % over the last `sessions` valid bars (bars OLDEST first).
 *
 * `null` below the window's own length (ADR-088 #3): an "average of 22
 * sessions" computed from 9 is a different number wearing that label. A bad
 * print is skipped rather than voiding the window, as `logReturns` does.
 */
export function meanRangePercent(bars: readonly RangeBar[], sessions: number): number | null {
  if (sessions < 1) throw new RangeError("sessions must be at least 1");
  const window = validBars(bars).slice(-sessions);
  if (window.length < sessions) return null;
  return window.reduce((sum, bar) => sum + rangePercent(bar)!, 0) / sessions;
}

/** The absolute distance from the lowest low to the highest high over the last `sessions` valid bars, or `null` below that length. */
export function priceRange(bars: readonly RangeBar[], sessions: number): number | null {
  if (sessions < 1) throw new RangeError("sessions must be at least 1");
  const window = validBars(bars).slice(-sessions);
  if (window.length < sessions) return null;
  return Math.max(...window.map((bar) => bar.high)) - Math.min(...window.map((bar) => bar.low));
}

export function volatilityLevel(percent: number): VolatilityLevel {
  if (percent >= VOLATILITY_LEVELS.extremeFrom) return "extreme";
  if (percent >= VOLATILITY_LEVELS.highFrom) return "high";
  if (percent >= VOLATILITY_LEVELS.mediumFrom) return "medium";
  return "low";
}

export interface VolatilityReading {
  /** Mean range % over the timeframe's window, or `null` below it. */
  current: number | null;
  /** Mean range % over the baseline, or `null` below it. */
  average: number | null;
  /** current − average in percentage points; `null` unless both exist. */
  trend: number | null;
  level: VolatilityLevel | null;
}

export interface VolatilityProfile {
  timeframes: Record<VolatilityTimeframe, VolatilityReading>;
  /** High − low over the last 1 / 5 / 22 sessions. */
  ranges: Record<VolatilityTimeframe, number | null>;
}

/** Every timeframe's reading for one instrument, from bars OLDEST first. */
export function volatilityProfile(
  bars: readonly RangeBar[],
  baseline: number = VOLATILITY_BASELINE,
): VolatilityProfile {
  const average = meanRangePercent(bars, baseline);
  const keys = Object.keys(VOLATILITY_WINDOWS) as VolatilityTimeframe[];
  const timeframes = {} as Record<VolatilityTimeframe, VolatilityReading>;
  const ranges = {} as Record<VolatilityTimeframe, number | null>;
  for (const key of keys) {
    const current = meanRangePercent(bars, VOLATILITY_WINDOWS[key]);
    timeframes[key] = {
      current,
      average,
      trend: current !== null && average !== null ? current - average : null,
      level: current === null ? null : volatilityLevel(current),
    };
    ranges[key] = priceRange(bars, VOLATILITY_WINDOWS[key]);
  }
  return { timeframes, ranges };
}
