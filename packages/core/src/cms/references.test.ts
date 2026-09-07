// Pure — collectReferences takes a raw layout value and a real @repo/blocks
// definitions registry (no database). Integration coverage for the write
// path (syncReferences) already exists wherever publishPage/pages tests
// exercise it; this file is the extraction logic on its own.
import { describe, expect, it } from "vitest";
import type { LayoutTree } from "@repo/contracts";
import { collectReferences } from "./references.ts";

function layout(nodes: LayoutTree["nodes"]): LayoutTree {
  return { version: 1, nodes };
}

describe("collectReferences — links", () => {
  it("extracts a PAGE link from a button block", () => {
    const refs = collectReferences(
      layout([
        {
          type: "button",
          id: "b1",
          version: 1,
          hidden: false,
          children: [],
          props: {
            label: "Go",
            link: { type: "PAGE", pageId: "p1" },
            variant: "default",
            size: "default",
          },
        },
      ]),
    );
    expect(refs).toContainEqual({ refType: "PAGE", refId: "p1", field: "link" });
  });

  it("extracts a MEDIA link from a cta-band's button link", () => {
    const refs = collectReferences(
      layout([
        {
          type: "cta-band",
          id: "c1",
          version: 1,
          hidden: false,
          children: [],
          props: {
            title: "Download",
            description: "",
            buttonLabel: "Get the PDF",
            buttonLink: { type: "MEDIA", assetId: "m1" },
            variant: "default",
          },
        },
      ]),
    );
    expect(refs).toContainEqual({ refType: "MEDIA", refId: "m1", field: "buttonLink" });
  });

  it("ignores ROUTE/URL/ANCHOR/NONE links — nothing to track going stale", () => {
    const refs = collectReferences(
      layout([
        {
          type: "button",
          id: "b1",
          version: 1,
          hidden: false,
          children: [],
          props: {
            label: "Go",
            link: { type: "ROUTE", routeKey: "news" },
            variant: "default",
            size: "default",
          },
        },
      ]),
    );
    expect(refs).toEqual([]);
  });
});

describe("collectReferences — media", () => {
  it("extracts an image block's assetId", () => {
    const refs = collectReferences(
      layout([
        {
          type: "image",
          id: "i1",
          version: 1,
          hidden: false,
          children: [],
          props: { assetId: "m1", alt: "", fit: "cover", aspectRatio: "auto" },
        },
      ]),
    );
    expect(refs).toContainEqual({ refType: "MEDIA", refId: "m1", field: "assetId" });
  });

  it("extracts a video block's assetId AND posterAssetId", () => {
    const refs = collectReferences(
      layout([
        {
          type: "video",
          id: "v1",
          version: 1,
          hidden: false,
          children: [],
          props: { assetId: "m1", posterAssetId: "m2", autoplay: false },
        },
      ]),
    );
    expect(refs).toContainEqual({ refType: "MEDIA", refId: "m1", field: "assetId" });
    expect(refs).toContainEqual({ refType: "MEDIA", refId: "m2", field: "posterAssetId" });
  });

  it("extracts an image-background's assetId from the envelope style", () => {
    const refs = collectReferences(
      layout([
        {
          type: "section",
          id: "s1",
          version: 1,
          hidden: false,
          children: [],
          props: { spacing: "md" },
          style: {
            overrides: {
              background: {
                kind: "image",
                assetId: "bg1",
                fit: "cover",
                position: "center",
                overlay: { tone: "dark", strength: "md" },
              },
            },
          },
        },
      ]),
    );
    expect(refs).toContainEqual({ refType: "MEDIA", refId: "bg1" });
  });
});

describe("collectReferences — widgets and style presets", () => {
  it("extracts a widget block's widgetKey", () => {
    const refs = collectReferences(
      layout([
        {
          type: "widget",
          id: "w1",
          version: 1,
          hidden: false,
          children: [],
          props: { widgetKey: "calc.pip", config: {}, configVersion: 1 },
        },
      ]),
    );
    expect(refs).toContainEqual({ refType: "WIDGET", refId: "calc.pip", field: "widgetKey" });
  });

  it("extracts a node's style.presetId", () => {
    const refs = collectReferences(
      layout([
        {
          type: "heading",
          id: "h1",
          version: 1,
          hidden: false,
          children: [],
          props: { text: "Hi", level: "2", align: "start" },
          style: { presetId: "preset-1" },
        },
      ]),
    );
    expect(refs).toContainEqual({
      refType: "STYLE_PRESET",
      refId: "preset-1",
      field: "style.presetId",
    });
  });
});

describe("collectReferences — recursion and edge cases", () => {
  it("recurses into children", () => {
    const refs = collectReferences(
      layout([
        {
          type: "section",
          id: "s1",
          version: 1,
          hidden: false,
          props: { spacing: "md" },
          children: [
            {
              type: "image",
              id: "i1",
              version: 1,
              hidden: false,
              children: [],
              props: { assetId: "deep-1", alt: "", fit: "cover", aspectRatio: "auto" },
            },
          ],
        },
      ]),
    );
    expect(refs).toContainEqual({ refType: "MEDIA", refId: "deep-1", field: "assetId" });
  });

  it("returns an empty array for a layout that fails schema validation", () => {
    expect(collectReferences({ not: "a layout" })).toEqual([]);
  });

  it("returns an empty array for an empty layout", () => {
    expect(collectReferences(layout([]))).toEqual([]);
  });
});
