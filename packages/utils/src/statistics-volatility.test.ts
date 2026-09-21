// ADR-136 §3's volatility maths, in tables and in properties.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  VOLATILITY_BASELINE,
  meanRangePercent,
  priceRange,
  rangePercent,
  volatilityLevel,
  volatilityProfile,
  type RangeBar,
} from "./statistics.ts";

/** A bar whose range is exactly `percent` of a close of 100. */
const barOf = (percent: number): RangeBar => ({ high: 100 + percent, low: 100, close: 100 });

describe("rangePercent", () => {
  it("is (high − low) ÷ close × 100", () => {
    expect(rangePercent({ high: 1.1, low: 1.09, close: 1.095 })).toBeCloseTo(0.913242, 5);
    expect(rangePercent(barOf(0.75))).toBeCloseTo(0.75, 10);
  });

  it.each([
    ["a zero close", { high: 1, low: 0.5, close: 0 }],
    ["a negative close", { high: 1, low: 0.5, close: -1 }],
    ["a low above its high", { high: 1, low: 2, close: 1.5 }],
    ["a negative low", { high: 1, low: -1, close: 0.5 }],
    ["a NaN", { high: Number.NaN, low: 1, close: 1 }],
    ["an infinity", { high: Number.POSITIVE_INFINITY, low: 1, close: 1 }],
  ])("refuses %s", (_, bar) => {
    expect(rangePercent(bar)).toBeNull();
  });
});

describe("meanRangePercent", () => {
  it("averages the LAST n bars", () => {
    const bars = [barOf(9), barOf(1), barOf(2), barOf(3)];
    expect(meanRangePercent(bars, 3)).toBeCloseTo(2, 10);
    expect(meanRangePercent(bars, 1)).toBeCloseTo(3, 10);
  });

  it("says nothing below the window's own length (ADR-088 #3)", () => {
    expect(meanRangePercent([barOf(1), barOf(2)], 5)).toBeNull();
    expect(meanRangePercent([], 1)).toBeNull();
  });

  it("skips a bad print rather than voiding the window", () => {
    const bars = [barOf(1), { high: 1, low: 2, close: 1 }, barOf(3)];
    expect(meanRangePercent(bars, 2)).toBeCloseTo(2, 10);
  });

  it("refuses a window under one session", () => {
    expect(() => meanRangePercent([barOf(1)], 0)).toThrow(RangeError);
  });
});

describe("priceRange", () => {
  it("spans the lowest low to the highest high of the window", () => {
    const bars: RangeBar[] = [
      { high: 5, low: 1, close: 3 },
      { high: 1.2, low: 1.1, close: 1.15 },
      { high: 1.3, low: 1.05, close: 1.2 },
    ];
    expect(priceRange(bars, 2)).toBeCloseTo(0.25, 10);
    expect(priceRange(bars, 1)).toBeCloseTo(0.25, 10);
    expect(priceRange(bars, 4)).toBeNull();
  });

  it("refuses a window under one session", () => {
    expect(() => priceRange([barOf(1)], 0)).toThrow(RangeError);
  });
});

describe("volatilityLevel", () => {
  it.each([
    [0, "low"],
    [0.49, "low"],
    [0.5, "medium"],
    [0.99, "medium"],
    [1, "high"],
    [1.99, "high"],
    [2, "extreme"],
    [7.5, "extreme"],
  ] as const)("reads %s%% as %s", (percent, level) => {
    expect(volatilityLevel(percent)).toBe(level);
  });

  it("never goes DOWN as the range grows", () => {
    const order = ["low", "medium", "high", "extreme"];
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 50, noNaN: true }),
        fc.double({ min: 0, max: 50, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          return order.indexOf(volatilityLevel(lo)) <= order.indexOf(volatilityLevel(hi));
        },
      ),
    );
  });
});

describe("volatilityProfile", () => {
  it("reads every timeframe against ONE baseline", () => {
    // 66 sessions at 1%, then the latest session at 3%.
    const bars = [...Array.from({ length: VOLATILITY_BASELINE - 1 }, () => barOf(1)), barOf(3)];
    const profile = volatilityProfile(bars);
    const average = (65 * 1 + 3) / 66;

    expect(profile.timeframes.daily.current).toBeCloseTo(3, 10);
    expect(profile.timeframes.daily.average).toBeCloseTo(average, 10);
    expect(profile.timeframes.daily.trend).toBeCloseTo(3 - average, 10);
    expect(profile.timeframes.daily.level).toBe("extreme");

    expect(profile.timeframes.weekly.current).toBeCloseTo((4 + 3) / 5, 10);
    expect(profile.timeframes.weekly.average).toBe(profile.timeframes.daily.average);
    expect(profile.timeframes.monthly.current).toBeCloseTo((21 + 3) / 22, 10);
    expect(profile.timeframes.monthly.level).toBe("high");

    expect(profile.ranges.daily).toBeCloseTo(3, 10);
    expect(profile.ranges.monthly).toBeCloseTo(3, 10);
  });

  it("reports a short history as dashes, not as a number", () => {
    const profile = volatilityProfile([barOf(0.4), barOf(0.6), barOf(0.8)]);
    expect(profile.timeframes.daily.current).toBeCloseTo(0.8, 10);
    expect(profile.timeframes.daily.average).toBeNull();
    expect(profile.timeframes.daily.trend).toBeNull();
    expect(profile.timeframes.weekly).toEqual({
      current: null,
      average: null,
      trend: null,
      level: null,
    });
    expect(profile.ranges.weekly).toBeNull();
  });

  it("is unchanged when every price is scaled — a percentage has no units", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 500 }), { minLength: 22, maxLength: 70 }),
        fc.integer({ min: 2, max: 1000 }),
        (ranges, factor) => {
          const bars = ranges.map((r) => ({ high: 1000 + r, low: 1000, close: 1000 + r / 2 }));
          const scaled = bars.map((b) => ({
            high: b.high * factor,
            low: b.low * factor,
            close: b.close * factor,
          }));
          const a = volatilityProfile(bars).timeframes.monthly.current!;
          const b = volatilityProfile(scaled).timeframes.monthly.current!;
          return Math.abs(a - b) < 1e-9;
        },
      ),
    );
  });
});
