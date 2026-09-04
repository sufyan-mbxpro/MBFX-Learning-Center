// Provider contract tests against an MSW-mocked AlphaVantage (testing.md:
// MSW for the market-data network edge — the ONE place mocks belong),
// plus the cache/degrade behavior with an injected in-memory cache.
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  alphaVantageProvider,
  createMarketService,
  MarketDataError,
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
