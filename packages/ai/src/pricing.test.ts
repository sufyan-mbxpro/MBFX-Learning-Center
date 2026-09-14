// `pricing.ts` is the only file that computes a dollar figure, so it holds the
// 90% pure-logic floor and gets a property test: a wrong cost figure is a wrong
// invoice, and the failure is silent.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeCostUsd, estimateCostUsd, formatUsd, type ModelPrices } from "./pricing.ts";

const OPUS: ModelPrices = {
  inputPricePerMTok: 5,
  outputPricePerMTok: 25,
  cachedInputPricePerMTok: 0.5,
};

describe("computeCostUsd", () => {
  it("prices each leg at its own rate", () => {
    // 1M in at $5, 1M out at $25, 1M cached at $0.50.
    expect(
      computeCostUsd(
        { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedInputTokens: 1_000_000 },
        OPUS,
      ),
    ).toBe(30.5);
  });

  it("prices cached input AS INPUT when the provider does not report a rate", () => {
    // `null` means "we do not know", and the honest answer is the full input
    // rate. Zero would quietly make the cheapest tokens free, which is the one
    // direction a cost estimate must not be wrong in.
    const noCacheRate: ModelPrices = { ...OPUS, cachedInputPricePerMTok: null };
    expect(
      computeCostUsd(
        { inputTokens: 0, outputTokens: 0, cachedInputTokens: 1_000_000 },
        noCacheRate,
      ),
    ).toBe(5);
  });

  it("rounds to the column's six decimal places", () => {
    const cost = computeCostUsd({ inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 }, OPUS);
    expect(cost).toBe(0.00003);
    expect(String(cost).replace(/^0\.0*/, "").length).toBeLessThanOrEqual(6);
  });

  it("returns 0 for a call that used nothing", () => {
    expect(computeCostUsd({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 }, OPUS)).toBe(0);
  });

  it("never returns a credit for a provider reporting nonsense", () => {
    // A negative token count is a provider bug, not a refund.
    expect(
      computeCostUsd({ inputTokens: -1000, outputTokens: -1000, cachedInputTokens: -1 }, OPUS),
    ).toBe(0);
  });

  it("is monotonic in every token count and never negative", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 5_000_000 }),
        fc.nat({ max: 5_000_000 }),
        fc.nat({ max: 5_000_000 }),
        fc.nat({ max: 1000 }),
        (input, output, cached, extra) => {
          const base = computeCostUsd(
            { inputTokens: input, outputTokens: output, cachedInputTokens: cached },
            OPUS,
          );
          const more = computeCostUsd(
            { inputTokens: input + extra, outputTokens: output, cachedInputTokens: cached },
            OPUS,
          );
          return base >= 0 && more >= base;
        },
      ),
    );
  });
});

describe("estimateCostUsd — the pre-flight worst case", () => {
  it("prices the full output ceiling, not a likely length", () => {
    // ADR-100 #1: a budget check that under-estimates is not a budget. This is
    // also why the last few dollars of a period are unusable, which the limits
    // screen shows as "available to spend" rather than leaving as a surprise.
    const estimate = estimateCostUsd({ inputTokens: 1000, maxOutputTokens: 700 }, OPUS);
    const actual = computeCostUsd(
      { inputTokens: 1000, outputTokens: 200, cachedInputTokens: 0 },
      OPUS,
    );
    expect(estimate).toBeGreaterThan(actual);
  });

  it("counts no cached input — a first call has no cache to read", () => {
    expect(estimateCostUsd({ inputTokens: 0, maxOutputTokens: 1_000_000 }, OPUS)).toBe(25);
  });
});

describe("formatUsd", () => {
  it("shows four decimals below a cent, so a per-call cost is not 'free'", () => {
    expect(formatUsd(0.0034)).toBe("$0.0034");
  });

  it("shows two decimals at or above a cent", () => {
    expect(formatUsd(12.3456)).toBe("$12.35");
  });

  it("shows $0.00 for nothing at all", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(Number.NaN)).toBe("$0.00");
  });
});
