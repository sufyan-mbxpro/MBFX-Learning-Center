// Correlation and the risk meter (Module 13, ADR-088).
//
// **No extra table, and no stored derived figure.** Both read
// `MarketDailyBar.close` and nothing else, computed on the way out through
// `@repo/utils`' pure statistics. A cached derived column would be a second
// source of truth that goes stale silently; a cached READ goes stale visibly,
// on a tag anyone can drop.
//
// ADR-088 decides what these numbers MEAN. This file only assembles the
// series, hands them to the maths, and carries through the one decision that
// matters at this layer: **a component that cannot report is EXCLUDED and
// COUNTED, never zero-filled.** A zero is a claim that the market was neutral;
// an exclusion is the truth, which is that we do not know.
import {
  VOLATILITY_BASELINE,
  correlationMatrix,
  volatilityProfile,
  riskSentimentScore,
  type CorrelationMatrix,
  type RiskBand,
  type RiskComponentContribution,
  type VolatilityProfile,
} from "@repo/utils";
import {
  MARKET_BOARD_GROUPS,
  MARKET_BOARD_GROUP_KEYS,
  MARKET_BOARD_SYMBOLS,
  type MarketBoardGroupKey,
} from "@repo/contracts";
import { db } from "@repo/db";
import { cacheLife, cacheTag } from "next/cache";

import { MARKET_CACHE_TAG } from "./market.ts";

/** Window labels → the number of RETURNS they cover (one fewer than closes). */
const WINDOW_RETURNS: Record<string, number> = {
  "5d": 5,
  "10d": 10,
  "30d": 30,
  "60d": 60,
  "90d": 90,
  "180d": 180,
  "250d": 250,
};

export interface CorrelationInstrumentView {
  id: string;
  symbol: string;
  displayName: string;
}

export interface CorrelationView {
  window: string;
  /** The instruments that HAVE enough history, in admin order. */
  instruments: CorrelationInstrumentView[];
  /** `matrix[a][b]`, `null` where the sample is below the window. */
  matrix: CorrelationMatrix;
  /** Instruments with too little history, named rather than silently dropped. */
  excluded: CorrelationInstrumentView[];
  /** The newest bar behind any of it. */
  asOf: string | null;
}

/**
 * Pearson over LOG RETURNS of daily closes (ADR-088 #1), for one window.
 *
 * `instrumentIds` is the tool's own configured set. An empty list means the
 * admin has configured nothing, which renders an empty state rather than
 * quietly falling back to "every instrument" — a matrix of thirty rows nobody
 * asked for is worse than a message saying to pick some.
 */
export async function getCorrelationMatrix(
  window: string,
  instrumentIds: readonly string[],
): Promise<CorrelationView> {
  "use cache";
  cacheTag(MARKET_CACHE_TAG);
  cacheLife({ revalidate: 3600 });

  const returns = WINDOW_RETURNS[window] ?? 30;
  if (instrumentIds.length === 0) {
    return { window, instruments: [], matrix: {}, excluded: [], asOf: null };
  }

  const rows = await db.marketInstrument.findMany({
    where: { id: { in: [...instrumentIds] }, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { symbol: "asc" }],
    select: {
      id: true,
      symbol: true,
      displayName: true,
      bars: {
        orderBy: { date: "desc" },
        // One more close than returns, because a return needs two closes.
        take: returns + 1,
        select: { date: true, close: true },
      },
    },
  });

  let newest: Date | null = null;
  const series = rows.map((row) => {
    for (const bar of row.bars) if (!newest || bar.date > newest) newest = bar.date;
    return {
      key: row.id,
      // Oldest first — what `logReturns` expects.
      closes: [...row.bars].reverse().map((bar) => Number(bar.close)),
    };
  });

  const matrix = correlationMatrix(series, returns);

  // A row whose own diagonal is null reported nothing at all. `matrix` makes
  // that decision (ADR-088 #3); this only reads it, so the two cannot
  // disagree about what "enough data" means.
  const reported = rows.filter((row) => matrix[row.id]?.[row.id] !== null);
  const excluded = rows.filter((row) => matrix[row.id]?.[row.id] === null);
  const view = (row: (typeof rows)[number]): CorrelationInstrumentView => ({
    id: row.id,
    symbol: row.symbol,
    displayName: row.displayName,
  });

  return {
    window,
    instruments: reported.map(view),
    matrix,
    excluded: excluded.map(view),
    asOf: newest ? (newest as Date).toISOString() : null,
  };
}

export interface RiskComponentSpec {
  instrumentId: string;
  weight: number;
  direction: "risk-on" | "risk-off";
}

export interface RiskComponentView extends RiskComponentContribution {
  symbol: string;
  displayName: string;
}

export interface RiskSentimentView {
  /** 0–100, or `null` when nothing in the basket could report. */
  score: number | null;
  band: RiskBand | null;
  components: RiskComponentView[];
  /** How many of the basket reported, and which did not. */
  reporting: { reported: number; total: number; excluded: string[] };
  /** The last 60 scores, oldest first — the sparkline. */
  history: { date: string; score: number }[];
  asOf: string | null;
  lookbackDays: number;
  bands: { riskOffBelow: number; riskOnAbove: number };
}

/**
 * ADR-088 #4's score, plus the 60-day history the sparkline draws.
 *
 * The history is recomputed rather than stored: the score is a function of
 * bars and of the CURRENT basket, so a stored series would be a record of
 * whatever the basket used to be — and it would not change when an admin
 * edited the weights, which is the one time a reader most needs it to.
 */
export async function getRiskSentiment(
  components: readonly RiskComponentSpec[],
  options: { lookbackDays: number; riskOffBelow: number; riskOnAbove: number },
): Promise<RiskSentimentView> {
  "use cache";
  cacheTag(MARKET_CACHE_TAG);
  cacheLife({ revalidate: 3600 });

  const bands = { riskOffBelow: options.riskOffBelow, riskOnAbove: options.riskOnAbove };
  const empty: RiskSentimentView = {
    score: null,
    band: null,
    components: [],
    reporting: { reported: 0, total: components.length, excluded: [] },
    history: [],
    asOf: null,
    lookbackDays: options.lookbackDays,
    bands,
  };
  if (components.length === 0) return empty;

  const HISTORY_POINTS = 60;
  const rows = await db.marketInstrument.findMany({
    where: { id: { in: components.map((c) => c.instrumentId) }, isActive: true },
    select: {
      id: true,
      symbol: true,
      displayName: true,
      bars: {
        orderBy: { date: "desc" },
        // Enough for the lookback AND for each of the history's own lookbacks.
        take: options.lookbackDays + HISTORY_POINTS + 2,
        select: { date: true, close: true },
      },
    },
  });
  if (rows.length === 0) return empty;

  const byId = new Map(rows.map((row) => [row.id, row]));
  let newest: Date | null = null;
  for (const row of rows) {
    for (const bar of row.bars) if (!newest || bar.date > newest) newest = bar.date;
  }

  /** The basket as the maths wants it, truncated to `drop` days ago. */
  const basketAt = (drop: number) =>
    components
      .map((component) => {
        const row = byId.get(component.instrumentId);
        if (!row) return null;
        const closes = [...row.bars].reverse().map((bar) => Number(bar.close));
        return {
          key: component.instrumentId,
          closes: drop === 0 ? closes : closes.slice(0, closes.length - drop),
          weight: component.weight,
          direction: component.direction,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

  const current = riskSentimentScore(basketAt(0), {
    lookback: options.lookbackDays,
    bands,
  });

  const history: { date: string; score: number }[] = [];
  const dates = [...(rows[0]?.bars ?? [])].reverse().map((bar) => bar.date);
  for (let drop = HISTORY_POINTS - 1; drop >= 0; drop -= 1) {
    const point = riskSentimentScore(basketAt(drop), { lookback: options.lookbackDays, bands });
    const date = dates[dates.length - 1 - drop];
    // A point that could not be computed is OMITTED, not zero-filled — a
    // sparkline dipping to zero would read as a crash rather than as silence.
    if (point.score !== null && date) {
      history.push({ date: date.toISOString().slice(0, 10), score: point.score });
    }
  }

  return {
    score: current.score,
    band: current.band,
    components: current.contributions.map((contribution) => {
      const row = byId.get(contribution.key);
      return {
        ...contribution,
        symbol: row?.symbol ?? contribution.key,
        displayName: row?.displayName ?? contribution.key,
      };
    }),
    reporting: {
      ...current.reporting,
      // Named by SYMBOL, not by id: "we could not read XAU/USD" is a sentence
      // a reader can act on; a cuid is not.
      excluded: current.reporting.excluded.map((id) => byId.get(id)?.symbol ?? id),
    },
    history,
    asOf: newest ? (newest as Date).toISOString() : null,
    lookbackDays: options.lookbackDays,
    bands,
  };
}

/**
 * Every offered window, from ONE read (changes-25 T8).
 *
 * The alternative was a `?window=` search param, which would make the page
 * dynamic and take `/tools/correlation` out of ISR for a control that changes
 * nothing a crawler sees. Seven windows over the same nine instruments is one
 * query for the longest window's bars and seven passes of pure arithmetic over
 * what came back — cheaper than one extra request, and the switch is instant
 * because nothing is fetched when it moves.
 */
export async function getCorrelationMatrices(
  windows: readonly string[],
  instrumentIds: readonly string[],
): Promise<Record<string, CorrelationView>> {
  "use cache";
  cacheTag(MARKET_CACHE_TAG);
  cacheLife({ revalidate: 3600 });

  const offered = windows.length > 0 ? windows : ["30d"];
  const out: Record<string, CorrelationView> = {};
  if (instrumentIds.length === 0) {
    for (const window of offered) {
      out[window] = { window, instruments: [], matrix: {}, excluded: [], asOf: null };
    }
    return out;
  }

  const longest = Math.max(...offered.map((w) => WINDOW_RETURNS[w] ?? 30));
  const rows = await db.marketInstrument.findMany({
    where: { id: { in: [...instrumentIds] }, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { symbol: "asc" }],
    select: {
      id: true,
      symbol: true,
      displayName: true,
      bars: {
        orderBy: { date: "desc" },
        take: longest + 1,
        select: { date: true, close: true },
      },
    },
  });

  let newest: Date | null = null;
  for (const row of rows) {
    for (const bar of row.bars) if (!newest || bar.date > newest) newest = bar.date;
  }
  const asOf = newest ? (newest as Date).toISOString() : null;

  const view = (row: (typeof rows)[number]): CorrelationInstrumentView => ({
    id: row.id,
    symbol: row.symbol,
    displayName: row.displayName,
  });

  for (const window of offered) {
    const returns = WINDOW_RETURNS[window] ?? 30;
    const series = rows.map((row) => ({
      key: row.id,
      // Oldest first, and trimmed to THIS window — `correlationMatrix` takes
      // the tail itself, but handing it the whole history would let a 5d
      // window quietly read 250 days of it.
      closes: [...row.bars]
        .reverse()
        .slice(-(returns + 1))
        .map((bar) => Number(bar.close)),
    }));
    const matrix = correlationMatrix(series, returns);
    out[window] = {
      window,
      instruments: rows.filter((row) => matrix[row.id]?.[row.id] !== null).map(view),
      matrix,
      excluded: rows.filter((row) => matrix[row.id]?.[row.id] === null).map(view),
      asOf,
    };
  }
  return out;
}

// ─── Volatility (ADR-136 §3) ─────────────────────────────────

export interface VolatilityRowView {
  symbol: string;
  displayName: string;
  /** Decimals the instrument prints its prices in, for the ranges. */
  decimals: number;
  profile: VolatilityProfile;
}

export interface VolatilityGroupView {
  key: MarketBoardGroupKey;
  /** The instruments that reported, in the registry's order. */
  rows: VolatilityRowView[];
  /** Registry symbols with no active instrument or no bars, named rather than dropped. */
  missing: string[];
}

export interface VolatilityBoardView {
  groups: VolatilityGroupView[];
  /** The newest bar behind any of it. */
  asOf: string | null;
}

/**
 * The volatility board: every registry group's instruments, profiled from
 * their stored bars.
 *
 * **Ranges, not closes.** Unlike correlation this reads `high` and `low`,
 * which is why ADR-087 #2 stores bars. An instrument whose symbol is in the
 * registry but has no active row, or no bars, is listed in `missing` and never
 * zero-filled (ADR-088 #5). A zero range is a claim that the market did not
 * move.
 */
export async function getVolatilityBoard(): Promise<VolatilityBoardView> {
  "use cache";
  cacheTag(MARKET_CACHE_TAG);
  cacheLife({ revalidate: 3600 });

  const rows = await db.marketInstrument.findMany({
    where: { symbol: { in: [...MARKET_BOARD_SYMBOLS] }, isActive: true },
    select: {
      symbol: true,
      displayName: true,
      decimals: true,
      bars: {
        orderBy: { date: "desc" },
        take: VOLATILITY_BASELINE,
        select: { date: true, high: true, low: true, close: true },
      },
    },
  });
  const bySymbol = new Map(rows.map((row) => [row.symbol, row]));

  let newest: Date | null = null;
  const groups = MARKET_BOARD_GROUP_KEYS.map((key): VolatilityGroupView => {
    const reported: VolatilityRowView[] = [];
    const missing: string[] = [];
    for (const { symbol } of MARKET_BOARD_GROUPS[key]) {
      const row = bySymbol.get(symbol);
      if (!row || row.bars.length === 0) {
        missing.push(symbol);
        continue;
      }
      for (const bar of row.bars) if (!newest || bar.date > newest) newest = bar.date;
      reported.push({
        symbol: row.symbol,
        displayName: row.displayName,
        decimals: row.decimals,
        // Oldest first, which is what the maths takes.
        profile: volatilityProfile(
          [...row.bars].reverse().map((bar) => ({
            high: Number(bar.high),
            low: Number(bar.low),
            close: Number(bar.close),
          })),
        ),
      });
    }
    return { key, rows: reported, missing };
  });

  return { groups, asOf: newest ? (newest as Date).toISOString() : null };
}
