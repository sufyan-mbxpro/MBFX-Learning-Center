import { describe, expect, it } from "vitest";

import { MAX_CHARS_PER_REQUEST, planBatches, splitHtml } from "./batch.ts";

describe("planBatches", () => {
  it("keeps order and groups under both limits", () => {
    const segments = ["aaaa", "bb", "cccc", "d"];
    expect(planBatches(segments, { maxSegments: 2, maxChars: 100 })).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(planBatches(segments, { maxSegments: 10, maxChars: 6 })).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("sends an oversized segment on its own rather than refusing it", () => {
    expect(planBatches(["x".repeat(50), "y"], { maxSegments: 10, maxChars: 10 })).toEqual([
      [0],
      [1],
    ]);
  });

  it("returns nothing for nothing", () => {
    expect(planBatches([])).toEqual([]);
  });

  it("uses Google's documented segment cap by default", () => {
    const segments = Array.from({ length: 130 }, () => "a");
    expect(planBatches(segments).map((b) => b.length)).toEqual([128, 2]);
  });
});

describe("splitHtml", () => {
  it("returns a short body whole, and an empty one as nothing", () => {
    expect(splitHtml("<p>hi</p>")).toEqual(["<p>hi</p>"]);
    expect(splitHtml("")).toEqual([]);
  });

  it("cuts only where every element has closed, and loses nothing", () => {
    const para = (n: number) => `<p>${"word ".repeat(n)}</p>`;
    const html = `${para(10)}<ul><li>${"x".repeat(40)}</li><li>y</li></ul>${para(10)}${para(10)}`;
    const pieces = splitHtml(html, 80);
    expect(pieces.join("")).toBe(html);
    for (const piece of pieces) {
      // Every piece is balanced: never half a list.
      expect(piece.match(/<ul>/g)?.length ?? 0).toBe(piece.match(/<\/ul>/g)?.length ?? 0);
    }
    expect(pieces.length).toBeGreaterThan(1);
  });

  it("does not count void elements as open", () => {
    const html = `<p>a<br>b<img src="x.png"></p>${"<p>z</p>".repeat(20)}`;
    const pieces = splitHtml(html, 40);
    expect(pieces.join("")).toBe(html);
    expect(pieces[0]?.startsWith("<p>a<br>b")).toBe(true);
  });

  it("keeps an element longer than the limit whole, on its own", () => {
    const big = `<p>${"z".repeat(100)}</p>`;
    const html = `<p>a</p>${big}<p>b</p>`;
    const pieces = splitHtml(html, 50);
    expect(pieces).toContain(big);
    expect(pieces.join("")).toBe(html);
  });

  it("splits off trailing text that never closes", () => {
    const html = `<p>${"a".repeat(30)}</p>${"b".repeat(40)}`;
    expect(splitHtml(html, 50)).toEqual([`<p>${"a".repeat(30)}</p>`, "b".repeat(40)]);
  });

  it("defaults to the request limit", () => {
    const html = `<p>${"a".repeat(MAX_CHARS_PER_REQUEST)}</p><p>b</p>`;
    expect(splitHtml(html)).toHaveLength(2);
  });
});
