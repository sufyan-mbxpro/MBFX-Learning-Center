import { describe, expect, it } from "vitest";

import { termOfTheDayIndex } from "./public-content.ts";

// D29's contract, pinned. The rotation has no cron and no column behind it, so
// these properties ARE the feature — if they stop holding, "term of the day"
// silently becomes "whichever term, whenever".
describe("termOfTheDayIndex", () => {
  it("is stable within a day and identical for every visitor", () => {
    const first = termOfTheDayIndex("2026-09-08", 40);
    const second = termOfTheDayIndex("2026-09-08", 40);
    expect(first).toBe(second);
  });

  it("stays inside the list", () => {
    for (const count of [1, 2, 7, 40, 301]) {
      for (const day of ["2026-01-01", "2026-06-15", "2026-12-31"]) {
        const index = termOfTheDayIndex(day, count);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(count);
      }
    }
  });

  it("returns 0 rather than NaN for an empty glossary", () => {
    // The loader short-circuits before calling this, but a helper that returns
    // NaN on an empty list is a landmine for the next caller.
    expect(termOfTheDayIndex("2026-09-08", 0)).toBe(0);
  });

  it("SCATTERS consecutive days instead of walking the list in order", () => {
    // The reason for hashing at all. A day-number modulo would produce
    // 0,1,2,3,… — visibly a cycle, and identical every `count` days. Over a
    // month, consecutive days should rarely land on adjacent indices.
    const count = 40;
    const indices = Array.from({ length: 30 }, (_, day) =>
      termOfTheDayIndex(`2026-09-${String(day + 1).padStart(2, "0")}`, count),
    );

    const adjacent = indices.filter(
      (value, i) => i > 0 && Math.abs(value - (indices[i - 1] ?? 0)) === 1,
    ).length;
    expect(adjacent).toBeLessThan(5);

    // And it must actually move: a hash that collapsed every date to one
    // index would pass the "stable" test above while breaking the feature.
    expect(new Set(indices).size).toBeGreaterThan(15);
  });

  it("changes from one day to the next", () => {
    const a = termOfTheDayIndex("2026-09-08", 40);
    const b = termOfTheDayIndex("2026-09-09", 40);
    expect(a).not.toBe(b);
  });
});
