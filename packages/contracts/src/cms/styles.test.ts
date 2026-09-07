import { describe, expect, it } from "vitest";
import {
  createStylePresetSchema,
  stylePresetConfigSchema,
  stylePresetKeySchema,
} from "./styles.ts";

const HASH = "#";

describe("stylePresetKeySchema", () => {
  it("accepts a lower-case, hyphenated key", () => {
    expect(stylePresetKeySchema.parse("hero-dark")).toBe("hero-dark");
  });

  it("rejects upper-case or spaces", () => {
    expect(stylePresetKeySchema.safeParse("Hero Dark").success).toBe(false);
  });
});

describe("stylePresetConfigSchema — ADR-033 §2, token-only", () => {
  it("accepts style + motion together", () => {
    const parsed = stylePresetConfigSchema.parse({
      style: { background: { kind: "token", token: "surface-1" }, padding: "lg" },
      motion: { entrance: "fade-up", hover: "lift" },
    });
    expect(parsed.style?.padding).toBe("lg");
    expect(parsed.motion?.hover).toBe("lift");
  });

  it("accepts an empty config (both optional)", () => {
    expect(stylePresetConfigSchema.parse({})).toEqual({});
  });

  it("rejects a hex literal anywhere in the config — no field is a bare string", () => {
    const hex = HASH + "fff";
    expect(
      stylePresetConfigSchema.safeParse({ style: { background: { kind: "token", token: hex } } })
        .success,
    ).toBe(false);
  });
});

describe("createStylePresetSchema", () => {
  it("accepts a full valid preset", () => {
    const parsed = createStylePresetSchema.parse({
      key: "card-lift",
      name: "Card — lift on hover",
      scope: "any",
      config: { motion: { hover: "lift" } },
    });
    expect(parsed.key).toBe("card-lift");
  });

  it("defaults scope to 'any'", () => {
    const parsed = createStylePresetSchema.parse({
      key: "x",
      name: "X",
      config: {},
    });
    expect(parsed.scope).toBe("any");
  });
});
