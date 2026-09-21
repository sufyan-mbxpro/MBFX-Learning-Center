// The market platform against real MariaDB (ADR-087): the sweep's ordering
// and idempotency, the full-then-tail rule, the fold, and the one property the
// type system is supposed to carry on its own — that a provider view cannot
// hold the API key.
//
// Testcontainers rather than a mocked Prisma (testing.md): the sweep's
// idempotency IS a unique-constraint behaviour, and mocking the client would
// hide exactly the thing under test.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import type * as MarketModule from "./market.ts";
import type * as MarketAdminModule from "./market-admin.ts";
import type { db as DbClient } from "@repo/db";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

const MARKET_KEY = "3q2+796tvu/erb7v3q2+796tvu/erb7v3q2+796tvu8=";

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let market: typeof MarketModule;
let admin: typeof MarketAdminModule;

/** A provider that serves a fixed series and counts what it was asked for. */
function fakeProvider(
  series: Record<string, MarketModule.DailyBar[]>,
): MarketModule.MarketHistoryProvider & { calls: { symbol: string; size: string }[] } {
  const calls: { symbol: string; size: string }[] = [];
  return {
    name: "fake",
    calls,
    async fetchDailySeries(symbol, size) {
      calls.push({ symbol, size });
      const bars = series[symbol];
      if (!bars) throw new Error(`no fixture for ${symbol}`);
      return size === "full" ? bars : bars.slice(-5);
    },
  };
}

function bar(date: string, open: number, high: number, low: number, close: number) {
  return { date: new Date(`${date}T00:00:00.000Z`), open, high, low, close };
}

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_test")
    .withUsername("test")
    .withUserPassword("test")
    .start();

  const url = container.getConnectionUri().replace(/^mariadb:/, "mysql:");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = url;
  process.env.MARKET_SECRET_KEY = MARKET_KEY;
  db = (await import("@repo/db")).db;
  market = await import("./market.ts");
  admin = await import("./market-admin.ts");

  await db.marketProvider.create({ data: { id: "default", driver: "MANUAL" } });
}, 180_000);

afterAll(async () => {
  delete process.env.MARKET_SECRET_KEY;
  await db.$disconnect();
  await container.stop();
});

afterEach(async () => {
  await db.marketDailyBar.deleteMany();
  await db.marketInstrument.deleteMany();
  await db.marketProvider.updateMany({
    where: { id: "default" },
    data: { lastSyncAt: null, lastSyncError: null, apiKeyCipher: null, driver: "MANUAL" },
  });
});

async function makeInstrument(symbol: string, sortOrder = 0) {
  return db.marketInstrument.create({
    data: {
      symbol,
      displayName: symbol,
      kind: "PAIR",
      base: symbol.split("/")[0],
      quote: "USD",
      sortOrder,
    },
  });
}

// ─── The sweep ───────────────────────────────────────────────

describe("syncDailyBars", () => {
  it("writes every bar on an instrument's first sync", async () => {
    await makeInstrument("EUR/USD");
    const provider = fakeProvider({
      "EUR/USD": [bar("2026-09-01", 1.1, 1.2, 1.05, 1.15), bar("2026-09-02", 1.15, 1.25, 1.1, 1.2)],
    });

    const result = await market.syncDailyBars({ provider });

    expect(result.synced).toBe(1);
    expect(result.barsWritten).toBe(2);
    expect(await db.marketDailyBar.count()).toBe(2);
  });

  it("backfills a provider-sized full history in bulk, not a round trip per bar", async () => {
    // Regression: ~5,000 bars per instrument were written by sequential
    // upserts, so a first "Sync now" looked stuck. 2,500 bars crosses the
    // insert chunk boundary more than once.
    await makeInstrument("EUR/USD");
    const start = Date.UTC(2016, 0, 1);
    const bars = Array.from({ length: 2500 }, (_, i) => ({
      date: new Date(start + i * 86_400_000),
      open: 1,
      high: 1.1,
      low: 0.9,
      close: 1 + i / 100_000,
    }));
    const provider = fakeProvider({ "EUR/USD": bars });

    const result = await market.syncDailyBars({ provider });
    expect(result.barsWritten).toBe(2500);
    expect(await db.marketDailyBar.count()).toBe(2500);

    // A second, overlapping-style run re-inserts nothing and fails nothing.
    const again = await market.syncDailyBars({ provider });
    expect(again.failures).toHaveLength(0);
    expect(await db.marketDailyBar.count()).toBe(2500);
  }, 60_000);

  it("asks for FULL history on the first sync and COMPACT after that", async () => {
    // ADR-087 #10. Correlation at 250d needs ~250 bars, and an
    // incremental-only sweep would leave it rendering "—" for months.
    await makeInstrument("EUR/USD");
    const bars = Array.from({ length: 12 }, (_, i) =>
      bar(`2026-09-${String(i + 1).padStart(2, "0")}`, 1, 1.1, 0.9, 1 + i / 100),
    );
    const provider = fakeProvider({ "EUR/USD": bars });
    const now = new Date("2026-09-13T00:00:00Z");

    await market.syncDailyBars({ provider, now });
    expect(provider.calls.at(-1)!.size).toBe("full");

    await market.syncDailyBars({ provider, now });
    expect(provider.calls.at(-1)!.size).toBe("compact");
  });

  it("asks for FULL again when the newest bar is older than a compact tail reaches", async () => {
    // Regression: an interrupted backfill left CHF ending in 2020. A compact
    // tail (the latest ~100 points) starts after that, so every later sweep
    // "succeeded" and the years between stayed empty for good.
    const instrument = await makeInstrument("EUR/USD");
    await db.marketDailyBar.create({
      data: {
        instrumentId: instrument.id,
        date: new Date("2020-12-31T00:00:00Z"),
        open: 1,
        high: 1,
        low: 1,
        close: 1,
      },
    });
    const provider = fakeProvider({
      "EUR/USD": [bar("2020-12-31", 1, 1, 1, 1), bar("2021-01-04", 1, 1, 1, 1.01)],
    });

    const result = await market.syncDailyBars({
      provider,
      now: new Date("2026-09-16T00:00:00Z"),
    });

    expect(provider.calls[0]!.size).toBe("full");
    expect(result.barsWritten).toBe(2);
    expect(await db.marketDailyBar.count()).toBe(2);
  });

  it("spends no request on a kind the provider cannot serve, and names it", async () => {
    await makeInstrument("EUR/USD");
    await db.marketInstrument.create({
      data: { symbol: "SPX/USD", displayName: "S&P 500", kind: "INDEX", base: "SPX", quote: "USD" },
    });
    const provider = {
      ...fakeProvider({ "EUR/USD": [bar("2026-09-01", 1, 1, 1, 1)] }),
      supportsKind: (kind: string) => kind !== "INDEX",
    };

    const result = await market.syncDailyBars({ provider });

    expect(provider.calls.map((c) => c.symbol)).toEqual(["EUR/USD"]);
    expect(result.unsupported).toEqual(["SPX/USD"]);
    // Not a failure: nothing went wrong, and a retry would change nothing.
    expect(result.failures).toHaveLength(0);
    const row = await db.marketProvider.findUnique({ where: { id: "default" } });
    expect(row!.lastSyncError).toBeNull();
  });

  it("stops at a spent daily quota and leaves the rest SKIPPED, not failed", async () => {
    // Each request after the quota is gone comes back the same way, and on a
    // paced driver costs the admin ~1.2 s apiece to learn nothing.
    await makeInstrument("AUD/USD", 0);
    await makeInstrument("EUR/USD", 1);
    await makeInstrument("GBP/USD", 2);
    const calls: string[] = [];
    const provider: MarketModule.MarketHistoryProvider = {
      name: "quota",
      async fetchDailySeries(symbol) {
        calls.push(symbol);
        if (symbol === "AUD/USD") return [bar("2026-09-01", 1, 1, 1, 1)];
        throw new market.ProviderQuotaExhaustedError();
      },
    };

    const result = await market.syncDailyBars({ provider });

    expect(calls).toEqual(["AUD/USD", "EUR/USD"]);
    expect(result.synced).toBe(1);
    expect(result.failures.map((f) => f.symbol)).toEqual(["EUR/USD"]);
    expect(result.skipped).toBe(1);
  });

  it("never asks for a currency quoted against itself", async () => {
    // The seeded USD row: USD/USD is 1 by definition, and requesting it spent
    // one of a free tier's 25 daily requests on a guaranteed rejection.
    await db.marketInstrument.create({
      data: {
        symbol: "USD",
        displayName: "US Dollar",
        kind: "CURRENCY",
        base: "USD",
        quote: "USD",
      },
    });
    const provider = fakeProvider({});

    const result = await market.syncDailyBars({ provider });

    expect(provider.calls).toHaveLength(0);
    expect(result.attempted).toBe(0);
    expect(result.failures).toHaveLength(0);
  });

  it("is idempotent within a day — a second run adds no rows", async () => {
    await makeInstrument("EUR/USD");
    const provider = fakeProvider({
      "EUR/USD": [bar("2026-09-01", 1.1, 1.2, 1.05, 1.15), bar("2026-09-02", 1.15, 1.25, 1.1, 1.2)],
    });

    await market.syncDailyBars({ provider });
    const first = await db.marketDailyBar.count();
    await market.syncDailyBars({ provider });

    expect(await db.marketDailyBar.count()).toBe(first);
  });

  it("updates a bar in place when the provider revises it", async () => {
    await makeInstrument("EUR/USD");
    await market.syncDailyBars({
      provider: fakeProvider({ "EUR/USD": [bar("2026-09-01", 1.1, 1.2, 1.05, 1.15)] }),
    });
    await market.syncDailyBars({
      provider: fakeProvider({ "EUR/USD": [bar("2026-09-01", 1.1, 1.3, 1.0, 1.18)] }),
    });

    const rows = await db.marketDailyBar.findMany();
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.close)).toBeCloseTo(1.18, 6);
    expect(Number(rows[0]!.high)).toBeCloseTo(1.3, 6);
  });

  it("visits the STALEST instrument first, never-synced ones ahead of everything", async () => {
    // ADR-087 #9. This ordering is what makes resumption implicit: a run that
    // exhausts its budget leaves the rest at the front of the next one, so
    // there is no cursor column to keep honest.
    const fresh = await makeInstrument("EUR/USD", 0);
    const stale = await makeInstrument("GBP/USD", 1);
    await makeInstrument("AUD/USD", 2); // never synced

    await db.marketDailyBar.createMany({
      data: [
        {
          instrumentId: fresh.id,
          date: new Date("2026-09-10T00:00:00Z"),
          open: 1,
          high: 1,
          low: 1,
          close: 1,
        },
        {
          instrumentId: stale.id,
          date: new Date("2026-01-10T00:00:00Z"),
          open: 1,
          high: 1,
          low: 1,
          close: 1,
        },
      ],
    });

    const provider = fakeProvider({
      "EUR/USD": [bar("2026-09-11", 1, 1, 1, 1)],
      "GBP/USD": [bar("2026-09-11", 1, 1, 1, 1)],
      "AUD/USD": [bar("2026-09-11", 1, 1, 1, 1)],
    });
    await market.syncDailyBars({ provider });

    expect(provider.calls.map((c) => c.symbol)).toEqual(["AUD/USD", "GBP/USD", "EUR/USD"]);
  });

  it("stops at the budget and reports what it skipped", async () => {
    await makeInstrument("EUR/USD", 0);
    await makeInstrument("GBP/USD", 1);
    await makeInstrument("AUD/USD", 2);
    const provider = fakeProvider({
      "EUR/USD": [bar("2026-09-01", 1, 1, 1, 1)],
      "GBP/USD": [bar("2026-09-01", 1, 1, 1, 1)],
      "AUD/USD": [bar("2026-09-01", 1, 1, 1, 1)],
    });

    const result = await market.syncDailyBars({ provider, budget: 2 });

    expect(result.attempted).toBe(2);
    expect(result.skipped).toBe(1);
    expect(provider.calls).toHaveLength(2);
  });

  it("records a provider failure and LEAVES yesterday's bars alone", async () => {
    const instrument = await makeInstrument("EUR/USD");
    await db.marketDailyBar.create({
      data: {
        instrumentId: instrument.id,
        date: new Date("2026-09-01T00:00:00Z"),
        open: 1,
        high: 1,
        low: 1,
        close: 1.23,
      },
    });

    const failing: MarketModule.MarketHistoryProvider = {
      name: "failing",
      async fetchDailySeries() {
        throw new Error("Provider rate-limited");
      },
    };
    const result = await market.syncDailyBars({ provider: failing });

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.error).toContain("rate-limited");
    // The whole point: a failed sweep degrades, it does not destroy.
    const rows = await db.marketDailyBar.findMany();
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.close)).toBeCloseTo(1.23, 6);

    const provider = await db.marketProvider.findUnique({ where: { id: "default" } });
    expect(provider!.lastSyncError).toContain("rate-limited");
    expect(provider!.lastSyncAt).not.toBeNull();
  });

  it("does nothing but record the reason when no provider is configured", async () => {
    await makeInstrument("EUR/USD");
    const result = await market.syncDailyBars({ provider: null });

    expect(result.attempted).toBe(0);
    expect(await db.marketDailyBar.count()).toBe(0);
    const provider = await db.marketProvider.findUnique({ where: { id: "default" } });
    expect(provider!.lastSyncError).toBe("No provider configured");
  });

  it("skips an inactive instrument entirely", async () => {
    const row = await makeInstrument("EUR/USD");
    await db.marketInstrument.update({ where: { id: row.id }, data: { isActive: false } });
    const provider = fakeProvider({ "EUR/USD": [bar("2026-09-01", 1, 1, 1, 1)] });

    const result = await market.syncDailyBars({ provider });
    expect(result.attempted).toBe(0);
    expect(provider.calls).toHaveLength(0);
  });

  it("asks the provider for providerSymbol when one is set", async () => {
    await db.marketInstrument.create({
      data: {
        symbol: "SPX/USD",
        displayName: "S&P 500",
        kind: "INDEX",
        base: "SPX",
        quote: "USD",
        providerSymbol: "SPX500",
      },
    });
    const provider = fakeProvider({ SPX500: [bar("2026-09-01", 1, 1, 1, 1)] });

    await market.syncDailyBars({ provider });
    expect(provider.calls[0]!.symbol).toBe("SPX500");
  });
});

// ─── The fold ────────────────────────────────────────────────

describe("getOhlc and foldBars", () => {
  it("takes the first open, the highest high, the lowest low and the last close", async () => {
    // ADR-087 #4, the aggregation rule. The high is the half that cannot be
    // derived from closes, which is why bars are stored at all.
    const folded = market.foldBars(
      [
        bar("2026-09-01", 1.1, 1.5, 1.0, 1.2),
        bar("2026-09-02", 1.2, 1.3, 0.9, 1.25),
        bar("2026-09-03", 1.25, 1.4, 1.1, 1.35),
      ],
      "1W",
    );

    expect(folded).not.toBeNull();
    expect(folded!.open).toBeCloseTo(1.1, 6);
    expect(folded!.high).toBeCloseTo(1.5, 6);
    expect(folded!.low).toBeCloseTo(0.9, 6);
    expect(folded!.close).toBeCloseTo(1.35, 6);
    expect(folded!.from).toBe("2026-09-01");
    expect(folded!.to).toBe("2026-09-03");
  });

  it("folds bars given out of order", async () => {
    const folded = market.foldBars(
      [bar("2026-09-03", 1.25, 1.4, 1.1, 1.35), bar("2026-09-01", 1.1, 1.5, 1.0, 1.2)],
      "1W",
    );
    expect(folded!.open).toBeCloseTo(1.1, 6);
    expect(folded!.close).toBeCloseTo(1.35, 6);
  });

  it("is null for an empty period rather than a zeroed bar", async () => {
    expect(market.foldBars([], "1W")).toBeNull();
  });

  it("reads the newest stored bar for 1D", async () => {
    const instrument = await makeInstrument("EUR/USD");
    await db.marketDailyBar.createMany({
      data: [
        {
          instrumentId: instrument.id,
          date: new Date("2026-09-01T00:00:00Z"),
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5,
        },
        {
          instrumentId: instrument.id,
          date: new Date("2026-09-02T00:00:00Z"),
          open: 1.5,
          high: 3,
          low: 1,
          close: 2.5,
        },
      ],
    });

    const ohlc = await market.getOhlc("EUR/USD", "1D");
    expect(ohlc!.close).toBeCloseTo(2.5, 6);
    expect(ohlc!.high).toBeCloseTo(3, 6);
  });

  it("is null for a symbol with no instrument at all", async () => {
    expect(await market.getOhlc("ZZZ/USD", "1D")).toBeNull();
  });
});

// ─── The snapshot ────────────────────────────────────────────

describe("getRateSnapshot", () => {
  it("reports an empty snapshot as stale rather than as fresh-and-empty", async () => {
    const snapshot = await market.getRateSnapshot();
    expect(snapshot.rates).toEqual({});
    expect(snapshot.stale).toBe(true);
    expect(snapshot.asOf).toBeNull();
  });

  it("reads a USD-quoted instrument as units per USD", async () => {
    const instrument = await db.marketInstrument.create({
      data: { symbol: "EUR", displayName: "Euro", kind: "CURRENCY", base: "EUR", quote: "USD" },
    });
    await db.marketDailyBar.create({
      data: {
        instrumentId: instrument.id,
        date: new Date(),
        open: 1.08,
        high: 1.09,
        low: 1.07,
        close: 1.08,
      },
    });

    const snapshot = await market.getRateSnapshot();
    // close is USD per 1 EUR, so EUR per USD is its reciprocal.
    expect(snapshot.rates.EUR).toBeCloseTo(1 / 1.08, 8);
    expect(snapshot.reporting.reported).toBe(1);
  });

  it("reads a USD-based pair straight, without inverting it", async () => {
    const instrument = await db.marketInstrument.create({
      data: { symbol: "USD/JPY", displayName: "USD/JPY", kind: "PAIR", base: "USD", quote: "JPY" },
    });
    await db.marketDailyBar.create({
      data: {
        instrumentId: instrument.id,
        date: new Date(),
        open: 157,
        high: 158,
        low: 156,
        close: 157,
      },
    });

    const snapshot = await market.getRateSnapshot();
    expect(snapshot.rates.JPY).toBeCloseTo(157, 6);
  });

  it("EXCLUDES a cross with no USD leg rather than triangulating it", async () => {
    // A EUR/GBP bar says nothing about either against the dollar. Inventing a
    // triangulation here would put a derived number in the same map as
    // measured ones, and nothing downstream could tell them apart.
    const instrument = await db.marketInstrument.create({
      data: { symbol: "EUR/GBP", displayName: "EUR/GBP", kind: "PAIR", base: "EUR", quote: "GBP" },
    });
    await db.marketDailyBar.create({
      data: {
        instrumentId: instrument.id,
        date: new Date(),
        open: 0.85,
        high: 0.86,
        low: 0.84,
        close: 0.85,
      },
    });

    const snapshot = await market.getRateSnapshot();
    expect(snapshot.rates).toEqual({});
    expect(snapshot.reporting.total).toBe(1);
    expect(snapshot.reporting.reported).toBe(0);
  });

  it("flags an old bar as stale", async () => {
    const instrument = await db.marketInstrument.create({
      data: { symbol: "EUR", displayName: "Euro", kind: "CURRENCY", base: "EUR", quote: "USD" },
    });
    await db.marketDailyBar.create({
      data: {
        instrumentId: instrument.id,
        date: new Date("2020-01-01T00:00:00Z"),
        open: 1.1,
        high: 1.1,
        low: 1.1,
        close: 1.1,
      },
    });

    const snapshot = await market.getRateSnapshot();
    expect(snapshot.stale).toBe(true);
    // Stale does NOT mean absent: the rate is still served, and labelled.
    expect(snapshot.rates.EUR).toBeGreaterThan(0);
  });
});

// ─── The sealed key ──────────────────────────────────────────

describe("the provider key (ADR-087 #5)", () => {
  it("cannot appear on the provider view — the TYPE forbids it", () => {
    // A leak has to get past the type, not just past a reviewer.
    expectTypeOf<MarketAdminModule.MarketProviderView>().not.toHaveProperty("apiKey");
    expectTypeOf<MarketAdminModule.MarketProviderView>().not.toHaveProperty("apiKeyCipher");
  });

  it("does not carry the key at runtime either", async () => {
    await db.marketProvider.update({
      where: { id: "default" },
      data: { apiKeyCipher: "v1:aaa:bbb:ccc", driver: "ALPHAVANTAGE" },
    });
    const view = await admin.loadMarketProvider();

    expect(view.hasApiKey).toBe(true);
    expect(Object.keys(view)).not.toContain("apiKey");
    expect(Object.keys(view)).not.toContain("apiKeyCipher");
    expect(JSON.stringify(view)).not.toContain("v1:");
  });

  it("leaves a stored key alone when the field is submitted blank", async () => {
    const subject = {
      id: "seed-admin",
      userType: "STAFF" as const,
      roleKeys: [],
      maxRoleLevel: 100,
      allowed: new Set<string>(),
      denied: new Set<string>(),
    };
    await db.user.create({
      data: { id: "seed-admin", email: "a@b.test", name: "A", userType: "STAFF" },
    });

    await admin.saveMarketProvider(subject, {
      driver: "ALPHAVANTAGE",
      apiKey: "real-key",
      refreshSeconds: 300,
      staleSeconds: 86_400,
      isEnabled: true,
    });
    const sealed = (await db.marketProvider.findUnique({ where: { id: "default" } }))!.apiKeyCipher;
    expect(sealed).toBeTruthy();

    // Write-only means the field renders EMPTY over a stored key, so "blank =
    // erase" would wipe the credential on every unrelated save of the form.
    await admin.saveMarketProvider(subject, {
      driver: "ALPHAVANTAGE",
      apiKey: "",
      refreshSeconds: 600,
      staleSeconds: 86_400,
      isEnabled: true,
    });
    const after = (await db.marketProvider.findUnique({ where: { id: "default" } }))!;
    expect(after.apiKeyCipher).toBe(sealed);
    expect(after.refreshSeconds).toBe(600);

    await db.auditLog.deleteMany();
    await db.user.deleteMany();
  });

  it("has exactly one reader, and it returns null rather than throwing when unusable", async () => {
    await db.marketProvider.update({
      where: { id: "default" },
      data: { driver: "ALPHAVANTAGE", isEnabled: true, apiKeyCipher: "v1:not:a:seal" },
    });
    // A configuration fault on a public page must degrade, not 500.
    expect(await market.loadProviderDriver()).toBeNull();
  });

  it("returns no driver while the provider is disabled, key or not", async () => {
    await db.marketProvider.update({
      where: { id: "default" },
      data: { driver: "ALPHAVANTAGE", isEnabled: false, apiKeyCipher: market.sealProviderKey("k") },
    });
    expect(await market.loadProviderDriver()).toBeNull();
  });

  it("returns no driver for the MANUAL driver, which is the seeded default", async () => {
    await db.marketProvider.update({
      where: { id: "default" },
      data: { driver: "MANUAL", isEnabled: true, apiKeyCipher: market.sealProviderKey("k") },
    });
    expect(await market.loadProviderDriver()).toBeNull();
  });
});

describe("getSyncDueState (ADR-096 #1)", () => {
  it("is always due when nothing has ever synced", async () => {
    // The one run that must never be deferred: a fresh instance has no bars,
    // so every rate-backed surface is empty until this happens.
    await db.marketProvider.update({
      where: { id: "default" },
      data: { lastSyncAt: null, refreshSeconds: 86_400 },
    });

    const state = await market.getSyncDueState(new Date("2026-09-14T12:00:00Z"));
    expect(state.due).toBe(true);
    expect(state.lastSyncAt).toBeNull();
    // Null, not a date: there is nothing to wait for, and inventing a due time
    // would make the screen promise a moment that means nothing.
    expect(state.nextDueAt).toBeNull();
    expect(state.intervalSeconds).toBe(86_400);
  });

  it("is not due inside the interval, and names when it will be", async () => {
    await db.marketProvider.update({
      where: { id: "default" },
      data: { lastSyncAt: new Date("2026-09-14T00:00:00Z"), refreshSeconds: 3_600 },
    });

    const state = await market.getSyncDueState(new Date("2026-09-14T00:30:00Z"));
    expect(state.due).toBe(false);
    expect(state.nextDueAt?.toISOString()).toBe("2026-09-14T01:00:00.000Z");
  });

  it("is due exactly ON the boundary, not a second after", async () => {
    // A scheduler ticking on the hour against an hourly interval must not skip
    // every other run to a rounding error.
    await db.marketProvider.update({
      where: { id: "default" },
      data: { lastSyncAt: new Date("2026-09-14T00:00:00Z"), refreshSeconds: 3_600 },
    });

    expect((await market.getSyncDueState(new Date("2026-09-14T01:00:00Z"))).due).toBe(true);
    expect((await market.getSyncDueState(new Date("2026-09-14T00:59:59Z"))).due).toBe(false);
  });

  it("reads the admin's own interval, so changing it moves the next run", async () => {
    // This is the whole claim of ADR-096 #2: the setting is load-bearing.
    await db.marketProvider.update({
      where: { id: "default" },
      data: { lastSyncAt: new Date("2026-09-14T00:00:00Z"), refreshSeconds: 86_400 },
    });
    expect((await market.getSyncDueState(new Date("2026-09-14T02:00:00Z"))).due).toBe(false);

    await db.marketProvider.update({ where: { id: "default" }, data: { refreshSeconds: 3_600 } });
    expect((await market.getSyncDueState(new Date("2026-09-14T02:00:00Z"))).due).toBe(true);
  });
});
