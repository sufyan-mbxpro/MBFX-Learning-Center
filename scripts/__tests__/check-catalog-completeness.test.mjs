import { describe, expect, it } from "vitest";
import { findMissingKeys, flattenKeys, run } from "../check-catalog-completeness.mjs";

describe("check:catalog-completeness — flattenKeys", () => {
  it("flattens nested message objects into domain.component.purpose dotted keys", () => {
    const keys = flattenKeys({ home: { placeholder: "x" }, common: { siteName: "y" } });
    expect(keys.sort()).toEqual(["common.siteName", "home.placeholder"]);
  });
});

describe("check:catalog-completeness — findMissingKeys", () => {
  it("flags a locale catalog missing a key the default catalog has", () => {
    const result = findMissingKeys(
      { common: { siteName: "EN" }, home: { placeholder: "EN" } },
      { ar: { common: { siteName: "AR" } } },
    );
    expect(result).toEqual([{ locale: "ar", missing: ["home.placeholder"] }]);
  });

  it("reports nothing for a fully-translated non-default catalog", () => {
    const result = findMissingKeys(
      { common: { siteName: "EN" } },
      { es: { common: { siteName: "ES" } } },
    );
    expect(result).toEqual([]);
  });
});

describe("check:catalog-completeness — live workspace", () => {
  it("the real message catalogs exist and are internally consistent (exits 0 — missing keys are a warning, not a failure)", () => {
    expect(run()).toBe(0);
  });
});
