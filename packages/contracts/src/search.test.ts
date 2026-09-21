// The public search query contract (ADR-108). This is the parse standing
// between an anonymous caller and a `LIKE` over six tables (security.md #6),
// so the bounds are the test, not the shape.
import { describe, expect, it } from "vitest";

import { publicSearchQuerySchema, SEARCH_QUERY_MAX, SEARCH_QUERY_MIN } from "./search.ts";

const valid = { q: "forex", locale: "en" };

describe("publicSearchQuerySchema", () => {
  it("accepts an ordinary query", () => {
    expect(publicSearchQuerySchema.parse(valid)).toEqual(valid);
  });

  it("trims before measuring, so whitespace is not a query", () => {
    expect(publicSearchQuerySchema.safeParse({ ...valid, q: "  " }).success).toBe(false);
    expect(publicSearchQuerySchema.parse({ ...valid, q: "  pip  " }).q).toBe("pip");
  });

  it("refuses a query below the floor", () => {
    // One character matches most of the corpus and costs a scan per table to
    // say so.
    expect(publicSearchQuerySchema.safeParse({ ...valid, q: "f" }).success).toBe(false);
    expect(publicSearchQuerySchema.safeParse({ ...valid, q: "fo" }).success).toBe(true);
    expect(SEARCH_QUERY_MIN).toBe(2);
  });

  it("refuses a query above the ceiling rather than truncating it", () => {
    // A `LIKE '%…%'` over an arbitrarily long needle is a way to spend a
    // database's time from outside. Truncating would accept the request and
    // answer a different question.
    expect(
      publicSearchQuerySchema.safeParse({ ...valid, q: "x".repeat(SEARCH_QUERY_MAX) }).success,
    ).toBe(true);
    expect(
      publicSearchQuerySchema.safeParse({ ...valid, q: "x".repeat(SEARCH_QUERY_MAX + 1) }).success,
    ).toBe(false);
  });

  it("refuses anything that is not a locale code", () => {
    // The value reaches a `where` clause, so it is a closed shape rather than
    // a free string.
    for (const locale of ["", "e", "english please", "en; DROP", "../en", "EN-us-extra-long"]) {
      expect(publicSearchQuerySchema.safeParse({ ...valid, locale }).success).toBe(false);
    }
    for (const locale of ["en", "es", "ar", "ur", "pt-BR"]) {
      expect(publicSearchQuerySchema.safeParse({ ...valid, locale }).success).toBe(true);
    }
  });

  it("refuses a missing field rather than defaulting it", () => {
    expect(publicSearchQuerySchema.safeParse({ q: "forex" }).success).toBe(false);
    expect(publicSearchQuerySchema.safeParse({ locale: "en" }).success).toBe(false);
  });
});
