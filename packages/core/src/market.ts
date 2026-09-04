// Market data layer (Module 13). Provider abstraction — the app talks to
// a MarketDataProvider interface; AlphaVantage is one implementation,
// selected via MARKET_DATA_PROVIDER. Live rates are Redis-cached with a
// TTL matching the provider refresh and NEVER persisted per-tick (the
// architecture doc's explicit warning); a provider failure degrades to
// the last-known stale rate rather than crashing the page.

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

interface AlphaVantageOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function alphaVantageProvider(options: AlphaVantageOptions): MarketDataProvider {
  const baseUrl = options.baseUrl ?? "https://www.alphavantage.co";
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
