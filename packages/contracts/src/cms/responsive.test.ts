import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  readResponsiveValue,
  responsiveOverridesSchema,
  responsiveValueSchema,
} from "./responsive.ts";

describe("responsiveValueSchema", () => {
  const columns = responsiveValueSchema(z.enum(["1", "2", "3", "4"]));

  it("accepts a plain value (base-only shorthand)", () => {
    expect(columns.parse("2")).toBe("2");
  });

  it("accepts a base/md/lg object", () => {
    expect(columns.parse({ base: "1", md: "2", lg: "3" })).toEqual({ base: "1", md: "2", lg: "3" });
  });

  it("allows md/lg to be omitted", () => {
    expect(columns.parse({ base: "1" })).toEqual({ base: "1" });
  });

  it("rejects a value outside the inner enum at any breakpoint", () => {
    expect(columns.safeParse({ base: "1", lg: "99" }).success).toBe(false);
    expect(columns.safeParse("99").success).toBe(false);
  });
});

describe("readResponsiveValue", () => {
  const value = { base: "1", md: "2", lg: "3" };

  it("reads the exact breakpoint when declared", () => {
    expect(readResponsiveValue(value, "base")).toBe("1");
    expect(readResponsiveValue(value, "md")).toBe("2");
    expect(readResponsiveValue(value, "lg")).toBe("3");
  });

  it("falls back toward base when md/lg are undeclared", () => {
    expect(readResponsiveValue({ base: "1" }, "md")).toBe("1");
    expect(readResponsiveValue({ base: "1" }, "lg")).toBe("1");
    expect(readResponsiveValue({ base: "1", md: "2" }, "lg")).toBe("2");
  });

  it("returns a plain (non-object) value unchanged at every breakpoint", () => {
    expect(readResponsiveValue("solo", "lg")).toBe("solo");
  });
});

describe("responsiveOverridesSchema — the envelope's own responsive field (ADR-032 §3)", () => {
  it("accepts hiddenOn with up to three devices", () => {
    expect(responsiveOverridesSchema.parse({ hiddenOn: ["mobile", "tablet", "desktop"] })).toEqual({
      hiddenOn: ["mobile", "tablet", "desktop"],
    });
  });

  it("accepts an empty object (hiddenOn is optional)", () => {
    expect(responsiveOverridesSchema.parse({})).toEqual({});
  });

  it("rejects a device outside the enum", () => {
    expect(responsiveOverridesSchema.safeParse({ hiddenOn: ["watch"] }).success).toBe(false);
  });

  it("carries no other field — per-block responsive props live in the block's own props schema, not here", () => {
    const parsed = responsiveOverridesSchema.parse({ hiddenOn: ["mobile"], columns: "2" } as never);
    expect(parsed).toEqual({ hiddenOn: ["mobile"] });
  });
});
