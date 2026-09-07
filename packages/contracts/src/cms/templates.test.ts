import { describe, expect, it } from "vitest";
import { EMPTY_LAYOUT } from "./layout.ts";
import { createLayoutTemplateSchema, layoutTemplateKeySchema } from "./templates.ts";

describe("layoutTemplateKeySchema", () => {
  it("accepts a lower-case, hyphenated key", () => {
    expect(layoutTemplateKeySchema.parse("landing-page")).toBe("landing-page");
  });

  it("rejects upper-case", () => {
    expect(layoutTemplateKeySchema.safeParse("Landing").success).toBe(false);
  });
});

describe("createLayoutTemplateSchema", () => {
  it("accepts a PAGE template with a full layout tree", () => {
    const parsed = createLayoutTemplateSchema.parse({
      key: "landing-page",
      name: "Landing page",
      kind: "PAGE",
      pageKind: "STATIC",
      layout: EMPTY_LAYOUT,
    });
    expect(parsed.kind).toBe("PAGE");
  });

  it("accepts a BLOCK template with a single node", () => {
    const parsed = createLayoutTemplateSchema.parse({
      key: "cta-block",
      name: "CTA block",
      kind: "BLOCK",
      layout: {
        type: "button",
        version: 1,
        id: "b1",
        props: { label: "Go", link: { type: "NONE" }, variant: "default", size: "default" },
        hidden: false,
        children: [],
      },
    });
    expect(parsed.kind).toBe("BLOCK");
  });

  it("requires partKey for a PART template", () => {
    const result = createLayoutTemplateSchema.safeParse({
      key: "header-default",
      name: "Default header",
      kind: "PART",
      layout: EMPTY_LAYOUT,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a PART template with partKey", () => {
    const parsed = createLayoutTemplateSchema.parse({
      key: "header-default",
      name: "Default header",
      kind: "PART",
      partKey: "header",
      layout: EMPTY_LAYOUT,
    });
    expect(parsed.partKey).toBe("header");
  });
});
