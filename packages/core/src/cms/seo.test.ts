// Pure unit test — no Testcontainers. `buildPageSeo` is tree-walking logic
// with no DB access, same shape as paths.test.ts/gates.ts's checks.
import { describe, expect, it } from "vitest";
import type { LayoutTree, StoredNode } from "@repo/contracts";
import { buildPageSeo, type PageSeo } from "./seo.ts";
import type { PublicPageRow } from "./public-pages.ts";

function node(partial: Partial<StoredNode> & Pick<StoredNode, "type" | "id">): StoredNode {
  return {
    version: 1,
    props: {},
    hidden: false,
    children: [],
    ...partial,
  };
}

function layout(nodes: StoredNode[]): LayoutTree {
  return { version: 1, nodes };
}

function page(overrides: Partial<PublicPageRow>): PublicPageRow {
  return {
    id: "page-1",
    kind: "STATIC",
    title: "Fallback Title",
    seoTitle: null,
    seoDescription: null,
    ogImageId: null,
    canonicalUrl: null,
    robots: null,
    includeInSitemap: true,
    schemaType: null,
    layout: layout([]),
    ...overrides,
  };
}

describe("buildPageSeo", () => {
  it("prefers explicit seoTitle/seoDescription over any content suggestion", () => {
    const p = page({
      seoTitle: "Explicit Title",
      seoDescription: "Explicit description.",
      layout: layout([
        node({ type: "heading", id: "h1", props: { text: "Heading text" } }),
        node({ type: "paragraph", id: "p1", props: { text: "Paragraph text" } }),
      ]),
    });
    const seo = buildPageSeo(p, "en");
    expect(seo.title).toBe("Explicit Title");
    expect(seo.description).toBe("Explicit description.");
  });

  it("suggests title/description from the first heading and paragraph when explicit fields are blank", () => {
    const p = page({
      layout: layout([
        node({
          type: "section",
          id: "s1",
          children: [
            node({ type: "heading", id: "h1", props: { text: "Suggested Heading" } }),
            node({ type: "paragraph", id: "p1", props: { text: "Suggested paragraph body." } }),
          ],
        }),
      ]),
    });
    const seo = buildPageSeo(p, "en");
    expect(seo.title).toBe("Suggested Heading");
    expect(seo.description).toBe("Suggested paragraph body.");
  });

  it("falls back to the page title when no heading exists anywhere in the tree", () => {
    const p = page({ title: "Untitled Page", layout: layout([]) });
    const seo = buildPageSeo(p, "en");
    expect(seo.title).toBe("Untitled Page");
    expect(seo.description).toBeNull();
  });

  it("skips a hidden heading and falls through to the next visible one", () => {
    const p = page({
      layout: layout([
        node({ type: "heading", id: "h1", hidden: true, props: { text: "Hidden" } }),
        node({ type: "heading", id: "h2", props: { text: "Visible Heading" } }),
      ]),
    });
    expect(buildPageSeo(p, "en").title).toBe("Visible Heading");
  });

  it("resolves a locale translation over the base-locale prop, matching the renderer's own merge order", () => {
    const p = page({
      layout: layout([
        node({
          type: "heading",
          id: "h1",
          props: { text: "English Heading" },
          translations: { es: { text: "Encabezado en Español" } },
        }),
      ]),
    });
    expect(buildPageSeo(p, "es").title).toBe("Encabezado en Español");
    expect(buildPageSeo(p, "en").title).toBe("English Heading");
  });

  it("suggests the first non-empty image asset id when no explicit ogImageId is set", () => {
    const p = page({
      layout: layout([
        node({ type: "image", id: "img1", props: { assetId: "" } }),
        node({ type: "image", id: "img2", props: { assetId: "asset-2" } }),
      ]),
    });
    expect(buildPageSeo(p, "en").ogImageId).toBe("asset-2");
  });

  it("prefers an explicit ogImageId over any suggested one", () => {
    const p = page({
      ogImageId: "asset-explicit",
      layout: layout([node({ type: "image", id: "img1", props: { assetId: "asset-suggested" } })]),
    });
    expect(buildPageSeo(p, "en").ogImageId).toBe("asset-explicit");
  });

  it("truncates a long suggested description at a word boundary", () => {
    const longText = "word ".repeat(50).trim();
    const p = page({
      layout: layout([node({ type: "paragraph", id: "p1", props: { text: longText } })]),
    });
    const seo = buildPageSeo(p, "en");
    expect(seo.description).not.toBeNull();
    expect(seo.description!.length).toBeLessThanOrEqual(161);
    expect(seo.description!.endsWith("…")).toBe(true);
  });

  it("defaults schemaType to WebPage when unset", () => {
    const seo: PageSeo = buildPageSeo(page({ schemaType: null }), "en");
    expect(seo.schemaType).toBe("WebPage");
  });

  it("passes through an explicit schemaType, canonicalUrl and robots untouched", () => {
    const p = page({
      schemaType: "AboutPage",
      canonicalUrl: "https://example.com/about",
      robots: "noindex,nofollow",
    });
    const seo = buildPageSeo(p, "en");
    expect(seo.schemaType).toBe("AboutPage");
    expect(seo.canonicalUrl).toBe("https://example.com/about");
    expect(seo.robots).toBe("noindex,nofollow");
  });
});
