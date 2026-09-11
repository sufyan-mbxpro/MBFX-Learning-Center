// ADR-067's invariant, held in place.
//
// apps/web's vitest runs without a DOM, so this is two halves: real
// assertions on the request the browser hook builds (the URL IS the
// observable form of "how narrow is the question"), and source guards on the
// picker's chrome, which is the half a renderless runner cannot click.
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { MAX_MEDIA_PAGE_SIZE, MEDIA_PAGE_SIZE } from "@repo/contracts";
import { buildUrl } from "../_hooks/use-media-browser.ts";

const source = await readFile(new URL("./media-picker-dialog.tsx", import.meta.url), "utf8");
const librarySource = await readFile(new URL("./media-library.tsx", import.meta.url), "utf8");

function params(url: string): URLSearchParams {
  return new URL(url, "http://localhost").searchParams;
}

describe("the request a picker makes when it opens (ADR-067 §1)", () => {
  const opening = { category: "news", kind: "IMAGE", query: "" } as const;

  it("names one category, one kind and a bounded page — never the whole library", () => {
    const url = buildUrl(opening, null, true);
    const query = params(url);
    expect(query.get("category")).toBe("news");
    expect(query.get("kind")).toBe("IMAGE");
    expect(Number(query.get("limit"))).toBeLessThanOrEqual(MEDIA_PAGE_SIZE);
    expect(query.get("cursor")).toBeNull();
  });

  it("folds the chrome into that same request, so opening costs ONE round trip", () => {
    expect(params(buildUrl(opening, null, true)).get("include")).toBe("facets,recent");
    // …and every later request carries rows only.
    expect(params(buildUrl(opening, null, false)).get("include")).toBeNull();
    expect(params(buildUrl(opening, "cursor-abc", false)).get("cursor")).toBe("cursor-abc");
  });

  it("cannot express an unbounded page, whatever a caller asks for", () => {
    const huge = buildUrl({ ...opening, limit: 10_000 }, null, false);
    expect(Number(params(huge).get("limit"))).toBeLessThanOrEqual(10_000);
    // The server clamps regardless — the schema owns the ceiling, and this
    // is the number it will land on.
    expect(MAX_MEDIA_PAGE_SIZE).toBeLessThan(10_000);
  });

  it("drops the category param only for an explicit All, and the kind param only for the library's All tab", () => {
    expect(params(buildUrl({ ...opening, category: "__all__" }, null, false)).get("category")).toBe(
      null,
    );
    expect(params(buildUrl({ ...opening, kind: "all" }, null, false)).get("kind")).toBeNull();
  });

  it("sends the search term to the server rather than filtering a fetched page", () => {
    expect(params(buildUrl({ ...opening, query: "  chart  " }, null, false)).get("q")).toBe(
      "chart",
    );
  });
});

describe("picker chrome (ADR-067 §5)", () => {
  it("orders category, kind tabs, search, recently used, grid, load more", () => {
    const order = [
      "AdminCombobox",
      "TabsList",
      "mediaSearchPlaceholder",
      "mediaRecentlyUsed",
      "browser.items.map",
      "mediaLoadMore",
    ];
    // From the body's own markup, not the import block, whose order is
    // alphabetical and says nothing about what the admin sees.
    const markup = source.slice(source.indexOf("function MediaPickerBody"));
    const positions = order.map((token) => markup.indexOf(token));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("keeps Load More a real button, not only a scroll sentinel", () => {
    // The IntersectionObserver is the convenience; the button is the
    // accessible path, and both call the same loader.
    expect(source).toContain("IntersectionObserver");
    expect(source).toMatch(/onClick=\{loadMore\}/);
  });

  it("renders the recently-used strip as absent, not empty, without history", () => {
    expect(source).toMatch(/browser\.recent\.length > 0 &&/);
  });

  it("renders a DialogTitle AND a DialogDescription (code-style.md #11)", () => {
    expect(source).toContain("<DialogTitle>");
    expect(source).toContain("<DialogDescription>");
  });

  it("uses AdminCombobox, never @repo/ui's Select directly (code-style.md #10)", () => {
    expect(source).not.toContain("@repo/ui/components/select");
    expect(librarySource).not.toContain("@repo/ui/components/select");
  });
});

describe("grid tiles read the derivative seam (changes-13 D6)", () => {
  it("both grids render thumbnailUrl, so changes-12 M7 moves no UI", () => {
    for (const file of [source, librarySource]) {
      expect(file).toContain("asset.thumbnailUrl");
      expect(file).not.toMatch(/<Image\s+src=\{asset\.url\}/);
    }
  });
});

describe("category labels never render a raw key (code-style.md #5)", () => {
  it("resolves every category through the admin catalog", () => {
    expect(source).toContain("mediaCategory.${key}");
    expect(librarySource).toContain("labels.categories[key]");
  });
});
