import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canOptimizeImage } from "./image-optimizer.ts";

describe("canOptimizeImage", () => {
  it("optimises a raster upload", () => {
    expect(canOptimizeImage("/uploads/0123456789abcdef01234567.webp")).toBe(true);
    expect(canOptimizeImage("/uploads/0123456789abcdef01234567.jpg")).toBe(true);
  });

  it("serves an SVG upload, an off-site URL and a static asset untouched", () => {
    expect(canOptimizeImage("/uploads/0123456789abcdef01234567.svg")).toBe(false);
    expect(canOptimizeImage("https://cdn.example.com/cover.jpg")).toBe(false);
    expect(canOptimizeImage("//cdn.example.com/cover.jpg")).toBe(false);
    expect(canOptimizeImage("/news/art/markets.svg")).toBe(false);
  });
});

// ADR-130: the news surfaces had `unoptimized` hard-coded, so every cover was
// sent at its full uploaded size. The guard fails if a bare one comes back.
describe("news images go through the optimizer", () => {
  const newsDir = join(import.meta.dirname, "..", "news");
  const files = [
    join(newsDir, "_components", "article-media.tsx"),
    join(newsDir, "_components", "article-sidebar.tsx"),
    join(newsDir, "[slug]", "page.tsx"),
  ];

  for (const file of files) {
    it(`${file.slice(newsDir.length + 1)} never sets a bare unoptimized`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/\bunoptimized(?!=)/);
    });
  }
});
