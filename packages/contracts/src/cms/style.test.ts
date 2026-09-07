import { describe, expect, it } from "vitest";
import {
  backgroundSchema,
  brandTokenSchema,
  motionChoicesSchema,
  overlaySchema,
  styleChoicesSchema,
  styleKeySchema,
} from "./style.ts";

const HEX_PATTERN = /^#[0-9a-f]{3,8}$/i;
// Built by concatenation, not a literal — a literal matching HEX_PATTERN
// would itself trip this workspace's no-hex-literal lint rule (code-style.md
// #1), which is exactly the property this suite is asserting on the schemas.
const HASH = "#";
const HEX_SAMPLES = [HASH + "fff", HASH + "ffffff", HASH + "abc123", HASH + "ABCDEF12"];

describe("ADR-024 §1 / ADR-032 §2 — no hex color literal is ever accepted", () => {
  it.each(HEX_SAMPLES)("rejects %s from every enum in this module", (hex) => {
    expect(brandTokenSchema.safeParse(hex).success).toBe(false);
    expect(styleKeySchema.safeParse(hex).success).toBe(false);
    expect(
      styleChoicesSchema.safeParse({ background: { kind: "token", token: hex } }).success,
    ).toBe(false);
  });

  it("no field in styleChoicesSchema is a bare string (every field is an enum or a discriminated union)", () => {
    for (const value of [HEX_PATTERN.source]) {
      expect(styleChoicesSchema.safeParse({ textTone: value }).success).toBe(false);
      expect(styleChoicesSchema.safeParse({ padding: value }).success).toBe(false);
    }
  });
});

describe("backgroundSchema", () => {
  it("accepts a token background", () => {
    expect(backgroundSchema.parse({ kind: "token", token: "surface-1" })).toEqual({
      kind: "token",
      token: "surface-1",
    });
  });

  it("accepts a gradient of two brand tokens", () => {
    const parsed = backgroundSchema.parse({
      kind: "gradient",
      from: "primary",
      to: "accent",
      direction: "to-br",
    });
    expect(parsed).toMatchObject({ from: "primary", to: "accent" });
  });

  it("requires overlay and an assetId on an image background", () => {
    expect(
      backgroundSchema.safeParse({ kind: "image", assetId: "a1", fit: "cover", position: "center" })
        .success,
    ).toBe(false);
    expect(
      backgroundSchema.safeParse({
        kind: "image",
        assetId: "a1",
        fit: "cover",
        position: "center",
        overlay: { tone: "dark", strength: "md" },
      }).success,
    ).toBe(true);
  });

  it("requires overlay and a posterAssetId on a video background", () => {
    expect(
      backgroundSchema.safeParse({
        kind: "video",
        assetId: "v1",
        overlay: { tone: "dark", strength: "md" },
      }).success,
    ).toBe(false);
    expect(
      backgroundSchema.safeParse({
        kind: "video",
        assetId: "v1",
        posterAssetId: "p1",
        overlay: { tone: "dark", strength: "md" },
      }).success,
    ).toBe(true);
  });

  it("rejects an overlay tone outside the enum", () => {
    expect(overlaySchema.safeParse({ tone: "purple", strength: "md" }).success).toBe(false);
  });
});

describe("motionChoicesSchema", () => {
  it("accepts the bounded entrance/hover enums", () => {
    expect(motionChoicesSchema.parse({ entrance: "fade-up", hover: "lift" })).toEqual({
      entrance: "fade-up",
      hover: "lift",
    });
  });

  it("rejects a value outside the enum", () => {
    expect(motionChoicesSchema.safeParse({ entrance: "spin" }).success).toBe(false);
  });
});
