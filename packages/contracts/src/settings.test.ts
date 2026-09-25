// Public design system settings contracts (Phase 3 of
// changes-03-plan.md). The homepage section descriptor is the one an admin
// edits by hand as JSON, so its validation is the thing standing between a
// typo and a section that silently renders wrong.
import { describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_TIMEOUTS,
  googleVerificationToken,
  adminSessionTimeoutMs,
  dataBudgetSchema,
  HOME_SECTION_BUILT_KEYS,
  HOME_SECTION_STUB_KEYS,
  HOME_SECTION_VARIANTS,
  isBuiltHomeSectionKey,
  isKnownHomeSectionKey,
  SETTINGS_SCHEMAS,
  SETTING_GROUPS,
  SETTING_SELECT_OPTIONS,
  SETTING_WIDGETS,
  SETTING_MEGABYTE_OPTIONS,
  bytesToMegabytes,
  megabyteChoices,
  megabytesToBytes,
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
    // forex_rates has a variant vocabulary but no component: the admin
    // screen must label it, not hide it. Pinned so the relationship stays
    // deliberate rather than becoming an accident.
    //
    // learning_paths held this role until changes-11 PR 5.4 built it, and
    // popular_tools until changes-25 T9. That it keeps having to be swapped
    // out is the test working: the pairing it pins is real, so building a
    // section is supposed to show up here.
    expect(isKnownHomeSectionKey("forex_rates")).toBe(true);
    expect(isBuiltHomeSectionKey("forex_rates")).toBe(false);
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

describe("security.adminSessionTimeout (ADR-105)", () => {
  const schema = SETTINGS_SCHEMAS["security.adminSessionTimeout"];

  it("accepts every offered duration and nothing else", () => {
    for (const value of ADMIN_SESSION_TIMEOUTS) expect(schema.parse(value)).toBe(value);
    // A raw number, the shape a caller reaching for `0 means unlimited` would
    // send, is refused rather than coerced.
    expect(schema.safeParse(0).success).toBe(false);
    expect(schema.safeParse("10").success).toBe(false);
  });

  it("is in the general group, so its tag and its screen agree", () => {
    // The owner asked for it in Settings → General, and `settings:general` is
    // what the write invalidates.
    expect(SETTING_GROUPS["security.adminSessionTimeout"]).toBe("general");
  });

  it("renders as a dropdown of exactly its schema's values", () => {
    // The drift this catches: adding a duration to the schema and not to the
    // options leaves a value nothing can select; the reverse offers one the
    // action refuses.
    expect(SETTING_WIDGETS["security.adminSessionTimeout"]).toBe("select");
    expect(SETTING_SELECT_OPTIONS["security.adminSessionTimeout"]).toEqual(ADMIN_SESSION_TIMEOUTS);
    for (const option of SETTING_SELECT_OPTIONS["security.adminSessionTimeout"] ?? []) {
      expect(schema.safeParse(option).success).toBe(true);
    }
  });

  it("resolves to milliseconds, with `never` the only no-timeout answer", () => {
    expect(adminSessionTimeoutMs("2")).toBe(120_000);
    expect(adminSessionTimeoutMs("120")).toBe(7_200_000);
    expect(adminSessionTimeoutMs("never")).toBeNull();
    for (const value of ADMIN_SESSION_TIMEOUTS) {
      const ms = adminSessionTimeoutMs(value);
      if (ms !== null) expect(ms).toBeGreaterThan(0);
    }
  });
});

describe("media upload caps as megabytes (changes-46)", () => {
  const keys = [
    "media.maxBytes.image",
    "media.maxBytes.video",
    "media.maxBytes.audio",
    "media.maxBytes.document",
  ] as const;

  it.each(keys)("%s renders as a megabyte dropdown whose every size its schema accepts", (key) => {
    expect(SETTING_WIDGETS[key]).toBe("megabytes");
    const sizes = SETTING_MEGABYTE_OPTIONS[key] ?? [];
    expect(sizes.length).toBeGreaterThan(3);
    for (const mb of sizes) {
      expect(SETTINGS_SCHEMAS[key].safeParse(megabytesToBytes(mb)).success).toBe(true);
    }
  });

  it("converts in 1024 × 1024 steps, the unit the upload error message uses", () => {
    expect(megabytesToBytes(5)).toBe(5 * 1024 * 1024);
    expect(bytesToMegabytes(5 * 1024 * 1024)).toBe(5);
    expect(bytesToMegabytes(1_500_000)).toBe(1.43);
  });

  it("keeps a stored value that is not on the list, in size order", () => {
    const choices = megabyteChoices("media.maxBytes.image", 3 * 1024 * 1024);
    expect(choices.map((c) => c.megabytes)).toEqual([1, 2, 3, 5, 10, 15, 20, 25, 50]);
  });

  it("does not duplicate a stored value that IS on the list, and ignores a nonsense one", () => {
    expect(megabyteChoices("media.maxBytes.image", 5 * 1024 * 1024)).toHaveLength(8);
    expect(megabyteChoices("media.maxBytes.image", null)).toHaveLength(8);
    expect(megabyteChoices("media.maxBytes.image", 0)).toHaveLength(8);
    expect(megabyteChoices("media.maxBytes.image", 1.5)).toHaveLength(8);
  });
});

describe("seo.googleSiteVerification", () => {
  const schema = SETTINGS_SCHEMAS["seo.googleSiteVerification"];

  it("stores the code out of the whole tag Search Console hands out", () => {
    const tag = '<meta name="google-site-verification" content="aB3_x-9Yz" />';
    expect(googleVerificationToken(tag)).toBe("aB3_x-9Yz");
    expect(schema.parse(tag)).toBe("aB3_x-9Yz");
  });

  it("takes a bare code, trimmed, and still allows empty", () => {
    expect(schema.parse("  aB3_x-9Yz \n")).toBe("aB3_x-9Yz");
    expect(schema.parse("")).toBe("");
  });

  it("refuses anything that is not a code rather than printing it into <head>", () => {
    expect(schema.safeParse('"><script>alert(1)</script>').success).toBe(false);
    expect(schema.safeParse("google-site-verification: abc.html").success).toBe(false);
  });
});

describe("seo.titleTemplate", () => {
  const schema = SETTINGS_SCHEMAS["seo.titleTemplate"];

  it("needs %s, or every page would share one title", () => {
    expect(schema.safeParse("%s | %site%").success).toBe(true);
    expect(schema.safeParse("MBX Pro").success).toBe(false);
  });
});
