import { describe, expect, it } from "vitest";
import { readingTimeMinutes } from "./reading-time.ts";

describe("readingTimeMinutes", () => {
  it("returns 0 for empty or tag-only content", () => {
    expect(readingTimeMinutes("")).toBe(0);
    expect(readingTimeMinutes("<p></p><hr />")).toBe(0);
  });

  it("floors at 1 minute for any non-empty text", () => {
    expect(readingTimeMinutes("<p>Just a few words here.</p>")).toBe(1);
  });

  it("counts words across tags, not markup", () => {
    const word = "word ";
    // 400 words → 2 minutes at 200 wpm; tags and entities don't count.
    const html = `<h2>${word.repeat(200)}</h2><p>${word.repeat(200)}&nbsp;</p>`;
    expect(readingTimeMinutes(html)).toBe(2);
  });

  it("rounds partial minutes up", () => {
    expect(readingTimeMinutes(`<p>${"w ".repeat(201)}</p>`)).toBe(2);
  });
});
