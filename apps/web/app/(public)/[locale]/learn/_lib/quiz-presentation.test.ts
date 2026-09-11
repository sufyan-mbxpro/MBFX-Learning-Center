// The two pure derivations behind the quiz index's look (design pass
// 2026-09-09).
//
// Both are hashes over content strings, and both are load-bearing in a way
// nothing else in the shelf is: the shelf renders on the SERVER and hydrates
// on the client, so a picture or a colour that is not a pure function of the
// same input in both places is a hydration mismatch — React re-renders the
// subtree and the reader sees the card flicker. There is no type that says so
// and no lint rule that catches it, which is why the properties are asserted
// here.
//
// apps/web's vitest has no DOM, so this covers the derivations rather than the
// components. `QuizCard` itself is guarded in @repo/ui, where there is one.
import { describe, expect, it } from "vitest";

import { QUIZ_PANELS, quizCoverUrl } from "../_content/learn-media.ts";
import { categoryTone } from "./quiz-labels.ts";

const TONES = ["info", "success", "warning", "eyebrow"] as const;

describe("quizCoverUrl — deterministic artwork", () => {
  it("returns the same panel for the same slug, every time", () => {
    for (const slug of ["pips-and-lots", "candlestick-basics", "risk-of-ruin"]) {
      expect(quizCoverUrl(slug)).toBe(quizCoverUrl(slug));
    }
  });

  it("only ever returns a registered panel", () => {
    // Including for slugs nobody has written yet: the supply is code, so
    // unlike a course cover there is no null case for a caller to handle.
    for (const slug of ["", "a", "x".repeat(200), "über-quiz", "配置"]) {
      expect(QUIZ_PANELS).toContain(quizCoverUrl(slug));
    }
  });

  it("spreads a realistic shelf across the whole set", () => {
    // Not a distribution guarantee — a hash owes nobody one — but a shelf that
    // collapses onto a single panel is the failure this whole approach exists
    // to avoid, and it is the shape a broken hash produces.
    const slugs = Array.from({ length: 40 }, (_, index) => `quiz-${index}`);
    const used = new Set(slugs.map(quizCoverUrl));
    expect(used.size).toBe(QUIZ_PANELS.length);
  });
});

describe("categoryTone — one category, one colour", () => {
  it("is stable for a given category", () => {
    expect(categoryTone("risk-management")).toBe(categoryTone("risk-management"));
  });

  it("returns a tone QuizCard and the filter chips both understand", () => {
    // The chip row indexes its own active-state table by this value, so a
    // fifth tone leaking out of here renders an uncoloured chip rather than a
    // type error.
    for (const category of ["charting", "psychology", "risk-management", "crypto-basics", ""]) {
      expect(TONES).toContain(categoryTone(category));
    }
  });

  it("distinguishes categories that would otherwise sit side by side", () => {
    const tones = new Set(
      ["charting", "psychology", "risk-management", "orders"].map(categoryTone),
    );
    expect(tones.size).toBeGreaterThan(1);
  });
});
