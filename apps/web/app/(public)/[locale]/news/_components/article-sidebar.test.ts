// Regression (changes-20 Phase 6 browser pass): the "Latest posts" row's text
// column had no `min-w-0`, so one unbreakable run in a headline widened the
// row past the sidebar card (measured: row 270px, content 332px) and the
// card's `overflow-hidden` clipped it mid-word.
//
// Read as source: these are async server components awaiting translations
// and a facets query, and the property under test is a class.
//
// It reads `facet-panels.tsx` since changes-40, which is where the row moved
// when the glossary asked for the same two panels. The regression is about the
// ROW, so the guard follows the row rather than the file it used to be in.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(process.cwd(), "app/(public)/[locale]/news/_components/facet-panels.tsx"),
  "utf8",
);

describe("ArticleSidebar latest-posts row", () => {
  it("lets the text column shrink beside the thumbnail", () => {
    expect(src).toContain('className="flex min-w-0 flex-1 flex-col gap-1"');
  });

  it("breaks an unbreakable run in a headline instead of overflowing", () => {
    expect(src).toMatch(/line-clamp-2[^"]*wrap-break-word/);
  });
});
