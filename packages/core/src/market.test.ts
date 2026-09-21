// Provider contract tests against an MSW-mocked AlphaVantage (testing.md:
// MSW for the market-data network edge — the ONE place mocks belong),
// plus the cache/degrade behavior with an injected in-memory cache.
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  alphaVantageHistoryProvider,
  alphaVantageProvider,
  createMarketService,
  parseAlphaVantageDaily,
  MarketDataError,
  ProviderQuotaExhaustedError,
  resolveProvider,
  type RateCache,
} from "./market.ts";

const BASE = "https://www.alphavantage.co";

const goodPayload = {
  "Realtime Currency Exchange Rate": {
    "1. From_Currency Code": "EUR",
    "3. To_Currency Code": "USD",
    "5. Exchange Rate": "1.08450000",
  },
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function memoryCache(): RateCache & { ttls: Map<string, number | undefined> } {
  const store = new Map<string, string>();
  const ttls = new Map<string, number | undefined>();
  return {
    ttls,
    get: async (key) => store.get(key) ?? null,
    set: async (key, value, ttl) => {
      store.set(key, value);
      ttls.set(key, ttl);
    },
  };
}

describe("alphaVantageProvider — contract", () => {
  it("parses a good payload", async () => {
    server.use(http.get(`${BASE}/query`, () => HttpResponse.json(goodPayload)));
    const rate = await alphaVantageProvider({ apiKey: "k" }).fetchRate("EUR/USD");
    expect(rate.rate).toBeCloseTo(1.0845, 8);
    expect(rate.pair).toBe("EUR/USD");
  });

  it("treats the 200-with-Note rate-limit response as a failure", async () => {
    server.use(
      http.get(`${BASE}/query`, () =>
        HttpResponse.json({ Note: "Thank you for using Alpha Vantage! Our standard API..." }),
      ),
    );
    await expect(alphaVantageProvider({ apiKey: "k" }).fetchRate("EUR/USD")).rejects.toThrow(
      /rate-limited/,
    );
  });

  it("rejects a malformed payload rather than returning NaN", async () => {
    server.use(http.get(`${BASE}/query`, () => HttpResponse.json({ unexpected: true })));
    await expect(alphaVantageProvider({ apiKey: "k" }).fetchRate("EUR/USD")).rejects.toThrow(
      /Malformed/,
    );
  });

  it("rejects a non-2xx response", async () => {
    server.use(http.get(`${BASE}/query`, () => new HttpResponse(null, { status: 503 })));
    await expect(alphaVantageProvider({ apiKey: "k" }).fetchRate("EUR/USD")).rejects.toThrow(
      /HTTP 503/,
    );
  });
});

describe("createMarketService — cache + degrade-to-stale", () => {
  it("caches a fresh rate with the provider-refresh TTL and a long stale copy", async () => {
    server.use(http.get(`${BASE}/query`, () => HttpResponse.json(goodPayload)));
    const cache = memoryCache();
    const service = createMarketService({
      provider: alphaVantageProvider({ apiKey: "k" }),
      cache,
      ttlSeconds: 60,
    });

    const rate = await service.getRate("EUR/USD");
    expect(rate.stale).toBe(false);
    expect(cache.ttls.get("market:rate:EUR/USD")).toBe(60);
    expect(cache.ttls.get("market:stale:EUR/USD")).toBe(24 * 3600);
  });

  it("serves from cache without touching the provider on a hit", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/query`, () => {
        calls += 1;
        return HttpResponse.json(goodPayload);
      }),
    );
    const service = createMarketService({
      provider: alphaVantageProvider({ apiKey: "k" }),
      cache: memoryCache(),
      ttlSeconds: 60,
    });
    await service.getRate("EUR/USD");
    await service.getRate("EUR/USD");
    expect(calls).toBe(1);
  });

  it("degrades to the stale copy (flagged stale:true) when the provider starts failing — never crashes the page", async () => {
    let failing = false;
    server.use(
      http.get(`${BASE}/query`, () =>
        failing ? HttpResponse.json({ Note: "limited" }) : HttpResponse.json(goodPayload),
      ),
    );

    // Cache with a deletable store so the fresh key's TTL expiry can be
    // simulated while the long-lived stale copy remains.
    const store = new Map<string, string>();
    const cache: RateCache = {
      get: async (key) => store.get(key) ?? null,
      set: async (key, value) => void store.set(key, value),
    };
    const service = createMarketService({
      provider: alphaVantageProvider({ apiKey: "k" }),
      cache,
      ttlSeconds: 60,
    });

    await service.getRate("EUR/USD");
    store.delete("market:rate:EUR/USD"); // fresh TTL elapsed
    failing = true; // provider now rate-limited

    const result = await service.getRate("EUR/USD");
    expect(result.stale).toBe(true);
    expect(result.rate).toBeCloseTo(1.0845, 8);
  });

  it("throws only when the provider fails AND no stale copy exists", async () => {
    server.use(http.get(`${BASE}/query`, () => new HttpResponse(null, { status: 500 })));
    const service = createMarketService({
      provider: alphaVantageProvider({ apiKey: "k" }),
      cache: memoryCache(),
      ttlSeconds: 60,
    });
    await expect(service.getRate("EUR/USD")).rejects.toThrow(MarketDataError);
  });
});

describe("resolveProvider", () => {
  it("selects alphavantage by default when the key is present, and names unknown providers", () => {
    expect(resolveProvider({ ALPHAVANTAGE_API_KEY: "k" }).name).toBe("alphavantage");
    expect(() => resolveProvider({ MARKET_DATA_PROVIDER: "nope" })).toThrow(/Unknown/);
    expect(() => resolveProvider({})).toThrow(/API_KEY/);
  });
});

// ─── Daily series (changes-25 T3, ADR-087) ───────────────────

describe("parseAlphaVantageDaily", () => {
  it("reads the numbered fields by WORD, not by number", () => {
    // The FX and crypto endpoints number their keys differently ("1. open"
    // vs "1a. open (USD)"), so matching on the word is what keeps ONE parser
    // working for both.
    const bars = parseAlphaVantageDaily({
      "2026-09-01": { "1. open": "1.10", "2. high": "1.20", "3. low": "1.05", "4. close": "1.15" },
    });
    expect(bars).toHaveLength(1);
    expect(bars[0]!.open).toBeCloseTo(1.1, 6);
    expect(bars[0]!.high).toBeCloseTo(1.2, 6);
    expect(bars[0]!.low).toBeCloseTo(1.05, 6);
    expect(bars[0]!.close).toBeCloseTo(1.15, 6);
  });

  it("returns bars oldest first, whatever order the provider sent", () => {
    const bars = parseAlphaVantageDaily({
      "2026-09-03": { "1. open": "3", "2. high": "3", "3. low": "3", "4. close": "3" },
      "2026-09-01": { "1. open": "1", "2. high": "1", "3. low": "1", "4. close": "1" },
      "2026-09-02": { "1. open": "2", "2. high": "2", "3. low": "2", "4. close": "2" },
    });
    expect(bars.map((b) => b.close)).toEqual([1, 2, 3]);
  });

  it("DROPS a malformed bar rather than zero-filling it", () => {
    // A zero close would read as a 100% crash to every consumer downstream —
    // a log return of -Infinity, a correlation of nothing, a converted amount
    // of zero. Dropping the day is the only honest option.
    const bars = parseAlphaVantageDaily({
      "2026-09-01": { "1. open": "1", "2. high": "1", "3. low": "1", "4. close": "1" },
      "2026-09-02": { "1. open": "1", "2. high": "1", "3. low": "1", "4. close": "n/a" },
      "2026-09-03": { "1. open": "0", "2. high": "0", "3. low": "0", "4. close": "0" },
    });
    expect(bars).toHaveLength(1);
    expect(bars[0]!.date.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("is empty for an empty series rather than throwing", () => {
    expect(parseAlphaVantageDaily({})).toEqual([]);
  });
});

describe("alphaVantageHistoryProvider", () => {
  const series = {
    "Time Series FX (Daily)": {
      "2026-09-01": { "1. open": "1.10", "2. high": "1.20", "3. low": "1.05", "4. close": "1.15" },
      "2026-09-02": { "1. open": "1.15", "2. high": "1.25", "3. low": "1.10", "4. close": "1.20" },
    },
  };

  it("fetches and parses a daily series", async () => {
    server.use(http.get(`${BASE}/query`, () => HttpResponse.json(series)));
    const provider = alphaVantageHistoryProvider({ apiKey: "k" });
    const bars = await provider.fetchDailySeries("EUR/USD", "compact");
    expect(bars).toHaveLength(2);
    expect(bars[1]!.close).toBeCloseTo(1.2, 6);
  });

  it("passes the requested outputsize through", async () => {
    let seen = "";
    server.use(
      http.get(`${BASE}/query`, ({ request }) => {
        seen = new URL(request.url).searchParams.get("outputsize") ?? "";
        return HttpResponse.json(series);
      }),
    );
    const provider = alphaVantageHistoryProvider({ apiKey: "k" });
    await provider.fetchDailySeries("EUR/USD", "full");
    expect(seen).toBe("full");
  });

  it("treats a bare code as <code>/USD", async () => {
    // What lets ONE instrument table serve both the converter's CURRENCY rows
    // and the correlation set's pairs (ADR-087 #1).
    let params: URLSearchParams | null = null;
    server.use(
      http.get(`${BASE}/query`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json(series);
      }),
    );
    await alphaVantageHistoryProvider({ apiKey: "k" }).fetchDailySeries("EUR", "compact");
    expect(params!.get("from_symbol")).toBe("EUR");
    expect(params!.get("to_symbol")).toBe("USD");
  });

  it("asks DIGITAL_CURRENCY_DAILY for crypto, and parses its payload", async () => {
    // FX_DAILY rejects BTC. The payload below is the shape the live endpoint
    // returned on 2026-09-16, trimmed to two days.
    let params: URLSearchParams | null = null;
    server.use(
      http.get(`${BASE}/query`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({
          "Meta Data": { "2. Digital Currency Code": "BTC", "4. Market Code": "USD" },
          "Time Series (Digital Currency Daily)": {
            "2026-09-16": {
              "1. open": "65524.55",
              "2. high": "65780.69",
              "3. low": "65477.98",
              "4. close": "65668.21",
              "5. volume": "2.38",
            },
            "2026-09-15": {
              "1. open": "67670.43",
              "2. high": "67900.00",
              "3. low": "65400.00",
              "4. close": "65524.55",
              "5. volume": "9.10",
            },
          },
        });
      }),
    );
    const bars = await alphaVantageHistoryProvider({ apiKey: "k" }).fetchDailySeries(
      "BTC/USD",
      "full",
      "CRYPTO",
    );
    expect(params!.get("function")).toBe("DIGITAL_CURRENCY_DAILY");
    expect(params!.get("symbol")).toBe("BTC");
    expect(params!.get("market")).toBe("USD");
    expect(bars.map((b) => b.close)).toEqual([65524.55, 65668.21]);
  });

  it("declares which kinds it can serve as bars, so the sweep spends nothing on the rest", () => {
    const provider = alphaVantageHistoryProvider({ apiKey: "k" });
    for (const kind of ["CURRENCY", "PAIR", "CRYPTO"] as const) {
      expect(provider.supportsKind!(kind)).toBe(true);
    }
    for (const kind of ["METAL", "INDEX", "COMMODITY"] as const) {
      expect(provider.supportsKind!(kind)).toBe(false);
    }
  });

  it("treats 200 + Note as rate-limited, not as success", async () => {
    // AlphaVantage does not use a status code for this. The live rate path
    // already handles it; the history path has to handle it too, or a sweep
    // parses a rate-limit notice as an empty series and writes nothing while
    // reporting success.
    server.use(http.get(`${BASE}/query`, () => HttpResponse.json({ Note: "call frequency" })));
    await expect(
      alphaVantageHistoryProvider({ apiKey: "k" }).fetchDailySeries("EUR/USD", "compact"),
    ).rejects.toThrow(MarketDataError);
  });

  describe("AlphaVantage's two limits", () => {
    // Wording as the provider sends it; the classifier reads the sentence
    // because both limits arrive as HTTP 200 + Information.
    const BURST = {
      Information:
        "Thank you for using Alpha Vantage! Please consider spreading out your free API requests more sparingly (1 request per second).",
    };
    const DAILY = {
      Information:
        "We have detected your API key as XXXX and our standard API rate limit is 25 requests per day.",
    };
    const history = (fetchImpl: typeof fetch) =>
      alphaVantageHistoryProvider({ apiKey: "k", fetchImpl, minIntervalMs: 0 });
    const replies = (...bodies: unknown[]) => {
      let call = 0;
      const impl = (async () =>
        Response.json(bodies[Math.min(call++, bodies.length - 1)])) as typeof fetch;
      return { impl, calls: () => call };
    };

    it("waits out a per-second throttle and retries once", async () => {
      const { impl, calls } = replies(BURST, series);
      const bars = await history(impl).fetchDailySeries("EUR/USD", "compact");
      expect(bars).toHaveLength(2);
      expect(calls()).toBe(2);
    });

    it("reports a throttle that survives the retry as per-second, not as a spent day", async () => {
      const { impl, calls } = replies(BURST, BURST);
      const pending = history(impl).fetchDailySeries("EUR/USD", "compact");
      await expect(pending).rejects.toThrow(/per second/);
      await expect(pending).rejects.not.toBeInstanceOf(ProviderQuotaExhaustedError);
      expect(calls()).toBe(2);
    });

    it("does not retry a spent daily quota, and says which limit it was", async () => {
      const { impl, calls } = replies(DAILY);
      const pending = history(impl).fetchDailySeries("EUR/USD", "compact");
      await expect(pending).rejects.toBeInstanceOf(ProviderQuotaExhaustedError);
      await expect(pending).rejects.toThrow(/daily request limit/);
      expect(calls()).toBe(1);
    });

    it("spaces consecutive requests by the minimum interval", async () => {
      const at: number[] = [];
      const impl = (async () => {
        at.push(Date.now());
        return Response.json(series);
      }) as typeof fetch;
      const provider = alphaVantageHistoryProvider({
        apiKey: "k",
        fetchImpl: impl,
        minIntervalMs: 60,
      });
      await provider.fetchDailySeries("EUR/USD", "compact");
      await provider.fetchDailySeries("GBP/USD", "compact");
      // A few ms of timer slack either way; back to back would be ~0.
      expect(at[1]! - at[0]!).toBeGreaterThanOrEqual(50);
    });
  });

  it("treats 200 + Information as rate-limited too", async () => {
    server.use(
      http.get(`${BASE}/query`, () => HttpResponse.json({ Information: "premium endpoint" })),
    );
    await expect(
      alphaVantageHistoryProvider({ apiKey: "k" }).fetchDailySeries("EUR/USD", "compact"),
    ).rejects.toThrow(/rate-limited/);
  });

  it("reports a rejected symbol distinctly from a rate limit", async () => {
    server.use(
      http.get(`${BASE}/query`, () => HttpResponse.json({ "Error Message": "Invalid API call" })),
    );
    await expect(
      alphaVantageHistoryProvider({ apiKey: "k" }).fetchDailySeries("ZZZ/USD", "compact"),
    ).rejects.toThrow(/rejected symbol/);
  });

  it("rejects a payload with no time series at all", async () => {
    server.use(http.get(`${BASE}/query`, () => HttpResponse.json({ Meta: {} })));
    await expect(
      alphaVantageHistoryProvider({ apiKey: "k" }).fetchDailySeries("EUR/USD", "compact"),
    ).rejects.toThrow(/Malformed/);
  });

  it("rejects a series whose every bar was unusable", async () => {
    // Distinct from "malformed payload": the shape was right and the content
    // was not, and a sweep that wrote zero bars while reporting success would
    // mark the instrument fresh.
    server.use(
      http.get(`${BASE}/query`, () =>
        HttpResponse.json({
          "Time Series FX (Daily)": {
            "2026-09-01": { "1. open": "0", "2. high": "0", "3. low": "0", "4. close": "0" },
          },
        }),
      ),
    );
    await expect(
      alphaVantageHistoryProvider({ apiKey: "k" }).fetchDailySeries("EUR/USD", "compact"),
    ).rejects.toThrow(/no usable bars/);
  });

  it("propagates a non-200 as a MarketDataError", async () => {
    server.use(http.get(`${BASE}/query`, () => new HttpResponse(null, { status: 503 })));
    await expect(
      alphaVantageHistoryProvider({ apiKey: "k" }).fetchDailySeries("EUR/USD", "compact"),
    ).rejects.toThrow(/HTTP 503/);
  });

  it("gives up on a provider that never answers instead of hanging the sweep", async () => {
    // Regression: `fetch` has no timeout, so "Sync now" could spin forever.
    const hangs: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      });
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      const pending = alphaVantageHistoryProvider({
        apiKey: "k",
        fetchImpl: hangs,
      }).fetchDailySeries("EUR/USD", "compact");
      const assertion = expect(pending).rejects.toThrow(/did not respond/);
      await vi.advanceTimersByTimeAsync(30_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the configured base URL", () => {
  // MSW runs with onUnhandledRequest: "error", so a request to "//query"
  // fails this suite rather than quietly 404ing at the provider — which is
  // exactly how the trailing slash presented in the admin: an error that
  // read like a bad API key.
  it("tolerates a trailing slash, which is what copying the address bar gives you", async () => {
    server.use(http.get(`${BASE}/query`, () => HttpResponse.json(goodPayload)));
    const rate = await alphaVantageProvider({
      apiKey: "k",
      baseUrl: `${BASE}/`,
    }).fetchRate("EUR/USD");
    expect(rate.rate).toBeCloseTo(1.0845, 8);
  });

  it("tolerates several, and on the history provider too", async () => {
    server.use(
      http.get(`${BASE}/query`, () =>
        HttpResponse.json({
          "Time Series FX (Daily)": {
            "2026-09-01": {
              "1. open": "1.08",
              "2. high": "1.09",
              "3. low": "1.07",
              "4. close": "1.085",
            },
          },
        }),
      ),
    );
    const bars = await alphaVantageHistoryProvider({
      apiKey: "k",
      baseUrl: `${BASE}///`,
    }).fetchDailySeries("EUR/USD", "compact");
    expect(bars).toHaveLength(1);
  });

  it("falls back to the default when the configured value is only slashes", async () => {
    // "/" is not an origin. Stripping it would leave "", and "/query" would
    // then be fetched against whatever host the process happens to resolve.
    server.use(http.get(`${BASE}/query`, () => HttpResponse.json(goodPayload)));
    const rate = await alphaVantageProvider({ apiKey: "k", baseUrl: "/" }).fetchRate("EUR/USD");
    expect(rate.rate).toBeCloseTo(1.0845, 8);
  });
});
