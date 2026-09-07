import { describe, expect, it } from "vitest";
import { editorFieldMetaSchema, registryKeySchema, widgetCategorySchema } from "./widgets.ts";

describe("registryKeySchema", () => {
  it("accepts a dot-namespaced lower-case key", () => {
    expect(registryKeySchema.parse("calc.pip")).toBe("calc.pip");
    expect(registryKeySchema.safeParse("market.rates-table").success).toBe(true);
  });

  it("rejects upper-case, spaces or a leading dot", () => {
    expect(registryKeySchema.safeParse("Calc.Pip").success).toBe(false);
    expect(registryKeySchema.safeParse("calc pip").success).toBe(false);
    expect(registryKeySchema.safeParse(".pip").success).toBe(false);
  });
});

describe("widgetCategorySchema", () => {
  it("accepts every ADR-030 §1 category", () => {
    for (const c of ["calculator", "market", "trading", "form", "other"]) {
      expect(widgetCategorySchema.safeParse(c).success).toBe(true);
    }
  });

  it("rejects an unlisted category", () => {
    expect(widgetCategorySchema.safeParse("misc").success).toBe(false);
  });
});

describe("editorFieldMetaSchema", () => {
  it("accepts a minimal field", () => {
    expect(
      editorFieldMetaSchema.parse({
        path: "config.pairs",
        kind: "select",
        labelKey: "widgets.calc.pairs",
      }),
    ).toMatchObject({ kind: "select" });
  });

  it("rejects an unknown field kind", () => {
    expect(
      editorFieldMetaSchema.safeParse({ path: "x", kind: "date-picker", labelKey: "x" }).success,
    ).toBe(false);
  });
});
