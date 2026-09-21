// The query-shaping half of public search (changes-36): which words a query
// is matched by, and how a row that matched is ranked. Pure functions — the
// `where` clauses they feed are covered against MariaDB in
// `public-search.integration.test.ts`.
import { describe, expect, it } from "vitest";

import { scoreMatch, searchTerms } from "./public-search.ts";

describe("searchTerms", () => {
  it("splits a phrase into words, so the words need not be adjacent", () => {
    expect(searchTerms("Forex trading")).toEqual(["forex", "trading"]);
  });

  it("drops short words once the query has a longer one", () => {
    expect(searchTerms("what is a pip")).toEqual(["what", "pip"]);
  });

  it("keeps short words when they are all the query has", () => {
    expect(searchTerms("FX")).toEqual(["fx"]);
    expect(searchTerms("a")).toEqual([]);
  });

  it("splits on whitespace only, so a pair stays one term", () => {
    expect(searchTerms("EUR/USD outlook")).toEqual(["eur/usd", "outlook"]);
  });

  it("de-duplicates and caps the number of terms", () => {
    expect(searchTerms("pip pip PIP")).toEqual(["pip"]);
    expect(searchTerms("one two three four five six seven eight")).toHaveLength(6);
  });
});

describe("scoreMatch", () => {
  it("is zero for a row that contains none of the words", () => {
    expect(scoreMatch("gold", ["gold"], "Pip", "The smallest price move")).toBe(0);
  });

  it("ranks a title that IS the word above a title that mentions it", () => {
    const terms = searchTerms("what is a pip");
    const pip = scoreMatch("what is a pip", terms, "Pip", null);
    const lorem = scoreMatch("what is a pip", terms, "What is Lorem Ipsum?", null);
    expect(pip).toBeGreaterThan(lorem);
  });

  it("ranks the whole phrase above scattered words", () => {
    const terms = searchTerms("position size");
    const exact = scoreMatch("position size", terms, "Position size calculator", null);
    const scattered = scoreMatch("position size", terms, "Size your position", null);
    expect(exact).toBeGreaterThan(scattered);
  });

  it("ranks a word in the title above the same word in the summary", () => {
    const terms = ["trading"];
    expect(scoreMatch("trading", terms, "Trading plans", null)).toBeGreaterThan(
      scoreMatch("trading", terms, "Plans", "Before trading"),
    );
  });

  it("ranks a row with more of the words above one with fewer", () => {
    const terms = searchTerms("forex trading");
    expect(scoreMatch("forex trading", terms, "Trading the forex open", null)).toBeGreaterThan(
      scoreMatch("forex trading", terms, "Forex basics", null),
    );
  });
});
