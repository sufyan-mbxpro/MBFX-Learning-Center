// ADR-088's maths, in tables and in properties.
//
// The properties are the point here: a correlation coefficient is a number
// nobody can eyeball, so "is it symmetric, is it 1 against itself, does it
// stay in range for ANY input" is what actually catches a wrong sign or a
// transposed index — and fast-check generates the inputs a table would not.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  correlationMatrix,
  logReturns,
  pearson,
  percentileRank,
  riskSentimentScore,
} from "./statistics.ts";

// Generators are QUANTISED to six decimals, and the reason is not cosmetic.
// An unrestricted `fc.double` reaches denormals (1e-101 and smaller), where a
// variance underflows to zero and `sqrt(varA * varB)` stops being computable
// at all — the properties below then fail on inputs no market series can
// produce. Six decimals is finer than any price or return this repo stores, so
// the domain is still generous; it just excludes a regime that is a fact about
// IEEE 754 rather than about correlation.
const quantise = (v: number) => Math.round(v * 1e6) / 1e6;
const finite = () =>
  fc.double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true }).map(quantise);
const positive = () =>
  fc.double({ min: 0.01, max: 1e5, noNaN: true, noDefaultInfinity: true }).map(quantise);

describe("logReturns", () => {
  it("is ln of each consecutive ratio", () => {
    expect(logReturns([100, 110])).toEqual([Math.log(1.1)]);
  });

  it("returns one fewer value than it was given closes", () => {
    expect(logReturns([1, 2, 3, 4])).toHaveLength(3);
  });

  it("is empty for a single close — there is no move to measure", () => {
    expect(logReturns([100])).toEqual([]);
  });

  it("skips the PAIR around a bad print, not the rest of the series", () => {
    // One zero close voids the two returns that touch it and nothing else.
    expect(logReturns([100, 0, 110, 121])).toEqual([Math.log(1.1)]);
  });

  it("sums to the log of the total ratio", () => {
    fc.assert(
      fc.property(fc.array(positive(), { minLength: 2, maxLength: 40 }), (closes) => {
        const total = logReturns(closes).reduce((a, b) => a + b, 0);
        const expected = Math.log(closes[closes.length - 1]! / closes[0]!);
        expect(total).toBeCloseTo(expected, 8);
      }),
    );
  });
});

describe("pearson — hand-computed", () => {
  it("is +1 for a perfectly increasing linear relationship", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 12);
  });

  it("is −1 for a perfectly decreasing one", () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 12);
  });

  it("matches a hand calculation on an ordinary sample", () => {
    // x = [1,2,3,4,5], y = [2,4,5,4,5]: Sxy = 6, Sxx = 10, Syy = 6,
    // r = 6 / sqrt(60) = 0.7745966692…
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])).toBeCloseTo(0.7745966692, 9);
  });

  it("is null when a sample has no variance — a flat line correlates with nothing", () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
  });

  it("is null for mismatched lengths and for fewer than two points", () => {
    expect(pearson([1, 2, 3], [1, 2])).toBeNull();
    expect(pearson([1], [1])).toBeNull();
  });
});

describe("pearson — properties (testing.md: the contract IS a property)", () => {
  it("is symmetric", () => {
    fc.assert(
      fc.property(
        fc.array(finite(), { minLength: 2, maxLength: 50 }),
        fc.array(finite(), { minLength: 2, maxLength: 50 }),
        (a, b) => {
          const n = Math.min(a.length, b.length);
          const x = a.slice(0, n);
          const y = b.slice(0, n);
          const forward = pearson(x, y);
          const backward = pearson(y, x);
          if (forward === null || backward === null) {
            expect(forward).toBe(backward);
            return;
          }
          expect(forward).toBeCloseTo(backward, 10);
        },
      ),
    );
  });

  it("self-correlates at exactly 1 wherever it reports at all", () => {
    fc.assert(
      fc.property(fc.array(finite(), { minLength: 2, maxLength: 50 }), (a) => {
        const r = pearson(a, a);
        if (r !== null) expect(r).toBeCloseTo(1, 10);
      }),
    );
  });

  it("stays inside [-1, 1] for any input", () => {
    fc.assert(
      fc.property(
        fc.array(finite(), { minLength: 2, maxLength: 50 }),
        fc.array(finite(), { minLength: 2, maxLength: 50 }),
        (a, b) => {
          const n = Math.min(a.length, b.length);
          const r = pearson(a.slice(0, n), b.slice(0, n));
          if (r !== null) {
            expect(r).toBeGreaterThanOrEqual(-1);
            expect(r).toBeLessThanOrEqual(1);
          }
        },
      ),
    );
  });

  it("is unchanged by a positive affine transform of either sample", () => {
    // Correlation measures co-movement, not scale: re-quoting a price in
    // cents must not change a single cell of the matrix.
    fc.assert(
      fc.property(
        fc.array(finite(), { minLength: 3, maxLength: 30 }),
        fc.array(finite(), { minLength: 3, maxLength: 30 }),
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        fc.double({ min: -100, max: 100, noNaN: true }),
        (a, b, scale, shift) => {
          const n = Math.min(a.length, b.length);
          const x = a.slice(0, n);
          const y = b.slice(0, n);
          const plain = pearson(x, y);
          const scaled = pearson(
            x.map((v) => v * scale + shift),
            y,
          );
          if (plain === null || scaled === null) return;
          expect(scaled).toBeCloseTo(plain, 8);
        },
      ),
    );
  });
});

describe("correlationMatrix", () => {
  const rising = { key: "a", closes: [100, 101, 102, 103, 104, 105] };
  const alsoRising = { key: "b", closes: [50, 50.5, 51, 51.5, 52, 52.5] };
  // NOT [100, 99, 98, …]: a linearly falling series has log returns that
  // shrink monotonically, exactly as a linearly rising one does, so the two
  // correlate at nearly +1 while their PRICES move opposite ways. That is
  // ADR-088 #1's whole point, and getting it wrong here first is what this
  // comment is for. A genuinely inverse series mirrors the RETURNS.
  const mirrored = rising.closes.reduce<number[]>(
    (acc, close, i) =>
      i === 0 ? [100] : [...acc, acc[i - 1]! * (rising.closes[i - 1]! / close)],
    [],
  );
  const falling = { key: "c", closes: mirrored };

  it("puts 1 on the diagonal where a series reported", () => {
    const m = correlationMatrix([rising, alsoRising], 4);
    expect(m.a!.a).toBe(1);
    expect(m.b!.b).toBe(1);
  });

  it("finds two proportionally rising series perfectly correlated", () => {
    const m = correlationMatrix([rising, alsoRising], 4);
    expect(m.a!.b).toBeCloseTo(1, 9);
  });

  it("finds a series and its return-mirror perfectly inversely correlated", () => {
    const m = correlationMatrix([rising, falling], 4);
    expect(m.a!.c).toBeCloseTo(-1, 9);
  });

  it("does NOT call a rising and a linearly falling series inversely correlated", () => {
    // The trap ADR-088 #1 names: both have monotonically shrinking log
    // returns, so their day-to-day MOVES are alike even though their prices
    // diverge. A price-level correlation would report this as strongly
    // negative and be telling the reader something untrue.
    const linearlyFalling = { key: "x", closes: [100, 99, 98, 97, 96, 95] };
    const m = correlationMatrix([rising, linearlyFalling], 4);
    expect(m.a!.x!).toBeGreaterThan(0);
  });

  it("renders — (null) for a series with too few bars, including its own diagonal", () => {
    // ADR-088 #3. The diagonal is the subtle half: printing 1.00 there would
    // be the one cell in an otherwise empty row that looked like it reported.
    const short = { key: "d", closes: [1, 2] };
    const m = correlationMatrix([rising, short], 4);
    expect(m.d!.d).toBeNull();
    expect(m.d!.a).toBeNull();
    expect(m.a!.d).toBeNull();
    expect(m.a!.a).toBe(1);
  });

  it("is symmetric across the diagonal", () => {
    const m = correlationMatrix([rising, alsoRising, falling], 4);
    for (const a of ["a", "b", "c"]) {
      for (const b of ["a", "b", "c"]) {
        const forward = m[a]![b]!;
        const backward = m[b]![a]!;
        if (forward === null || backward === null) expect(forward).toBe(backward);
        else expect(forward).toBeCloseTo(backward, 10);
      }
    }
  });

  it("refuses a window below two returns", () => {
    expect(() => correlationMatrix([rising], 1)).toThrow(RangeError);
  });
});

describe("percentileRank", () => {
  it("puts the largest value at the top and the smallest at the bottom", () => {
    expect(percentileRank(10, [1, 2, 3])).toBe(100);
    expect(percentileRank(0, [1, 2, 3])).toBe(0);
  });

  it("counts ties half, so a value equal to every other ranks at 50", () => {
    expect(percentileRank(5, [5, 5, 5, 5])).toBe(50);
  });

  it("is null for an empty sample", () => {
    expect(percentileRank(1, [])).toBeNull();
  });

  it("never leaves [0, 100]", () => {
    fc.assert(
      fc.property(finite(), fc.array(finite(), { minLength: 1, maxLength: 40 }), (v, sample) => {
        const rank = percentileRank(v, sample);
        if (rank !== null) {
          expect(rank).toBeGreaterThanOrEqual(0);
          expect(rank).toBeLessThanOrEqual(100);
        }
      }),
    );
  });
});

describe("riskSentimentScore", () => {
  const bands = { riskOffBelow: 35, riskOnAbove: 65 };
  // A series whose last move is its biggest up-move: rank near the top.
  const surging = Array.from({ length: 40 }, (_, i) => 100 + i * 0.1).concat([140]);
  // A series whose last move is its biggest down-move.
  const plunging = Array.from({ length: 40 }, (_, i) => 100 + i * 0.1).concat([60]);

  it("scores a risk-on component's surge as risk-on", () => {
    const result = riskSentimentScore(
      [{ key: "spx", closes: surging, weight: 1, direction: "risk-on" }],
      { lookback: 30, bands },
    );
    expect(result.score).not.toBeNull();
    expect(result.band).toBe("risk-on");
  });

  it("flips a risk-off component: gold surging is risk coming OFF", () => {
    const result = riskSentimentScore(
      [{ key: "xau", closes: surging, weight: 1, direction: "risk-off" }],
      { lookback: 30, bands },
    );
    expect(result.band).toBe("risk-off");
  });

  it("scores a plunging risk-on component as risk-off", () => {
    const result = riskSentimentScore(
      [{ key: "spx", closes: plunging, weight: 1, direction: "risk-on" }],
      { lookback: 30, bands },
    );
    expect(result.band).toBe("risk-off");
  });

  it("excludes a silent component and counts it, never zero-filling", () => {
    // ADR-088 #5. A zero-fill would claim the silent component was neutral,
    // which is a statement about the market; an exclusion is a statement
    // about us.
    const result = riskSentimentScore(
      [
        { key: "spx", closes: surging, weight: 1, direction: "risk-on" },
        { key: "dead", closes: [1, 2], weight: 1, direction: "risk-on" },
      ],
      { lookback: 30, bands },
    );
    expect(result.reporting).toEqual({ reported: 1, total: 2, excluded: ["dead"] });
    expect(result.contributions).toHaveLength(1);
  });

  it("returns a null score and null band when nothing reports", () => {
    const result = riskSentimentScore([{ key: "dead", closes: [1], weight: 1, direction: "risk-on" }], {
      lookback: 30,
      bands,
    });
    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.reporting.reported).toBe(0);
  });

  it("is unchanged by scaling every weight", () => {
    // A property, because the alternative — weights that must sum to 100 —
    // is a form nobody can edit one field of.
    const components = [
      { key: "spx", closes: surging, weight: 2, direction: "risk-on" as const },
      { key: "xau", closes: plunging, weight: 3, direction: "risk-off" as const },
    ];
    fc.assert(
      fc.property(fc.double({ min: 0.5, max: 50, noNaN: true }), (factor) => {
        const base = riskSentimentScore(components, { lookback: 30, bands });
        const scaled = riskSentimentScore(
          components.map((c) => ({ ...c, weight: c.weight * factor })),
          { lookback: 30, bands },
        );
        expect(scaled.score!).toBeCloseTo(base.score!, 9);
      }),
    );
  });

  it("is monotone in a component's rank", () => {
    // Raising one component's latest move can only raise the score of a
    // basket where that component is risk-on.
    const flat = Array.from({ length: 40 }, () => 100);
    const gentle = [...flat, 100.5];
    const sharp = [...flat, 120];
    const lower = riskSentimentScore(
      [{ key: "spx", closes: gentle, weight: 1, direction: "risk-on" }],
      { lookback: 30, bands },
    );
    const higher = riskSentimentScore(
      [{ key: "spx", closes: sharp, weight: 1, direction: "risk-on" }],
      { lookback: 30, bands },
    );
    expect(higher.score!).toBeGreaterThanOrEqual(lower.score!);
  });

  it("keeps the score inside [0, 100] for any basket that reports", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            closes: fc.array(positive(), { minLength: 35, maxLength: 60 }),
            weight: fc.double({ min: 0.1, max: 10, noNaN: true }),
            direction: fc.constantFrom("risk-on" as const, "risk-off" as const),
          }),
          { minLength: 1, maxLength: 6 },
        ),
        (raw) => {
          const result = riskSentimentScore(
            raw.map((c, i) => ({ ...c, key: `k${i}` })),
            { lookback: 30, bands },
          );
          if (result.score !== null) {
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
          }
        },
      ),
    );
  });

  it("refuses a lookback below two", () => {
    expect(() =>
      riskSentimentScore([{ key: "a", closes: surging, weight: 1, direction: "risk-on" }], {
        lookback: 1,
        bands,
      }),
    ).toThrow(RangeError);
  });
});
