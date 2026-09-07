import { describe, expect, it } from "vitest";
import { EMPTY_LAYOUT, layoutTreeSchema, storedNodeSchema } from "./layout.ts";

describe("storedNodeSchema — the ADR-032 §1 envelope", () => {
  it("accepts a minimal node and defaults hidden/children", () => {
    const parsed = storedNodeSchema.parse({ type: "heading", version: 1, id: "n1", props: {} });
    expect(parsed.hidden).toBe(false);
    expect(parsed.children).toEqual([]);
  });

  it("accepts every envelope field", () => {
    const parsed = storedNodeSchema.parse({
      type: "section",
      version: 1,
      id: "n1",
      props: {},
      label: "Hero section",
      hidden: true,
      anchor: "hero",
      style: { presetId: "hero-dark", overrides: { padding: "lg" } },
      motion: { entrance: "fade-up" },
      visibility: "PREMIUM",
      requiresFeature: "calculators",
      responsive: { hiddenOn: ["mobile"] },
      translations: { es: { title: "Hola" } },
      children: [{ type: "heading", version: 1, id: "n2", props: {} }],
    });
    expect(parsed.label).toBe("Hero section");
    expect(parsed.visibility).toBe("PREMIUM");
    expect(parsed.children).toHaveLength(1);
    expect(parsed.children[0]?.type).toBe("heading");
  });

  it("rejects a missing type/version/id", () => {
    expect(storedNodeSchema.safeParse({ props: {} }).success).toBe(false);
  });

  it("recurses arbitrarily deep", () => {
    const deep = {
      type: "a",
      version: 1,
      id: "1",
      props: {},
      children: [
        {
          type: "b",
          version: 1,
          id: "2",
          props: {},
          children: [{ type: "c", version: 1, id: "3", props: {} }],
        },
      ],
    };
    const parsed = storedNodeSchema.parse(deep);
    expect(parsed.children[0]?.children[0]?.type).toBe("c");
  });
});

describe("layoutTreeSchema", () => {
  it("round-trips the empty layout", () => {
    expect(layoutTreeSchema.parse(EMPTY_LAYOUT)).toEqual(EMPTY_LAYOUT);
  });

  it("rejects a version other than 1", () => {
    expect(layoutTreeSchema.safeParse({ version: 2, nodes: [] }).success).toBe(false);
  });

  it("validates every node in the tree", () => {
    expect(layoutTreeSchema.safeParse({ version: 1, nodes: [{ type: "x" }] }).success).toBe(false);
  });
});
