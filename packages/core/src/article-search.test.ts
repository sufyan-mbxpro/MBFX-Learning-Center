// The article listings' any-word search (changes-45): which words a query is
// matched by, and how a hit is ranked. The `where` these feed is covered
// against MariaDB in `articles.integration.test.ts`.
import { describe, expect, it } from "vitest";

import {
  MAX_ARTICLE_SEARCH_TERMS,
  articleSearchScore,
  articleSearchTerms,
} from "./article-search.ts";

describe("articleSearchTerms", () => {
  it("splits a phrase into words, so the words need not be adjacent", () => {
    expect(articleSearchTerms("gold dollar")).toEqual(["gold", "dollar"]);
  });

  it("drops one-character words always, and two-character words beside a longer one", () => {
    expect(articleSearchTerms("what is a pip")).toEqual(["what", "pip"]);
    expect(articleSearchTerms("x")).toEqual([]);
  });

  it("keeps two-character words when they are all the query has", () => {
    expect(articleSearchTerms("FX a")).toEqual(["fx"]);
  });

  it("case-folds and de-duplicates", () => {
    expect(articleSearchTerms("Gold GOLD gold")).toEqual(["gold"]);
  });

  it("caps the number of terms", () => {
    const query = "alpha bravo charlie delta echo foxtrot golf hotel india juliet";
    expect(articleSearchTerms(query)).toHaveLength(MAX_ARTICLE_SEARCH_TERMS);
  });

  it("turns LIKE wildcards and the escape character into separators", () => {
    expect(articleSearchTerms("%")).toEqual([]);
    expect(articleSearchTerms("gold%dollar")).toEqual(["gold", "dollar"]);
    expect(articleSearchTerms("a_b \\\\")).toEqual([]);
  });

  it("splits on whitespace only, so a pair stays one term", () => {
    expect(articleSearchTerms("EUR/USD outlook")).toEqual(["eur/usd", "outlook"]);
  });

  it("is empty for a blank query", () => {
    expect(articleSearchTerms("   ")).toEqual([]);
  });
});

describe("articleSearchScore", () => {
  const terms = articleSearchTerms("gold dollar");

  it("is zero when nothing matches", () => {
    expect(articleSearchScore("gold dollar", terms, "Yen slips", "Carry trade")).toBe(0);
  });

  it("ranks an article matching more of the words above one matching fewer", () => {
    const both = articleSearchScore("gold dollar", terms, "Gold rises as the dollar slips", null);
    const one = articleSearchScore("gold dollar", terms, "Gold rises", null);
    expect(both).toBeGreaterThan(one);
  });

  it("ranks a word in the title above the same word in the excerpt", () => {
    expect(articleSearchScore("gold", ["gold"], "Gold rises", null)).toBeGreaterThan(
      articleSearchScore("gold", ["gold"], "Metals", "Gold rises"),
    );
  });

  it("ranks the whole phrase above the same words apart", () => {
    const exact = articleSearchScore("gold dollar", terms, "The gold dollar trade", null);
    const apart = articleSearchScore("gold dollar", terms, "Dollar weakens, gold firms", null);
    expect(exact).toBeGreaterThan(apart);
  });
});
