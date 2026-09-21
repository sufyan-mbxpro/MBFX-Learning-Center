// Hand-computed tables (testing.md: calculators get pure-function tables
// against values computed by hand, 90% floor).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  accountPipValue,
  convertAmount,
  crossRate,
  gainLoss,
  marginRequired,
  pipSize,
  pipValue,
  pivotPoints,
  positionSize,
  quoteWithMarkup,
  accountMargin,
  riskLevel,
  riskReward,
  tradeProfit,
} from "./calculators.ts";

describe("pipSize", () => {
  it.each([
    ["EUR/USD", 0.0001],
    ["GBP/USD", 0.0001],
    ["USD/JPY", 0.01],
    ["EUR/JPY", 0.01],
    ["eur/jpy", 0.01],
  ])("%s → %d", (pair, expected) => {
    expect(pipSize(pair)).toBe(expected);
  });
});

describe("pipValue — hand-computed", () => {
  it("EUR/USD, 1 lot at 1.1000: $10/pip; €9.0909…/pip", () => {
    const { quoteCurrency, baseCurrency } = pipValue({ pair: "EUR/USD", lots: 1, price: 1.1 });
    expect(quoteCurrency).toBeCloseTo(10, 10);
    expect(baseCurrency).toBeCloseTo(10 / 1.1, 10);
  });

  it("USD/JPY, 0.5 lots at 150.00: ¥500/pip; $3.3333…/pip", () => {
    const { quoteCurrency, baseCurrency } = pipValue({ pair: "USD/JPY", lots: 0.5, price: 150 });
    expect(quoteCurrency).toBeCloseTo(500, 10);
    expect(baseCurrency).toBeCloseTo(500 / 150, 10);
  });

  it("micro lot (0.01) EUR/USD: $0.10/pip", () => {
    expect(pipValue({ pair: "EUR/USD", lots: 0.01, price: 1.1 }).quoteCurrency).toBeCloseTo(
      0.1,
      10,
    );
  });

  it("rejects non-positive lots/price", () => {
    expect(() => pipValue({ pair: "EUR/USD", lots: 0, price: 1.1 })).toThrow(RangeError);
    expect(() => pipValue({ pair: "EUR/USD", lots: 1, price: 0 })).toThrow(RangeError);
  });
});

describe("positionSize — hand-computed", () => {
  it("$10,000 balance, 1% risk, 50-pip stop, $10/pip/lot → 0.2 lots (risking exactly $100)", () => {
    const lots = positionSize({
      balance: 10_000,
      riskFraction: 0.01,
      stopLossPips: 50,
      pipValuePerLot: 10,
    });
    expect(lots).toBeCloseTo(0.2, 10);
    // Sanity: 0.2 lots × 50 pips × $10/pip/lot = $100 = 1% of $10,000.
    expect(lots * 50 * 10).toBeCloseTo(100, 10);
  });

  it("$5,000, 2%, 25-pip stop, $10/pip/lot → 0.4 lots", () => {
    expect(
      positionSize({ balance: 5_000, riskFraction: 0.02, stopLossPips: 25, pipValuePerLot: 10 }),
    ).toBeCloseTo(0.4, 10);
  });

  it("rejects out-of-range risk (0, 1, negatives) and non-positive inputs", () => {
    expect(() =>
      positionSize({ balance: 1000, riskFraction: 0, stopLossPips: 10, pipValuePerLot: 10 }),
    ).toThrow(RangeError);
    expect(() =>
      positionSize({ balance: 1000, riskFraction: 1, stopLossPips: 10, pipValuePerLot: 10 }),
    ).toThrow(RangeError);
    expect(() =>
      positionSize({ balance: -1, riskFraction: 0.01, stopLossPips: 10, pipValuePerLot: 10 }),
    ).toThrow(RangeError);
    expect(() =>
      positionSize({ balance: 1000, riskFraction: 0.01, stopLossPips: 0, pipValuePerLot: 10 }),
    ).toThrow(RangeError);
    expect(() =>
      positionSize({ balance: 1000, riskFraction: 0.01, stopLossPips: 10, pipValuePerLot: 0 }),
    ).toThrow(RangeError);
  });
});

describe("marginRequired — hand-computed", () => {
  it("1 lot EUR/USD at 1.1000 with 30:1 → $3,666.66…", () => {
    expect(marginRequired({ lots: 1, price: 1.1, leverage: 30 })).toBeCloseTo(110_000 / 30, 8);
  });

  it("0.1 lot USD/JPY at 150.00 with 100:1 → ¥15,000", () => {
    expect(marginRequired({ lots: 0.1, price: 150, leverage: 100 })).toBeCloseTo(15_000, 8);
  });

  it("rejects non-positive inputs", () => {
    expect(() => marginRequired({ lots: 0, price: 1, leverage: 30 })).toThrow(RangeError);
    expect(() => marginRequired({ lots: 1, price: 0, leverage: 30 })).toThrow(RangeError);
    expect(() => marginRequired({ lots: 1, price: 1, leverage: 0 })).toThrow(RangeError);
  });
});

// ─── changes-25 T2 ───────────────────────────────────────────

describe("gainLoss — hand-computed, from each of its three entry points", () => {
  it("solves from an amount", () => {
    const r = gainLoss({
      startBalance: 1000,
      direction: "gain",
      known: { kind: "amount", value: 250 },
    });
    expect(r.amount).toBe(250);
    expect(r.percent).toBeCloseTo(25, 10);
    expect(r.endingBalance).toBe(1250);
  });

  it("solves from a percent", () => {
    const r = gainLoss({
      startBalance: 1000,
      direction: "loss",
      known: { kind: "percent", value: 40 },
    });
    expect(r.amount).toBeCloseTo(400, 10);
    expect(r.endingBalance).toBeCloseTo(600, 10);
  });

  it("solves from an ending balance", () => {
    const r = gainLoss({
      startBalance: 1000,
      direction: "loss",
      known: { kind: "endingBalance", value: 600 },
    });
    expect(r.amount).toBeCloseTo(400, 10);
    expect(r.percent).toBeCloseTo(40, 10);
  });

  it("shows the asymmetry: a 50% loss needs a 100% gain back", () => {
    // The one number in this tool that surprises people, and the reason it
    // is computed rather than left to the reader.
    const r = gainLoss({
      startBalance: 1000,
      direction: "loss",
      known: { kind: "percent", value: 50 },
    });
    expect(r.breakevenPercent).toBeCloseTo(100, 10);
  });

  it("needs no gain back after a gain", () => {
    const r = gainLoss({
      startBalance: 1000,
      direction: "gain",
      known: { kind: "percent", value: 50 },
    });
    expect(r.breakevenPercent).toBe(0);
  });

  it("lets the declared direction win over the one an ending balance implies", () => {
    // The form has a gain/loss toggle. Someone who types an ending balance
    // below their start while it says "gain" has made a typo, not asked for
    // a negative gain.
    const r = gainLoss({
      startBalance: 1000,
      direction: "gain",
      known: { kind: "endingBalance", value: 600 },
    });
    expect(r.endingBalance).toBe(1400);
  });

  it("refuses a non-positive starting balance", () => {
    expect(() =>
      gainLoss({ startBalance: 0, direction: "gain", known: { kind: "amount", value: 1 } }),
    ).toThrow(RangeError);
  });

  it("round-trips from each entry point to the same result", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1e6, noNaN: true }).map((v) => Math.round(v * 100) / 100),
        fc.double({ min: 0, max: 99, noNaN: true }).map((v) => Math.round(v * 100) / 100),
        fc.constantFrom("gain" as const, "loss" as const),
        (startBalance, percent, direction) => {
          const fromPercent = gainLoss({
            startBalance,
            direction,
            known: { kind: "percent", value: percent },
          });
          const fromAmount = gainLoss({
            startBalance,
            direction,
            known: { kind: "amount", value: fromPercent.amount },
          });
          const fromEnding = gainLoss({
            startBalance,
            direction,
            known: { kind: "endingBalance", value: fromPercent.endingBalance },
          });
          expect(fromAmount.endingBalance).toBeCloseTo(fromPercent.endingBalance, 6);
          expect(fromEnding.percent).toBeCloseTo(fromPercent.percent, 6);
          expect(fromEnding.amount).toBeCloseTo(fromPercent.amount, 6);
        },
      ),
    );
  });
});

describe("pivotPoints — the five methods", () => {
  // One period, used across every method so the numbers are comparable.
  const ohlc = { open: 1.095, high: 1.105, low: 1.09, close: 1.1 };

  it("Floor: PP is the average of high, low and close", () => {
    const p = pivotPoints({ ...ohlc, method: "floor" });
    expect(p.pp).toBeCloseTo((1.105 + 1.09 + 1.1) / 3, 12);
    expect(p.r1).toBeCloseTo(2 * p.pp - 1.09, 12);
    expect(p.s1).toBeCloseTo(2 * p.pp - 1.105, 12);
  });

  it("Woodie: PP weights the open double, so it leans toward the open", () => {
    const p = pivotPoints({ ...ohlc, method: "woodie" });
    expect(p.pp).toBeCloseTo((1.105 + 1.09 + 2 * 1.095) / 4, 12);
  });

  it("Camarilla: four levels a side, all relative to the close", () => {
    const p = pivotPoints({ ...ohlc, method: "camarilla" });
    const range = 1.105 - 1.09;
    expect(p.r4).toBeCloseTo(1.1 + (range * 1.1) / 2, 12);
    expect(p.s4).toBeCloseTo(1.1 - (range * 1.1) / 2, 12);
    expect(p.r1).toBeCloseTo(1.1 + (range * 1.1) / 12, 12);
  });

  it("DeMark: one level a side, and the rest are null rather than zero", () => {
    // A zero would render as a price of zero. A null renders as a dash,
    // which is what "this method does not have an R2" looks like.
    const p = pivotPoints({ ...ohlc, method: "demark" });
    expect(p.r1).not.toBeNull();
    expect(p.s1).not.toBeNull();
    expect(p.r2).toBeNull();
    expect(p.s3).toBeNull();
  });

  it("DeMark: X changes with where the close sits against the open", () => {
    const up = pivotPoints({ open: 1.09, high: 1.105, low: 1.09, close: 1.1, method: "demark" });
    const down = pivotPoints({ open: 1.1, high: 1.105, low: 1.09, close: 1.095, method: "demark" });
    expect(up.pp).not.toBeCloseTo(down.pp, 6);
  });

  it("Fibonacci: R1/R2 sit at 38.2% and 61.8% of the range above PP", () => {
    const p = pivotPoints({ ...ohlc, method: "fibonacci" });
    const range = 1.105 - 1.09;
    expect(p.r1).toBeCloseTo(p.pp + 0.382 * range, 12);
    expect(p.r2).toBeCloseTo(p.pp + 0.618 * range, 12);
    expect(p.r3).toBeCloseTo(p.pp + range, 12);
  });

  it("refuses a high below its low", () => {
    expect(() => pivotPoints({ open: 1, high: 1, low: 2, close: 1, method: "floor" })).toThrow(
      RangeError,
    );
  });

  it("orders Floor levels S3 < S2 < S1 < PP < R1 < R2 < R3 for any period", () => {
    // The property that would catch a transposed sign anywhere in the set,
    // which a table of one period cannot.
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (low, range, closeFraction) => {
          const high = low + range;
          const close = low + range * closeFraction;
          const p = pivotPoints({ open: close, high, low, close, method: "floor" });
          expect(p.s3!).toBeLessThanOrEqual(p.s2!);
          expect(p.s2!).toBeLessThanOrEqual(p.s1!);
          expect(p.s1!).toBeLessThanOrEqual(p.pp);
          expect(p.pp).toBeLessThanOrEqual(p.r1!);
          expect(p.r1!).toBeLessThanOrEqual(p.r2!);
          expect(p.r2!).toBeLessThanOrEqual(p.r3!);
        },
      ),
    );
  });
});

describe("crossRate", () => {
  const rates = { EUR: 0.92, GBP: 0.79, JPY: 157.2 };

  it("is 1 for a currency against itself", () => {
    expect(crossRate("EUR", "EUR", rates)).toBe(1);
  });

  it("reads a USD leg straight off the snapshot", () => {
    expect(crossRate("USD", "EUR", rates)).toBeCloseTo(0.92, 12);
    expect(crossRate("EUR", "USD", rates)).toBeCloseTo(1 / 0.92, 12);
  });

  it("assembles a non-USD cross through USD", () => {
    expect(crossRate("EUR", "GBP", rates)).toBeCloseTo(0.79 / 0.92, 12);
  });

  it("is case-insensitive on both legs", () => {
    expect(crossRate("eur", "gbp", rates)).toBeCloseTo(0.79 / 0.92, 12);
  });

  it("is null — never NaN — when a leg is missing", () => {
    // The return type is what stops a NaN reaching a toFixed on a page whose
    // provider is down.
    expect(crossRate("EUR", "CHF", rates)).toBeNull();
    expect(crossRate("CHF", "EUR", rates)).toBeNull();
  });

  it("is null for a zero or negative rate rather than dividing by it", () => {
    expect(crossRate("EUR", "BAD", { ...rates, BAD: 0 })).toBeNull();
  });

  it("inverts: a → b is 1 / (b → a)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1000, noNaN: true }),
        fc.double({ min: 0.01, max: 1000, noNaN: true }),
        (a, b) => {
          const forward = crossRate("A", "B", { A: a, B: b })!;
          const backward = crossRate("B", "A", { A: a, B: b })!;
          expect(forward * backward).toBeCloseTo(1, 8);
        },
      ),
    );
  });
});

describe("convertAmount", () => {
  it("converts through the cross rate", () => {
    expect(convertAmount(100, "USD", "EUR", { EUR: 0.92 })).toBeCloseTo(92, 12);
  });

  it("is null when the rate is not available", () => {
    expect(convertAmount(100, "USD", "CHF", { EUR: 0.92 })).toBeNull();
  });
});

describe("accountPipValue", () => {
  it("values a pip in the quote currency with no rate at all", () => {
    // The half that needs no provider, which is why a rate-less instance
    // still answers for a USD account on a USD-quoted pair.
    const r = accountPipValue({
      pair: "EUR/USD",
      units: 100_000,
      price: 1.1,
      accountCurrency: "USD",
      rates: {},
    });
    expect(r.quoteCurrency).toBeCloseTo(10, 12);
    expect(r.accountCurrency).toBeCloseTo(10, 12);
  });

  it("converts the quote leg into a different account currency", () => {
    const r = accountPipValue({
      pair: "EUR/USD",
      units: 100_000,
      price: 1.1,
      accountCurrency: "EUR",
      rates: { EUR: 0.92 },
    });
    expect(r.accountCurrency).toBeCloseTo(10 * 0.92, 10);
  });

  it("handles a JPY-quoted pair on its larger pip", () => {
    const r = accountPipValue({
      pair: "USD/JPY",
      units: 100_000,
      price: 157,
      accountCurrency: "JPY",
      rates: { JPY: 157 },
    });
    expect(r.quoteCurrency).toBeCloseTo(1000, 10);
  });

  it("reports a null account leg — not a zero — when the rate is missing", () => {
    const r = accountPipValue({
      pair: "EUR/USD",
      units: 100_000,
      price: 1.1,
      accountCurrency: "CHF",
      rates: {},
    });
    expect(r.quoteCurrency).toBeCloseTo(10, 12);
    expect(r.accountCurrency).toBeNull();
  });

  it("refuses non-positive units or price", () => {
    const base = { pair: "EUR/USD", price: 1.1, accountCurrency: "USD", rates: {} };
    expect(() => accountPipValue({ ...base, units: 0 })).toThrow(RangeError);
    expect(() => accountPipValue({ ...base, units: 1, price: 0 })).toThrow(RangeError);
  });
});

describe("quoteWithMarkup", () => {
  it("returns the mid-market figures untouched at 0%", () => {
    const q = quoteWithMarkup({ amount: 100, midRate: 0.92, markupPercent: 0 });
    expect(q.effectiveRate).toBeCloseTo(0.92, 12);
    expect(q.converted).toBeCloseTo(92, 12);
    expect(q.atMid).toBeCloseTo(92, 12);
    expect(q.cost).toBeCloseTo(0, 12);
  });

  it("takes the markup OFF the rate, not on to it", () => {
    // The sign that matters. `mid * (1 + markup)` would read as "the bank
    // gives you more", presenting a cost as a bonus.
    const q = quoteWithMarkup({ amount: 100, midRate: 0.92, markupPercent: 3 });
    expect(q.effectiveRate).toBeLessThan(0.92);
    expect(q.effectiveRate).toBeCloseTo(0.8924, 10);
    expect(q.converted).toBeCloseTo(89.24, 10);
  });

  it("keeps the mid-market figure ALONGSIDE the marked-up one", () => {
    // The comparison is the whole point of the control; a tool that replaced
    // one number with the other would hide what it exists to show.
    const q = quoteWithMarkup({ amount: 100, midRate: 0.92, markupPercent: 7 });
    expect(q.atMid).toBeCloseTo(92, 10);
    expect(q.converted).toBeLessThan(q.atMid);
  });

  it("reports the cost as the difference between the two", () => {
    const q = quoteWithMarkup({ amount: 250, midRate: 1.27, markupPercent: 4 });
    expect(q.cost).toBeCloseTo(q.atMid - q.converted, 10);
    expect(q.cost).toBeCloseTo(250 * 1.27 * 0.04, 8);
  });

  it("converts nothing, and costs nothing, for an amount of zero", () => {
    const q = quoteWithMarkup({ amount: 0, midRate: 1.27, markupPercent: 4 });
    expect(q.converted).toBe(0);
    expect(q.cost).toBe(0);
  });

  it("refuses a negative amount, a non-positive rate and an out-of-range markup", () => {
    expect(() => quoteWithMarkup({ amount: -1, midRate: 1, markupPercent: 0 })).toThrow(RangeError);
    expect(() => quoteWithMarkup({ amount: 1, midRate: 0, markupPercent: 0 })).toThrow(RangeError);
    expect(() => quoteWithMarkup({ amount: 1, midRate: 1, markupPercent: 100 })).toThrow(
      RangeError,
    );
    expect(() => quoteWithMarkup({ amount: 1, midRate: 1, markupPercent: -1 })).toThrow(RangeError);
  });

  it("costs more as the markup grows, and never more than the whole amount", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        fc.double({ min: 0.0001, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 99, noNaN: true }),
        (amount, midRate, markupPercent) => {
          const q = quoteWithMarkup({ amount, midRate, markupPercent });
          expect(q.cost).toBeGreaterThanOrEqual(-1e-9);
          expect(q.cost).toBeLessThanOrEqual(q.atMid + 1e-9);
          expect(q.converted).toBeLessThanOrEqual(q.atMid + 1e-9);
        },
      ),
    );
  });
});

// ─── changes-41 (ADR-135) ────────────────────────────────────

/** Units per USD: EUR 0.8 (so EUR/USD = 1.25), GBP 0.5, JPY 150. */
const RATES = { EUR: 0.8, GBP: 0.5, JPY: 150 };

describe("accountMargin — hand-computed", () => {
  it("needs no rate when the base currency is the account currency", () => {
    const m = accountMargin({
      pair: "USD/JPY",
      units: 100_000,
      leverage: 100,
      accountCurrency: "USD",
      rates: {},
      balance: 10_000,
    });
    expect(m.inBase).toBe(1000);
    expect(m.baseCurrency).toBe("USD");
    expect(m.inAccount).toBe(1000);
    expect(m.freeMargin).toBe(9000);
    expect(m.marginLevel).toBe(1000);
  });

  it("converts the base-currency deposit into the account currency", () => {
    // 100,000 EUR at 1:50 = 2,000 EUR = 2,500 USD at EUR/USD 1.25.
    const m = accountMargin({
      pair: "EUR/USD",
      units: 100_000,
      leverage: 50,
      accountCurrency: "USD",
      rates: RATES,
      balance: 5000,
    });
    expect(m.inBase).toBe(2000);
    expect(m.inAccount).toBeCloseTo(2500, 8);
    expect(m.freeMargin).toBeCloseTo(2500, 8);
    expect(m.marginLevel).toBeCloseTo(200, 8);
  });

  it("returns null legs, never zeros, without a rate or a balance", () => {
    const noRate = accountMargin({
      pair: "EUR/USD",
      units: 1000,
      leverage: 100,
      accountCurrency: "USD",
      rates: {},
      balance: 100,
    });
    expect(noRate.inBase).toBe(10);
    expect(noRate.inAccount).toBeNull();
    expect(noRate.freeMargin).toBeNull();
    expect(noRate.marginLevel).toBeNull();

    const noBalance = accountMargin({
      pair: "USD/JPY",
      units: 1000,
      leverage: 100,
      accountCurrency: "USD",
      rates: {},
    });
    expect(noBalance.freeMargin).toBeNull();
    expect(noBalance.marginLevel).toBeNull();
  });

  it("refuses non-positive units or leverage and a negative balance", () => {
    const base = { pair: "EUR/USD", accountCurrency: "USD", rates: RATES };
    expect(() => accountMargin({ ...base, units: 0, leverage: 100 })).toThrow(RangeError);
    expect(() => accountMargin({ ...base, units: 1, leverage: 0 })).toThrow(RangeError);
    expect(() => accountMargin({ ...base, units: 1, leverage: 1, balance: -1 })).toThrow(
      RangeError,
    );
  });

  it("scales linearly with size and inversely with leverage", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        fc.integer({ min: 1, max: 1000 }),
        (units, leverage) => {
          const args = { pair: "EUR/USD", accountCurrency: "USD", rates: RATES };
          const one = accountMargin({ ...args, units, leverage });
          const doubled = accountMargin({ ...args, units: units * 2, leverage });
          const levered = accountMargin({ ...args, units, leverage: leverage * 2 });
          expect(doubled.inAccount!).toBeCloseTo(one.inAccount! * 2, 6);
          expect(levered.inAccount!).toBeCloseTo(one.inAccount! / 2, 6);
        },
      ),
    );
  });
});

describe("tradeProfit — hand-computed", () => {
  it("counts a rise as profit on a buy", () => {
    // 1 lot EUR/USD, 1.1000 → 1.1050: 50 pips, 500 USD.
    const p = tradeProfit({
      pair: "EUR/USD",
      direction: "buy",
      units: 100_000,
      open: 1.1,
      close: 1.105,
      accountCurrency: "USD",
      rates: {},
    });
    expect(p.pips).toBeCloseTo(50, 8);
    expect(p.inQuote).toBeCloseTo(500, 6);
    expect(p.quoteCurrency).toBe("USD");
    expect(p.inAccount).toBeCloseTo(500, 6);
  });

  it("counts a rise as a loss on a sell, and converts yen into the account currency", () => {
    // 1 lot USD/JPY sold at 150.00, closed at 150.30: −30 pips, −30,000 JPY = −200 USD.
    const p = tradeProfit({
      pair: "USD/JPY",
      direction: "sell",
      units: 100_000,
      open: 150,
      close: 150.3,
      accountCurrency: "USD",
      rates: RATES,
    });
    expect(p.pips).toBeCloseTo(-30, 6);
    expect(p.inQuote).toBeCloseTo(-30_000, 4);
    expect(p.inAccount).toBeCloseTo(-200, 6);
  });

  it("leaves the account leg null without a rate", () => {
    const p = tradeProfit({
      pair: "EUR/GBP",
      direction: "buy",
      units: 1000,
      open: 0.85,
      close: 0.86,
      accountCurrency: "USD",
      rates: {},
    });
    expect(p.inQuote).toBeCloseTo(10, 8);
    expect(p.inAccount).toBeNull();
  });

  it("refuses non-positive size or prices", () => {
    const base = { pair: "EUR/USD", direction: "buy" as const, accountCurrency: "USD", rates: {} };
    expect(() => tradeProfit({ ...base, units: 0, open: 1, close: 1 })).toThrow(RangeError);
    expect(() => tradeProfit({ ...base, units: 1, open: 0, close: 1 })).toThrow(RangeError);
    expect(() => tradeProfit({ ...base, units: 1, open: 1, close: 0 })).toThrow(RangeError);
  });

  it("gives equal and opposite results for a buy and a sell", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        fc.double({ min: 0.5, max: 2, noNaN: true }),
        fc.double({ min: 0.5, max: 2, noNaN: true }),
        (units, open, close) => {
          const args = { pair: "EUR/USD", units, open, close, accountCurrency: "USD", rates: {} };
          const buy = tradeProfit({ ...args, direction: "buy" });
          const sell = tradeProfit({ ...args, direction: "sell" });
          expect(buy.inQuote + sell.inQuote).toBeCloseTo(0, 6);
          expect(buy.pips + sell.pips).toBeCloseTo(0, 6);
        },
      ),
    );
  });
});

describe("riskLevel", () => {
  const thresholds = { conservativeMax: 1, moderateMax: 2 };
  it.each([
    [0.5, "conservative"],
    [1, "conservative"],
    [1.5, "moderate"],
    [2, "moderate"],
    [2.01, "aggressive"],
  ] as const)("%d%% → %s", (percent, level) => {
    expect(riskLevel(percent, thresholds)).toBe(level);
  });
});

describe("riskReward — hand-computed", () => {
  it("sizes a long from prices and reports a 1:2 ratio", () => {
    // 10,000 × 2% = 200 at risk. Stop 50 pips, target 100 pips. A USD-quoted
    // pair on a USD account is 10 USD a pip per lot, so 0.4 lots.
    const r = riskReward({
      balance: 10_000,
      riskPercent: 2,
      pair: "EUR/USD",
      entry: 1.1,
      stop: 1.095,
      target: 1.11,
      accountCurrency: "USD",
      rates: {},
    });
    expect(r.side).toBe("long");
    expect(r.amountAtRisk).toBe(200);
    expect(r.stopPips).toBeCloseTo(50, 6);
    expect(r.targetPips).toBeCloseTo(100, 6);
    expect(r.ratio).toBeCloseTo(2, 6);
    expect(r.reward).toBeCloseTo(400, 6);
    expect(r.pipValuePerLot).toBeCloseTo(10, 8);
    expect(r.units).toBeCloseTo(40_000, 2);
    expect(r.targetOnWrongSide).toBe(false);
  });

  it("infers a short from a stop above the entry", () => {
    const r = riskReward({
      balance: 5000,
      riskPercent: 1,
      pair: "USD/JPY",
      entry: 150,
      stop: 150.5,
      target: 149,
      accountCurrency: "USD",
      rates: RATES,
    });
    expect(r.side).toBe("short");
    expect(r.stopPips).toBeCloseTo(50, 6);
    expect(r.ratio).toBeCloseTo(2, 6);
    // One pip per lot is 1,000 JPY, which is 6.67 USD at 150.
    expect(r.pipValuePerLot).toBeCloseTo(1000 / 150, 8);
  });

  it("gives an exact ratio for exact prices — no 1.9999… beside a 1:2 minimum", () => {
    // Regression: 1.10000 / 1.09700 / 1.10600 printed "1 : 2.00" while the
    // widget's below-minimum note fired, because the pip distances carried
    // binary floating-point noise.
    const r = riskReward({
      balance: 5000,
      riskPercent: 1,
      pair: "EUR/USD",
      entry: 1.1,
      stop: 1.097,
      target: 1.106,
      accountCurrency: "USD",
      rates: {},
    });
    expect(r.stopPips).toBe(30);
    expect(r.targetPips).toBe(60);
    expect(r.ratio).toBe(2);
    expect(r.ratio! < 2).toBe(false);
  });

  it("reports a target on the wrong side instead of a negative ratio", () => {
    const r = riskReward({
      balance: 1000,
      riskPercent: 1,
      pair: "EUR/USD",
      entry: 1.1,
      stop: 1.09,
      target: 1.05,
      accountCurrency: "USD",
      rates: {},
    });
    expect(r.targetOnWrongSide).toBe(true);
    expect(r.targetPips).toBeNull();
    expect(r.ratio).toBeNull();
    expect(r.reward).toBeNull();
  });

  it("still states the amount at risk when the size needs a rate it lacks", () => {
    const r = riskReward({
      balance: 1000,
      riskPercent: 1,
      pair: "EUR/GBP",
      entry: 0.85,
      stop: 0.84,
      target: null,
      accountCurrency: "USD",
      rates: {},
    });
    expect(r.amountAtRisk).toBe(10);
    expect(r.units).toBeNull();
    expect(r.ratio).toBeNull();
    expect(r.targetOnWrongSide).toBe(false);
  });

  it("refuses impossible inputs", () => {
    const base = {
      balance: 1000,
      riskPercent: 1,
      pair: "EUR/USD",
      entry: 1.1,
      stop: 1.09,
      target: null,
      accountCurrency: "USD",
      rates: {},
    };
    expect(() => riskReward({ ...base, balance: 0 })).toThrow(RangeError);
    expect(() => riskReward({ ...base, riskPercent: 0 })).toThrow(RangeError);
    expect(() => riskReward({ ...base, riskPercent: 100 })).toThrow(RangeError);
    expect(() => riskReward({ ...base, entry: 0 })).toThrow(RangeError);
    expect(() => riskReward({ ...base, stop: 0 })).toThrow(RangeError);
    expect(() => riskReward({ ...base, stop: 1.1 })).toThrow(RangeError);
    expect(() => riskReward({ ...base, target: -1 })).toThrow(RangeError);
  });

  it("pays ratio × risk at the target, and loses exactly the risk at the stop", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 1e6, noNaN: true }),
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 1, max: 1000 }),
        (balance, riskPercent, stopPips, targetPips) => {
          const entry = 1.2;
          const r = riskReward({
            balance,
            riskPercent,
            pair: "EUR/USD",
            entry,
            stop: entry - stopPips * 0.0001,
            target: entry + targetPips * 0.0001,
            accountCurrency: "USD",
            rates: {},
          });
          expect(r.reward!).toBeCloseTo(r.ratio! * r.amountAtRisk, 6);
          const lossAtStop = (r.units! / 100_000) * r.stopPips * r.pipValuePerLot!;
          expect(lossAtStop).toBeCloseTo(r.amountAtRisk, 4);
        },
      ),
    );
  });
});
