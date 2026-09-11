import { describe, expect, it } from "vitest";
import { slugify } from "./slug.ts";

describe("slugify", () => {
  it("lowercases, strips accents, collapses separators", () => {
    // The assertion the function carried when it lived in @repo/core, moved
    // here with it so the move is provably behaviour-preserving.
    expect(slugify("  Pip Value — Fórmula!  ")).toBe("pip-value-formula");
  });

  it("keeps Arabic letters instead of erasing them", () => {
    // Load-bearing: `ar` and `ur` are seeded locales (ADR-007). If this
    // returned "" every Arabic row would fall back to the same literal slug
    // and collide on `@@unique([locale, slug])`.
    expect(slugify("نقطة")).toBe("نقطة");
    expect(slugify("سعر الصرف")).toBe("سعر-الصرف");
  });

  it("trims leading and trailing separators rather than leaving bare hyphens", () => {
    expect(slugify("!!! margin call !!!")).toBe("margin-call");
  });

  it("collapses a run of separators into one hyphen", () => {
    expect(slugify("stop   /   loss")).toBe("stop-loss");
  });

  it("caps at the 150-character column width", () => {
    expect(slugify("a".repeat(400))).toHaveLength(150);
  });

  it("returns an empty string when nothing survives, so callers apply their own fallback", () => {
    // `uniqueTopicSlug` and `uniqueGlossarySlug` both substitute a literal for
    // this case; the function does not guess one for them.
    expect(slugify("!!!")).toBe("");
  });
});
