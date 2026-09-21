import { describe, expect, it } from "vitest";

import { measureLength, textStats } from "./text-stats.ts";

describe("textStats", () => {
  it("counts nothing in an empty string", () => {
    expect(textStats("")).toEqual({
      characters: 0,
      charactersNoSpaces: 0,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      readingMinutes: 0,
    });
  });

  it("counts characters with and without spaces", () => {
    const stats = textStats("Buy low, sell high.");
    expect(stats.characters).toBe(19);
    expect(stats.charactersNoSpaces).toBe(16);
    expect(stats.words).toBe(4);
    expect(stats.sentences).toBe(1);
  });

  it("counts an emoji as ONE character, the way a person does", () => {
    expect(textStats("📈").characters).toBe(1);
    expect(textStats("👍🏽").characters).toBe(1);
  });

  it("does not count punctuation or numbers-with-separators as extra words", () => {
    expect(textStats("EUR/USD rose 0.5% — again!").words).toBe(5);
  });

  it("counts Arabic and Urdu words", () => {
    expect(textStats("سوق العملات الأجنبية").words).toBe(3);
    expect(textStats("فاریکس مارکیٹ").words).toBe(2);
  });

  it("counts sentences and paragraphs", () => {
    const stats = textStats("First point. Second point?\n\nA new paragraph!\n");
    expect(stats.sentences).toBe(3);
    expect(stats.paragraphs).toBe(2);
  });

  it("derives reading time from the same word count", () => {
    expect(textStats(Array(201).fill("word").join(" ")).readingMinutes).toBe(2);
  });
});

describe("measureLength", () => {
  it("reports how far over a character target the text is", () => {
    expect(measureLength("x".repeat(290), { unit: "characters", target: 280 })).toEqual({
      count: 290,
      target: 280,
      over: 10,
    });
  });

  it("reports zero over when the text fits", () => {
    expect(measureLength("one two three", { unit: "words", target: 5 }).over).toBe(0);
  });
});
