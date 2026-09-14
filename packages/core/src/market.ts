// Market data layer (Module 13). Provider abstraction — the app talks to
// a MarketDataProvider interface; AlphaVantage is one implementation,
// selected via MARKET_DATA_PROVIDER. Live rates are Redis-cached with a
// TTL matching the provider refresh and NEVER persisted per-tick (the
// architecture doc's explicit warning); a provider failure degrades to
// the last-known stale rate rather than crashing the page.

import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { db, type MarketDriver, type MarketInstrumentKind, type Prisma } from "@repo/db";
import { openSecret, sealSecret } from "@repo/secrets";

export interface Rate {
  pair: string;
  rate: number;
  /** Epoch ms at fetch time. */
  fetchedAt: number;
}

export class MarketDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketDataError";
  }
}

export interface MarketDataProvider {
  name: string;
  fetchRate(pair: string): Promise<Rate>;
}

// ─── AlphaVantage implementation ─────────────────────────────

/** The provider's own origin, used when the admin has not overridden it. */
const ALPHAVANTAGE_BASE_URL = "https://www.alphavantage.co";

/**
 * The configured origin with trailing slashes removed.
 *
 * Both drivers build their URL as `${baseUrl}/query?…`, so a base URL saved
 * as "https://www.alphavantage.co/" — which is what a browser gives you when
 * you copy the address bar — asks the provider for "//query" and gets an error
 * that looks like a bad API key. Normalised here rather than on save, so a row
 * already holding the slash starts working without being re-entered.
 *
 * A base URL of only slashes falls back to the default: it is not an origin.
 */
function resolveBaseUrl(baseUrl: string | undefined): string {
  return baseUrl?.replace(/[/]+$/, "") || ALPHAVANTAGE_BASE_URL;
}

interface AlphaVantageOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function alphaVantageProvider(options: AlphaVantageOptions): MarketDataProvider {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const doFetch = options.fetchImpl ?? fetch;

  return {
    name: "alphavantage",
    async fetchRate(pair: string): Promise<Rate> {
      const [from, to] = pair.split("/");
      if (!from || !to) throw new MarketDataError(`Invalid pair: ${pair}`);

      const url = `${baseUrl}/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${options.apiKey}`;
      const response = await doFetch(url);
      if (!response.ok) throw new MarketDataError(`Provider HTTP ${response.status}`);

      const body = (await response.json()) as Record<string, unknown>;
      // AlphaVantage signals rate limiting with 200 + a "Note"/"Information"
      // field instead of an error status — treat it as a failure so the
      // caller's degrade-to-stale path runs.
      if ("Note" in body || "Information" in body) {
        throw new MarketDataError("Provider rate-limited");
      }

      const payload = body["Realtime Currency Exchange Rate"] as Record<string, string> | undefined;
      const raw = payload?.["5. Exchange Rate"];
      const rate = raw === undefined ? NaN : Number(raw);
      if (!Number.isFinite(rate)) throw new MarketDataError("Malformed provider payload");

      return { pair, rate, fetchedAt: Date.now() };
    },
  };
}

// ─── Cache + degrade-to-stale ────────────────────────────────

/** Minimal cache contract — Redis in production, a Map in tests. */
export interface RateCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<unknown>;
}

export interface MarketServiceOptions {
  provider: MarketDataProvider;
  cache: RateCache;
  /** Fresh-rate TTL = the provider's refresh interval. */
  ttlSeconds: number;
  /** How long a stale copy stays servable when the provider is down. */
  staleTtlSeconds?: number;
}

export interface MarketService {
  /** Cached rate; on provider failure serves the last stale copy (flagged) rather than throwing — a market widget must degrade, never crash the page. */
  getRate(pair: string): Promise<Rate & { stale: boolean }>;
}

export function createMarketService({
  provider,
  cache,
  ttlSeconds,
  staleTtlSeconds = 24 * 3600,
}: MarketServiceOptions): MarketService {
  const freshKey = (pair: string) => `market:rate:${pair}`;
  const staleKey = (pair: string) => `market:stale:${pair}`;

  return {
    async getRate(pair) {
      const cached = await cache.get(freshKey(pair));
      if (cached) return { ...(JSON.parse(cached) as Rate), stale: false };

      try {
        const rate = await provider.fetchRate(pair);
        const serialized = JSON.stringify(rate);
        await cache.set(freshKey(pair), serialized, ttlSeconds);
        await cache.set(staleKey(pair), serialized, staleTtlSeconds);
        return { ...rate, stale: false };
      } catch (error) {
        const stale = await cache.get(staleKey(pair));
        if (stale) return { ...(JSON.parse(stale) as Rate), stale: true };
        throw error;
      }
    },
  };
}

// ─── Provider selection (MARKET_DATA_PROVIDER) ───────────────

export function resolveProvider(env: {
  MARKET_DATA_PROVIDER?: string;
  ALPHAVANTAGE_API_KEY?: string;
}): MarketDataProvider {
  const name = env.MARKET_DATA_PROVIDER ?? "alphavantage";
  switch (name) {
    case "alphavantage": {
      const apiKey = env.ALPHAVANTAGE_API_KEY;
      if (!apiKey) throw new MarketDataError("ALPHAVANTAGE_API_KEY is not set");
      return alphaVantageProvider({ apiKey });
    }
    default:
      throw new MarketDataError(`Unknown MARKET_DATA_PROVIDER: ${name}`);
  }
}

// ═════════════════════════════════════════════════════════════
// The market data PLATFORM (ADR-087, changes-25 T3)
// ═════════════════════════════════════════════════════════════
//
// Everything above this line is the original Module 13 seam — a provider
// interface, an AlphaVantage rate fetch, a Redis-shaped cache, degrade-to-
// stale. It is untouched. What follows is the store that seam was missing:
// a provider row whose key is sealed, instruments, daily bars, and a sweep.
//
// Module 13's spec said market data never goes into Prisma as a source of
// truth. That is right about TICKS and wrong about history: a correlation
// window IS history, and re-fetching 250 bars per instrument per page view is
// not a cache strategy, it is a rate-limit incident.

/** ADR-087 #5. The key itself never leaves the environment. */
export const MARKET_SECRET_KEY_ENV = "MARKET_SECRET_KEY";

/** The provider is a singleton row. */
export const MARKET_PROVIDER_ID = "default";

/** ADR-087 #8 — a frozen cache tag, deliberately NOT `content`. */
export const MARKET_CACHE_TAG = "market";

// ─── Daily series (the provider interface grows) ─────────────

export interface DailyBar {
  /** UTC midnight of the bar's day. */
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * The daily-series half of a provider.
 *
 * Separate from `MarketDataProvider` on purpose: a driver may serve live rates
 * and no history, or the reverse, and the `MANUAL` driver serves neither. A
 * caller that needs bars asks for this capability rather than assuming every
 * provider has it.
 */
export interface MarketHistoryProvider {
  name: string;
  /**
   * `full` asks for the provider's whole history, `compact` for the recent
   * tail. ADR-087 #10: an instrument with no stored bars gets `full` once,
   * everything else gets `compact` — correlation at 250d and the meter's
   * percentile ranks need roughly 250 bars, and an incremental-only sweep
   * would leave both rendering "—" for the better part of a year.
   */
  fetchDailySeries(symbol: string, size: "compact" | "full"): Promise<DailyBar[]>;
}

interface AlphaVantageHistoryOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** Parse one AlphaVantage daily series object into bars, newest last. */
export function parseAlphaVantageDaily(series: Record<string, unknown>): DailyBar[] {
  const bars: DailyBar[] = [];
  for (const [day, raw] of Object.entries(series)) {
    const fields = raw as Record<string, string>;
    // AlphaVantage numbers its keys ("1. open"), and the FX and crypto
    // endpoints number them differently. Matching on the WORD rather than the
    // number is what keeps one parser working for both.
    const pick = (word: string): number => {
      const entry = Object.entries(fields).find(([k]) => k.toLowerCase().includes(word));
      return entry ? Number(entry[1]) : NaN;
    };
    const bar = {
      date: new Date(`${day}T00:00:00.000Z`),
      open: pick("open"),
      high: pick("high"),
      low: pick("low"),
      close: pick("close"),
    };
    // A bar with a missing or unparseable field is DROPPED, not zero-filled.
    // A zero close would read as a 100% crash to every consumer downstream.
    if (
      Number.isFinite(bar.date.getTime()) &&
      [bar.open, bar.high, bar.low, bar.close].every((v) => Number.isFinite(v) && v > 0)
    ) {
      bars.push(bar);
    }
  }
  return bars.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function alphaVantageHistoryProvider(
  options: AlphaVantageHistoryOptions,
): MarketHistoryProvider {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const doFetch = options.fetchImpl ?? fetch;

  return {
    name: "alphavantage",
    async fetchDailySeries(symbol, size) {
      const [from, to] = symbol.split("/");
      if (!from) throw new MarketDataError(`Invalid symbol: ${symbol}`);

      // A pair asks FX_DAILY; a bare code is treated as <code>/USD, which is
      // what makes one instrument table serve both the converter's CURRENCY
      // rows and the correlation set's pairs.
      const url =
        `${baseUrl}/query?function=FX_DAILY` +
        `&from_symbol=${encodeURIComponent(from)}` +
        `&to_symbol=${encodeURIComponent(to ?? "USD")}` +
        `&outputsize=${size}&apikey=${options.apiKey}`;

      const response = await doFetch(url);
      if (!response.ok) throw new MarketDataError(`Provider HTTP ${response.status}`);
      const body = (await response.json()) as Record<string, unknown>;

      // The same 200-plus-Note rate-limit trap the live rate path already
      // handles. AlphaVantage does not use a status code for this.
      if ("Note" in body || "Information" in body) {
        throw new MarketDataError("Provider rate-limited");
      }
      if ("Error Message" in body) {
        throw new MarketDataError(`Provider rejected symbol: ${symbol}`);
      }

      const seriesKey = Object.keys(body).find((k) => k.toLowerCase().includes("time series"));
      const series = seriesKey ? (body[seriesKey] as Record<string, unknown>) : undefined;
      if (!series || typeof series !== "object") {
        throw new MarketDataError("Malformed provider payload");
      }
      const bars = parseAlphaVantageDaily(series);
      if (bars.length === 0) throw new MarketDataError("Provider returned no usable bars");
      return bars;
    },
  };
}

// ─── The provider row, and its one key reader ────────────────

export interface MarketProviderRecord {
  id: string;
  driver: MarketDriver;
  baseUrl: string | null;
  apiKeyCipher: string | null;
  refreshSeconds: number;
  staleSeconds: number;
  isEnabled: boolean;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
}

/**
 * **The ONLY reader of `apiKeyCipher`** (ADR-087 #5), mirroring
 * `loadTransportDriver()`.
 *
 * Returns `null` — never throws — when the platform is not configured: a
 * disabled provider, a MANUAL driver, a missing key, or a `MARKET_SECRET_KEY`
 * that cannot open what is stored. Every caller of this already has a
 * degrade-to-stale path, and a thrown configuration error on a public page
 * would turn "no rates today" into a 500.
 */
export async function loadProviderDriver(): Promise<MarketHistoryProvider | null> {
  const provider = await db.marketProvider.findUnique({ where: { id: MARKET_PROVIDER_ID } });
  if (!provider || !provider.isEnabled) return null;
  if (provider.driver !== "ALPHAVANTAGE") return null;
  if (!provider.apiKeyCipher) return null;

  let apiKey: string;
  try {
    apiKey = openSecret(provider.apiKeyCipher, MARKET_SECRET_KEY_ENV);
  } catch {
    // The admin screen reports this properly; a page render does not.
    return null;
  }
  return alphaVantageHistoryProvider({
    apiKey,
    ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
  });
}

/** Seal a provider key for storage. The one writer's one helper. */
export function sealProviderKey(apiKey: string): string {
  return sealSecret(apiKey, MARKET_SECRET_KEY_ENV);
}

// ─── Instruments ─────────────────────────────────────────────

export interface InstrumentView {
  id: string;
  kind: MarketInstrumentKind;
  symbol: string;
  displayName: string;
  base: string | null;
  quote: string | null;
  providerSymbol: string | null;
  pipSize: number | null;
  decimals: number;
  isActive: boolean;
  sortOrder: number;
}

const INSTRUMENT_SELECT = {
  id: true,
  kind: true,
  symbol: true,
  displayName: true,
  base: true,
  quote: true,
  providerSymbol: true,
  pipSize: true,
  decimals: true,
  isActive: true,
  sortOrder: true,
} satisfies Prisma.MarketInstrumentSelect;

function toInstrumentView(row: {
  id: string;
  kind: MarketInstrumentKind;
  symbol: string;
  displayName: string;
  base: string | null;
  quote: string | null;
  providerSymbol: string | null;
  pipSize: Prisma.Decimal | null;
  decimals: number;
  isActive: boolean;
  sortOrder: number;
}): InstrumentView {
  return { ...row, pipSize: row.pipSize === null ? null : Number(row.pipSize) };
}

/** Active instruments, optionally of one kind, in admin-set order. */
export async function listActiveInstruments(
  kind?: MarketInstrumentKind,
): Promise<InstrumentView[]> {
  "use cache";
  cacheTag(MARKET_CACHE_TAG);
  cacheLife({ revalidate: 300 });

  const rows = await db.marketInstrument.findMany({
    where: { isActive: true, ...(kind ? { kind } : {}) },
    orderBy: [{ sortOrder: "asc" }, { symbol: "asc" }],
    select: INSTRUMENT_SELECT,
  });
  return rows.map(toInstrumentView);
}

// ─── The rate snapshot (ADR-087 #7) ──────────────────────────

export interface RateSnapshot {
  /** Every rate is quoted per 1 unit of this. */
  base: "USD";
  /** Currency code → units per 1 USD. */
  rates: Record<string, number>;
  /** When the newest bar behind these rates was recorded. */
  asOf: string | null;
  /** True when the newest bar is older than the provider's stale window. */
  stale: boolean;
  /** How many instruments contributed, for the honest empty state. */
  reporting: { reported: number; total: number };
}

/**
 * Every active instrument's latest rate, read ONCE per page.
 *
 * The reference posts back on every "Calculate". We pass this to the island
 * and do the arithmetic client-side instead (ADR-087 #7) — it costs one cached
 * read rather than one request per keystroke, and it keeps the widgets working
 * while the provider is down.
 *
 * The snapshot carries latest rates, never bars. A tool that needs history
 * reads `getDailySeries` or `getOhlc`.
 */
export async function getRateSnapshot(): Promise<RateSnapshot> {
  "use cache";
  cacheTag(MARKET_CACHE_TAG);
  cacheLife({ revalidate: 300 });

  const [provider, instruments] = await Promise.all([
    db.marketProvider.findUnique({
      where: { id: MARKET_PROVIDER_ID },
      select: { staleSeconds: true },
    }),
    db.marketInstrument.findMany({
      where: { isActive: true },
      select: {
        id: true,
        kind: true,
        symbol: true,
        base: true,
        quote: true,
        bars: { orderBy: { date: "desc" }, take: 1, select: { date: true, close: true } },
      },
    }),
  ]);

  const rates: Record<string, number> = {};
  let newest: Date | null = null;
  let reported = 0;

  for (const instrument of instruments) {
    const bar = instrument.bars[0];
    if (!bar) continue;
    const close = Number(bar.close);
    if (!Number.isFinite(close) || close <= 0) continue;

    // A CURRENCY row is stored as <code>/USD-shaped history, so its close IS
    // units per USD for the quote side. A PAIR row contributes its quote leg
    // only when one side is USD — a EUR/GBP bar says nothing about either
    // against the dollar, and inventing a triangulation here would put a
    // derived number in the same map as measured ones.
    const base = (instrument.base ?? instrument.symbol.split("/")[0] ?? "").toUpperCase();
    const quote = (instrument.quote ?? instrument.symbol.split("/")[1] ?? "USD").toUpperCase();

    if (quote === "USD" && base && base !== "USD") {
      // close = USD per 1 base  →  base per 1 USD is its reciprocal.
      rates[base] = 1 / close;
      reported += 1;
    } else if (base === "USD" && quote && quote !== "USD") {
      rates[quote] = close;
      reported += 1;
    } else {
      continue;
    }
    if (!newest || bar.date > newest) newest = bar.date;
  }

  const staleSeconds = provider?.staleSeconds ?? 86_400;
  const stale = newest === null || Date.now() - newest.getTime() > staleSeconds * 1000;

  return {
    base: "USD",
    rates,
    asOf: newest ? newest.toISOString() : null,
    // A snapshot with nothing in it is stale by definition — there is no
    // "fresh empty". Every surface labels it in words (ADR-087 #11).
    stale,
    reporting: { reported, total: instruments.length },
  };
}

// ─── History reads ───────────────────────────────────────────

export interface SeriesPoint {
  date: string;
  close: number;
}

/** Daily closes for one instrument, OLDEST first — what the statistics take. */
export async function getDailySeries(instrumentId: string, days: number): Promise<SeriesPoint[]> {
  "use cache";
  cacheTag(MARKET_CACHE_TAG);
  cacheLife({ revalidate: 3600 });

  const rows = await db.marketDailyBar.findMany({
    where: { instrumentId },
    orderBy: { date: "desc" },
    take: Math.max(1, Math.min(days, 2000)),
    select: { date: true, close: true },
  });
  return rows
    .reverse()
    .map((row) => ({ date: row.date.toISOString().slice(0, 10), close: Number(row.close) }));
}

export type OhlcInterval = "1D" | "1W" | "1M" | "1Y";

export interface OhlcBar {
  interval: OhlcInterval;
  /** The first day folded into this bar. */
  from: string;
  /** The last day folded into this bar. */
  to: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * ADR-087 #4, the aggregation rule, implemented once: **an interval bar is the
 * first day's open, the maximum of the days' highs, the minimum of the days'
 * lows, and the last day's close.**
 *
 * This is also why bars are stored rather than closes (#2): a high cannot be
 * derived from closing prices, so a week assembled out of closes understates
 * its own range and every pivot level computed from it is wrong by the same
 * amount.
 */
export function foldBars(
  bars: readonly { date: Date; open: number; high: number; low: number; close: number }[],
  interval: OhlcInterval,
): OhlcBar | null {
  if (bars.length === 0) return null;
  const ordered = [...bars].sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  return {
    interval,
    from: first.date.toISOString().slice(0, 10),
    to: last.date.toISOString().slice(0, 10),
    open: first.open,
    high: Math.max(...ordered.map((b) => b.high)),
    low: Math.min(...ordered.map((b) => b.low)),
    close: last.close,
  };
}

/** How many calendar days each interval folds. 1D is the stored bar itself. */
const INTERVAL_DAYS: Record<OhlcInterval, number> = { "1D": 1, "1W": 7, "1M": 31, "1Y": 366 };

/**
 * The most recent COMPLETE interval for one instrument, for the pivot
 * calculator's autofill.
 *
 * Pivot levels are computed from the PREVIOUS period, which is why the window
 * ends before today rather than including a day that is still trading — a
 * pivot recomputed every hour from a half-formed bar is not a level anyone can
 * trade against.
 */
export async function getOhlc(symbol: string, interval: OhlcInterval): Promise<OhlcBar | null> {
  "use cache";
  cacheTag(MARKET_CACHE_TAG);
  cacheLife({ revalidate: 3600 });

  const instrument = await db.marketInstrument.findUnique({
    where: { symbol },
    select: { id: true },
  });
  if (!instrument) return null;

  const span = INTERVAL_DAYS[interval];
  // Take two spans and fold the OLDER one: the newer span is the period in
  // progress.
  const rows = await db.marketDailyBar.findMany({
    where: { instrumentId: instrument.id },
    orderBy: { date: "desc" },
    take: span * 2,
    select: { date: true, open: true, high: true, low: true, close: true },
  });
  if (rows.length === 0) return null;

  const bars = rows
    .map((r) => ({
      date: r.date,
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (interval === "1D") {
    // The last COMPLETE day is the newest stored bar; there is no partial
    // daily bar, because the sweep only writes closed days.
    return foldBars(bars.slice(-1), interval);
  }
  const previous = bars.slice(0, Math.max(0, bars.length - span));
  return foldBars(previous.length > 0 ? previous.slice(-span) : bars.slice(0, span), interval);
}

// ─── The sweep (ADR-087 #9, #10) ─────────────────────────────

export interface SyncResult {
  attempted: number;
  synced: number;
  barsWritten: number;
  failures: { symbol: string; error: string }[];
  /** Instruments the budget did not reach; the next run starts with them. */
  skipped: number;
}

export interface SyncOptions {
  /** How many provider requests this run may spend. */
  budget?: number;
  /** Injected in tests; production reads the sealed provider row. */
  provider?: MarketHistoryProvider | null;
  now?: Date;
}

/**
 * The nightly sweep.
 *
 * **Ordered by staleness, and there is no cursor** (ADR-087 #9). Instruments
 * are walked oldest-stored-bar first, with never-synced ones ahead of
 * everything, and the run simply stops when the budget runs out. Resumption is
 * implicit: the next run's ordering puts whatever was skipped at the front. A
 * cursor column would be a second source of truth about a fact the data
 * already states.
 *
 * **Full history on an instrument's first sync, the tail thereafter**
 * (#10). Backfill is still one request per instrument, so a first run fits the
 * same budget as any other.
 *
 * **Nothing depends on this running** (#11). A failure writes `lastSyncError`
 * and leaves yesterday's bars; the pages degrade to their last good value and
 * say so.
 */
export async function syncDailyBars(options: SyncOptions = {}): Promise<SyncResult> {
  const now = options.now ?? new Date();
  const budget = options.budget ?? 500;
  const provider = options.provider !== undefined ? options.provider : await loadProviderDriver();

  const result: SyncResult = {
    attempted: 0,
    synced: 0,
    barsWritten: 0,
    failures: [],
    skipped: 0,
  };

  if (!provider) {
    await db.marketProvider.updateMany({
      where: { id: MARKET_PROVIDER_ID },
      data: { lastSyncAt: now, lastSyncError: "No provider configured" },
    });
    return result;
  }

  const instruments = await db.marketInstrument.findMany({
    where: { isActive: true },
    select: {
      id: true,
      symbol: true,
      providerSymbol: true,
      bars: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
  });

  // Staleness order: no bars at all first (Infinity old), then oldest newest-
  // bar first. Sorting in memory rather than in SQL because "the age of an
  // instrument's newest bar" is a per-row aggregate, and a correlated
  // subquery to order ~30 rows is the wrong trade.
  const ordered = instruments
    .map((i) => ({ ...i, newest: i.bars[0]?.date ?? null }))
    .sort((a, b) => {
      if (a.newest === null && b.newest === null) return a.symbol.localeCompare(b.symbol);
      if (a.newest === null) return -1;
      if (b.newest === null) return 1;
      return a.newest.getTime() - b.newest.getTime();
    });

  let lastError: string | null = null;

  for (const instrument of ordered) {
    if (result.attempted >= budget) {
      result.skipped += 1;
      continue;
    }
    result.attempted += 1;
    const symbol = instrument.providerSymbol ?? instrument.symbol;
    const size = instrument.newest === null ? "full" : "compact";

    try {
      const bars = await provider.fetchDailySeries(symbol, size);
      // Only the TAIL is written for an instrument that already has history:
      // re-upserting 250 unchanged rows every night is write amplification
      // for no information.
      const cutoff = instrument.newest;
      const fresh = cutoff === null ? bars : bars.filter((b) => b.date >= cutoff);

      for (const bar of fresh) {
        await db.marketDailyBar.upsert({
          where: { instrumentId_date: { instrumentId: instrument.id, date: bar.date } },
          create: {
            instrumentId: instrument.id,
            date: bar.date,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          },
          // Idempotent within a day: a second run on the same date rewrites
          // the same values rather than adding a row.
          update: { open: bar.open, high: bar.high, low: bar.low, close: bar.close },
        });
      }
      result.synced += 1;
      result.barsWritten += fresh.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failures.push({ symbol: instrument.symbol, error: message });
      lastError = message;
    }
  }

  await db.marketProvider.updateMany({
    where: { id: MARKET_PROVIDER_ID },
    data: { lastSyncAt: now, lastSyncError: lastError },
  });

  return result;
}

/**
 * Whether enough time has passed since the last provider call (ADR-096 #1).
 *
 * The provider row owns the cadence; the scheduler only supplies ticks. This
 * is read by `/api/cron/market-sync` BEFORE it spends anything and by the
 * provider screen to render "next due", so the number an admin is shown is
 * computed by the same function that gates the sweep.
 *
 * A row that has never synced is always due — that is the state a fresh
 * instance is in, and it is the one run that must not be deferred.
 */
export interface SyncDueState {
  due: boolean;
  lastSyncAt: Date | null;
  /** Null when there is nothing to wait for: never synced, or no provider row. */
  nextDueAt: Date | null;
  intervalSeconds: number;
}

export async function getSyncDueState(now: Date = new Date()): Promise<SyncDueState> {
  const provider = await db.marketProvider.findUnique({
    where: { id: MARKET_PROVIDER_ID },
    select: { refreshSeconds: true, lastSyncAt: true },
  });

  const intervalSeconds = provider?.refreshSeconds ?? 300;
  const lastSyncAt = provider?.lastSyncAt ?? null;

  if (!lastSyncAt) return { due: true, lastSyncAt: null, nextDueAt: null, intervalSeconds };

  const nextDueAt = new Date(lastSyncAt.getTime() + intervalSeconds * 1000);
  return { due: nextDueAt.getTime() <= now.getTime(), lastSyncAt, nextDueAt, intervalSeconds };
}

/** Drop every cached market read. Called after a sweep and after any write. */
export function invalidateMarket(): void {
  revalidateTag(MARKET_CACHE_TAG, { expire: 0 });
}
