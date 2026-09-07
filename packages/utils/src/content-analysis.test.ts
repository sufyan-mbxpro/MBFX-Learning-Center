import { describe, expect, it } from "vitest";
import {
  analyzeContent,
  countOccurrences,
  keywordDensity,
  OPTIMAL_DENSITY,
  parseKeywords,
  SEO_THRESHOLDS,
  seoChecks,
  seoScore,
  type SeoCheckId,
} from "./content-analysis.ts";
import { countWords, htmlToText } from "./html-text.ts";

describe("htmlToText", () => {
  it("strips tags and collapses whitespace", () => {
    expect(htmlToText("<p>one</p>\n\n<p>  two  </p>")).toBe("one two");
  });

  it("drops script and style bodies entirely", () => {
    expect(htmlToText("<p>keep</p><script>var x = 1;</script><style>.a{color:red}</style>")).toBe(
      "keep",
    );
  });

  it("decodes named entities to their character", () => {
    expect(htmlToText("<p>Tom &amp; Jerry &mdash; &quot;hi&quot;</p>")).toBe('Tom & Jerry — "hi"');
  });

  it("decodes numeric entities, decimal and hex", () => {
    expect(htmlToText("&#65;&#x42;")).toBe("AB");
  });

  it("treats nbsp as whitespace rather than gluing words together", () => {
    expect(countWords(htmlToText("a&nbsp;b"))).toBe(2);
  });

  it("replaces an unrecognized entity with a space instead of leaking markup", () => {
    expect(htmlToText("a&notarealentity;b")).toBe("a b");
  });

  it("replaces an out-of-range numeric entity with a space rather than throwing", () => {
    // Above the Unicode maximum, and a lone surrogate — both would make
    // String.fromCodePoint throw if they reached it.
    expect(htmlToText("a&#1114112;b")).toBe("a b");
    expect(htmlToText("a&#xFFFFFF;b")).toBe("a b");
  });

  it("replaces a malformed numeric entity with a space", () => {
    expect(htmlToText("a&#;b")).toBe("a b");
    expect(htmlToText("a&#xZZ;b")).toBe("a b");
  });

  it("returns an empty string for markup with no text", () => {
    expect(htmlToText("<p></p><hr /><br>")).toBe("");
  });
});

describe("analyzeContent", () => {
  it("returns zeroes for empty and tag-only content", () => {
    expect(analyzeContent("")).toEqual({ words: 0, characters: 0, readingMinutes: 0 });
    expect(analyzeContent("<p></p>")).toEqual({ words: 0, characters: 0, readingMinutes: 0 });
  });

  it("counts visible words and characters, not markup", () => {
    // "one two three" → 13 characters, 3 words.
    expect(analyzeContent("<p><strong>one</strong> two <em>three</em></p>")).toEqual({
      words: 3,
      characters: 13,
      readingMinutes: 1,
    });
  });

  it("keeps reading time consistent with its OWN word count", () => {
    const html = `<p>${"word ".repeat(400)}</p>`;
    const stats = analyzeContent(html);
    expect(stats.words).toBe(400);
    expect(stats.readingMinutes).toBe(2); // 400 / 200 wpm
  });

  it("rounds a partial minute up", () => {
    expect(analyzeContent(`<p>${"w ".repeat(201)}</p>`).readingMinutes).toBe(2);
  });
});

describe("parseKeywords", () => {
  it("returns an empty list for null, undefined and blank input", () => {
    expect(parseKeywords(null)).toEqual([]);
    expect(parseKeywords(undefined)).toEqual([]);
    expect(parseKeywords("   ")).toEqual([]);
    expect(parseKeywords(",,,")).toEqual([]);
  });

  it("trims, drops empties and normalizes internal whitespace", () => {
    expect(parseKeywords(" risk  management , forex ,, ")).toEqual(["risk management", "forex"]);
  });

  it("de-duplicates case-insensitively, keeping the first spelling", () => {
    expect(parseKeywords("Forex, forex, FOREX, gold")).toEqual(["Forex", "gold"]);
  });
});

describe("countOccurrences", () => {
  it("counts case-insensitively", () => {
    expect(countOccurrences("Risk risk RISK", "risk")).toBe(3);
  });

  it("requires word boundaries — no matches inside a longer word", () => {
    expect(countOccurrences("risky business", "risk")).toBe(0);
    expect(countOccurrences("a risk, and risk.", "risk")).toBe(2);
  });

  it("matches multi-word phrases across variable whitespace", () => {
    expect(countOccurrences("risk    management is risk management", "risk management")).toBe(2);
  });

  it("does not match inside a longer word in a non-Latin script", () => {
    // The ASCII \b would have matched here; Unicode lookarounds must not.
    expect(countOccurrences("مخاطرة", "مخاطر")).toBe(0);
    expect(countOccurrences("إدارة مخاطر التداول", "مخاطر")).toBe(1);
  });

  it("treats regex metacharacters in a keyword as literals", () => {
    expect(countOccurrences("what is c++ anyway", "c++")).toBe(1);
    expect(countOccurrences("nothing here", "a(b")).toBe(0);
  });

  it("returns 0 for an empty or whitespace-only phrase", () => {
    expect(countOccurrences("some text", "")).toBe(0);
    expect(countOccurrences("some text", "   ")).toBe(0);
  });
});

describe("keywordDensity", () => {
  it("returns an empty list when no keywords are given", () => {
    expect(keywordDensity("<p>anything</p>", [])).toEqual([]);
  });

  it("computes occurrences over total words as a percentage", () => {
    // 100 words, "risk" appearing twice → 2%.
    const html = `<p>risk ${"w ".repeat(98)} risk</p>`;
    const [entry] = keywordDensity(html, ["risk"]);
    expect(entry).toMatchObject({ keyword: "risk", count: 2 });
    expect(entry?.density).toBeCloseTo(2, 5);
  });

  it("never divides by zero on empty content", () => {
    expect(keywordDensity("", ["risk"])).toEqual([{ keyword: "risk", count: 0, density: 0 }]);
    expect(keywordDensity("<p></p>", ["risk"])[0]?.density).toBe(0);
  });

  it("counts a multi-word phrase as one occurrence, not one per word", () => {
    const html = `<p>risk management ${"w ".repeat(98)}</p>`;
    // 100 words total, one phrase hit → 1%, NOT 2%.
    expect(keywordDensity(html, ["risk management"])[0]?.density).toBeCloseTo(1, 5);
  });

  it("ignores markup when measuring", () => {
    // The word "risk" inside an attribute must not count.
    const html = `<p class="risk"><a href="/risk">gold</a> risk</p>`;
    expect(keywordDensity(html, ["risk"])[0]?.count).toBe(1);
  });

  it("exposes the recommended band the UI renders", () => {
    expect(OPTIMAL_DENSITY.min).toBeLessThan(OPTIMAL_DENSITY.max);
  });
});

// One body that passes everything, mutated per case — so each test states
// exactly one reason for the flip.
const GOOD = {
  title: "Risk management for forex traders: a practical guide",
  description:
    "Risk management is what separates traders who survive from traders who do not. Learn the two percent rule, position sizing and stop losses in this guide.",
  body: `<h2>Heading</h2><p>Risk management matters.</p><img src="/a.png" alt="a"><a href="/news">more</a><p>${"word ".repeat(300)}</p>`,
  keywords: ["risk management"],
};

function idsOf(checks: { id: SeoCheckId; passed: boolean }[], passed: boolean) {
  return checks.filter((c) => c.passed === passed).map((c) => c.id);
}

describe("seoChecks", () => {
  it("passes all nine for well-formed content", () => {
    const checks = seoChecks(GOOD);
    expect(checks).toHaveLength(9);
    expect(idsOf(checks, false)).toEqual([]);
  });

  it("titleLength flips on each side of its band", () => {
    const short = seoChecks({ ...GOOD, title: "x".repeat(SEO_THRESHOLDS.titleLength.min - 1) });
    const long = seoChecks({ ...GOOD, title: "x".repeat(SEO_THRESHOLDS.titleLength.max + 1) });
    const exact = seoChecks({ ...GOOD, title: "x".repeat(SEO_THRESHOLDS.titleLength.min) });
    expect(idsOf(short, false)).toContain("titleLength");
    expect(idsOf(long, false)).toContain("titleLength");
    expect(idsOf(exact, false)).not.toContain("titleLength");
  });

  it("descriptionLength flips on each side of its band", () => {
    const short = seoChecks({
      ...GOOD,
      description: "x".repeat(SEO_THRESHOLDS.descriptionLength.min - 1),
    });
    const long = seoChecks({
      ...GOOD,
      description: "x".repeat(SEO_THRESHOLDS.descriptionLength.max + 1),
    });
    expect(idsOf(short, false)).toContain("descriptionLength");
    expect(idsOf(long, false)).toContain("descriptionLength");
  });

  it("contentLength flips at the word minimum", () => {
    const under = seoChecks({ ...GOOD, body: `<p>${"w ".repeat(299)}</p>` });
    const at = seoChecks({ ...GOOD, body: `<p>${"w ".repeat(300)}</p>` });
    expect(idsOf(under, false)).toContain("contentLength");
    expect(idsOf(at, false)).not.toContain("contentLength");
  });

  it("fails all three keyword checks when no focus keyword is set", () => {
    const checks = seoChecks({ ...GOOD, keywords: [] });
    expect(idsOf(checks, false)).toEqual(
      expect.arrayContaining([
        "focusKeywordInTitle",
        "focusKeywordInDescription",
        "focusKeywordInFirstParagraph",
      ]),
    );
  });

  it("scores against the FIRST keyword only, so a secondary one cannot lower it", () => {
    const one = seoChecks(GOOD);
    const two = seoChecks({ ...GOOD, keywords: ["risk management", "never mentioned anywhere"] });
    expect(seoScore(two)).toBe(seoScore(one));
  });

  it("focusKeywordInFirstParagraph only looks at the opening words", () => {
    const buried = `<p>${"word ".repeat(SEO_THRESHOLDS.firstParagraphWords + 50)} risk management</p>`;
    const checks = seoChecks({ ...GOOD, body: buried });
    expect(idsOf(checks, false)).toContain("focusKeywordInFirstParagraph");
  });

  it("detects subheadings h2–h6 but not h1", () => {
    expect(idsOf(seoChecks({ ...GOOD, body: "<h1>x</h1>" }), false)).toContain("hasSubheadings");
    expect(idsOf(seoChecks({ ...GOOD, body: "<h6>x</h6>" }), true)).toContain("hasSubheadings");
  });

  it("detects images", () => {
    expect(idsOf(seoChecks({ ...GOOD, body: "<p>no pictures</p>" }), false)).toContain("hasImages");
  });

  it("counts a root-relative link as internal and an absolute one as not", () => {
    const external = `<a href="https://example.com/x">out</a>`;
    const protocolRelative = `<a href="//example.com/x">out</a>`;
    const internal = `<a href="/glossary/pip">in</a>`;
    expect(idsOf(seoChecks({ ...GOOD, body: external }), false)).toContain("hasInternalLink");
    expect(idsOf(seoChecks({ ...GOOD, body: protocolRelative }), false)).toContain(
      "hasInternalLink",
    );
    expect(idsOf(seoChecks({ ...GOOD, body: internal }), true)).toContain("hasInternalLink");
  });
});

describe("seoScore", () => {
  it("is 0 for no checks and for all-failing checks", () => {
    expect(seoScore([])).toBe(0);
    expect(seoScore([{ id: "hasImages", passed: false }])).toBe(0);
  });

  it("is 100 when everything passes", () => {
    expect(seoScore(seoChecks(GOOD))).toBe(100);
  });

  it("rises monotonically as checks pass", () => {
    const all = seoChecks(GOOD);
    const scores = all.map((_, i) => seoScore(all.map((c, j) => ({ ...c, passed: j < i }))));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });

  it("rounds to a whole percent", () => {
    const checks = seoChecks({ ...GOOD, keywords: [] }); // 6 of 9 pass
    expect(Number.isInteger(seoScore(checks))).toBe(true);
    expect(seoScore(checks)).toBe(67);
  });
});
