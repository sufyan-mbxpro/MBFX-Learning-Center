// The quote band's daily pick (changes-28 PR 3, ADR-093).
//
// The property under test is DETERMINISM, not which quote comes out. A random
// pick would differ between the server render and any later revalidation of
// the same cached page — the "quote of the day" would become a quote of the
// request, and two readers on the same date would see different ones.
import { describe, expect, it } from "vitest";

import { HOME_QUOTES, quoteOfTheDay } from "./home-quotes.ts";

describe("quoteOfTheDay", () => {
  it("returns the same quote for every instant within one UTC day", () => {
    const start = new Date("2026-09-14T00:00:00.000Z");
    const end = new Date("2026-09-14T23:59:59.999Z");
    expect(quoteOfTheDay(start)).toBe(quoteOfTheDay(end));
  });

  it("moves on at the UTC day boundary", () => {
    const today = quoteOfTheDay(new Date("2026-09-14T23:59:59.999Z"));
    const tomorrow = quoteOfTheDay(new Date("2026-09-15T00:00:00.000Z"));
    expect(today).not.toBe(tomorrow);
  });

  it("walks the whole list before repeating", () => {
    const day = 86_400_000;
    const base = Date.UTC(2026, 8, 14);
    const seen = new Set(
      Array.from({ length: HOME_QUOTES.length }, (_, i) => quoteOfTheDay(new Date(base + i * day))),
    );
    expect(seen.size).toBe(HOME_QUOTES.length);
  });

  it("stays in range for a date before the epoch", () => {
    // `%` on a negative day number would index off the front of the array and
    // return undefined. Not reachable in production; cheap to make impossible.
    expect(quoteOfTheDay(new Date("1969-07-20T00:00:00.000Z"))).toBeDefined();
  });

  it("attributes every quote to a named person", () => {
    // A quotation is a factual claim about a human being (ADR-047 §3). An
    // entry with no author would be a saying this site had made up.
    for (const quote of HOME_QUOTES) expect(quote.author.trim().length).toBeGreaterThan(0);
  });
});
