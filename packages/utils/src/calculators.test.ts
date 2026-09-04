// Hand-computed tables (testing.md: calculators get pure-function tables
// against values computed by hand, 90% floor).
import { describe, expect, it } from "vitest";
import { marginRequired, pipSize, pipValue, positionSize } from "./calculators.ts";

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
