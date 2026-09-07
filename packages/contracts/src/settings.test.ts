// Public design system settings contracts (Phase 3 of
// changes-03-plan.md). The homepage section descriptor is the one an admin
// edits by hand as JSON, so its validation is the thing standing between a
// typo and a section that silently renders wrong.
import { describe, expect, it } from "vitest";
import {
  dataBudgetSchema,
  HOME_SECTION_BUILT_KEYS,
  HOME_SECTION_STUB_KEYS,
  HOME_SECTION_VARIANTS,
  isBuiltHomeSectionKey,
  isKnownHomeSectionKey,
  SETTINGS_SCHEMAS,
  SETTING_GROUPS,
} from "./settings.ts";

const homeSections = SETTINGS_SCHEMAS["home.sections"];

describe("home.sections — the extended descriptor (changes-03-plan.md §5.1)", () => {
  it("still accepts the pre-existing shape, with no variant or limit", () => {
    const value = [{ key: "hero", enabled: true, order: 1 }];
    expect(homeSections.parse(value)).toEqual(value);
  });

  it("accepts a known variant and an in-range limit", () => {
    const value = [
      { key: "latest_analysis", enabled: true, order: 4, variant: "compact", limit: 6 },
    ];
    expect(homeSections.parse(value)).toEqual(value);
  });

  it("rejects a variant the section does not declare", () => {
    // "split" is a hero variant, not a news-grid one — exactly the kind of
    // copy-paste slip this registry exists to catch.
    expect(() =>
      homeSections.parse([{ key: "latest_analysis", enabled: true, order: 4, variant: "split" }]),
    ).toThrow();
  });

  it("names the allowed variants in the error, so the admin can fix it", () => {
    const result = homeSections.safeParse([
      { key: "hero", enabled: true, order: 1, variant: "diagonal" },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("centered, split, background");
    }
  });

  it("allows any variant on a key this build doesn't know yet (forward compatible)", () => {
    const value = [{ key: "some_future_section", enabled: true, order: 99, variant: "whatever" }];
    expect(homeSections.parse(value)).toEqual(value);
  });

  it("rejects an out-of-range or non-integer limit", () => {
    const base = { key: "latest_analysis", enabled: true, order: 4 };
    expect(() => homeSections.parse([{ ...base, limit: 0 }])).toThrow();
    expect(() => homeSections.parse([{ ...base, limit: 25 }])).toThrow();
    expect(() => homeSections.parse([{ ...base, limit: 2.5 }])).toThrow();
  });

  it("still rejects a malformed descriptor (mass-assignment defence intact)", () => {
    expect(() => homeSections.parse([{ key: "hero", enabled: "yes", order: 1 }])).toThrow();
    expect(() => homeSections.parse([{ enabled: true, order: 1 }])).toThrow();
  });

  it("isKnownHomeSectionKey narrows to the registry", () => {
    expect(isKnownHomeSectionKey("hero")).toBe(true);
    expect(isKnownHomeSectionKey("not_a_section")).toBe(false);
  });

  it("every registry entry declares at least one variant", () => {
    // A key with an empty list would reject EVERY variant while looking
    // like it configures something.
    for (const [key, variants] of Object.entries(HOME_SECTION_VARIANTS)) {
      expect(variants.length, `${key} declares no variants`).toBeGreaterThan(0);
    }
  });
});

describe("public design system settings keys (ADR-018)", () => {
  it("layout.pageLoader is the SiteLoader kill switch and is a boolean", () => {
    expect(SETTINGS_SCHEMAS["layout.pageLoader"].parse(false)).toBe(false);
    expect(() => SETTINGS_SCHEMAS["layout.pageLoader"].parse("off")).toThrow();
  });

  it("header.topBar round-trips its full shape and rejects a partial one", () => {
    const value = { enabled: true, phone: "+1 555 0100", promoText: "Free guides", promoUrl: "/x" };
    expect(SETTINGS_SCHEMAS["header.topBar"].parse(value)).toEqual(value);
    expect(() => SETTINGS_SCHEMAS["header.topBar"].parse({ enabled: true })).toThrow();
  });

  it("footer.appLinks accepts known platforms with path-or-URL links only", () => {
    const value = [{ platform: "ios", url: "https://example.com/app" }];
    expect(SETTINGS_SCHEMAS["footer.appLinks"].parse(value)).toEqual(value);
    expect(() =>
      SETTINGS_SCHEMAS["footer.appLinks"].parse([{ platform: "blackberry", url: "/x" }]),
    ).toThrow();
    // Same guard as every other link setting: no javascript: or bare text.
    expect(() =>
      SETTINGS_SCHEMAS["footer.appLinks"].parse([{ platform: "ios", url: "javascript:alert(1)" }]),
    ).toThrow();
  });

  it("every new key is declared in SETTING_GROUPS, so its cache tag resolves", () => {
    // architecture.md #12: the tag is `settings:{group}`. A key missing here
    // would write successfully and then never invalidate.
    for (const key of [
      "layout.pageLoader",
      "header.topBar",
      "header.showSearch",
      "footer.showPaymentBadges",
      "footer.appLinks",
    ] as const) {
      expect(SETTING_GROUPS[key]).toBe("layout");
    }
  });
});

describe("homepage section built/stub registries (Phase 9a)", () => {
  it("no key is claimed as both built and a known stub", () => {
    const both = HOME_SECTION_BUILT_KEYS.filter((k) =>
      (HOME_SECTION_STUB_KEYS as readonly string[]).includes(k),
    );
    expect(both).toEqual([]);
  });

  it("isBuiltHomeSectionKey distinguishes a real section from a placeholder", () => {
    expect(isBuiltHomeSectionKey("hero")).toBe(true);
    expect(isBuiltHomeSectionKey("market_sentiment")).toBe(false);
    expect(isBuiltHomeSectionKey("not_a_section")).toBe(false);
  });

  it("a section can declare variants without being built yet — and that is not a contradiction", () => {
    // learning_paths has a variant vocabulary but no component: the admin
    // screen must label it, not hide it. Pinned so the relationship stays
    // deliberate rather than becoming an accident.
    expect(isKnownHomeSectionKey("learning_paths")).toBe(true);
    expect(isBuiltHomeSectionKey("learning_paths")).toBe(false);
  });

  it("every section that declares variants is either built or a known stub", () => {
    // The cross-check `scripts/check-home-sections.mjs` enforces against the
    // real seed + public registry; this catches the contracts-only half at
    // unit-test speed.
    for (const key of Object.keys(HOME_SECTION_VARIANTS)) {
      const known =
        (HOME_SECTION_BUILT_KEYS as readonly string[]).includes(key) ||
        (HOME_SECTION_STUB_KEYS as readonly string[]).includes(key);
      expect(known, `${key} declares variants but is neither built nor a known stub`).toBe(true);
    }
  });
});

describe("cms.dataBudget (ADR-029 §5, PR 3.4)", () => {
  const valid = {
    page: { collections: { warn: 6, block: 10 }, items: { warn: 36, block: 72 } },
    part: { collections: { warn: 2, block: 4 }, items: { warn: 12, block: 24 } },
  };

  it("accepts the seeded default shape", () => {
    expect(dataBudgetSchema.parse(valid)).toEqual(valid);
  });

  it("rejects block < warn", () => {
    const invalid = { ...valid, page: { ...valid.page, collections: { warn: 10, block: 6 } } };
    expect(dataBudgetSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects a non-positive bound", () => {
    const invalid = { ...valid, part: { ...valid.part, items: { warn: 0, block: 5 } } };
    expect(dataBudgetSchema.safeParse(invalid).success).toBe(false);
  });

  it("is registered in SETTINGS_SCHEMAS/SETTING_GROUPS", () => {
    expect(SETTINGS_SCHEMAS["cms.dataBudget"]).toBe(dataBudgetSchema);
    expect(SETTING_GROUPS["cms.dataBudget"]).toBe("cms");
  });
});
