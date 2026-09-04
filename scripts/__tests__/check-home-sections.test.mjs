import { describe, expect, it } from "vitest";
import {
  checkHomeSections,
  parseArrayEntries,
  parseObjectKeys,
  parseSeededKeys,
} from "../check-home-sections.mjs";

// A check that only ever passes is decoration. These pin the NEGATIVE cases
// — each is a drift that actually happened or plausibly will (see
// changes-03-plan.md §12.2 for the real measured drift this was built for).

const BASE = {
  seeded: ["hero", "faq", "market_sentiment"],
  variants: ["hero", "faq"],
  built: ["hero", "faq"],
  stubs: ["market_sentiment"],
  components: ["hero", "faq"],
};

describe("check:home-sections — agreeing registries", () => {
  it("passes when all three lists reconcile", () => {
    expect(checkHomeSections(BASE)).toEqual([]);
  });

  it("does not care about declaration ORDER, only membership", () => {
    expect(
      checkHomeSections({ ...BASE, built: ["faq", "hero"], components: ["hero", "faq"] }),
    ).toEqual([]);
  });
});

describe("check:home-sections — the drifts it exists to catch", () => {
  it("a component added to the public registry but not to contracts", () => {
    const problems = checkHomeSections({ ...BASE, components: [...BASE.components, "new_one"] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("HOME_SECTION_BUILT_KEYS does not match SECTION_COMPONENTS");
  });

  it("a component removed from the public registry but still claimed by contracts", () => {
    const problems = checkHomeSections({ ...BASE, components: ["hero"] });
    expect(problems[0]).toContain("does not match");
  });

  it("a variant vocabulary for a section nobody seeds (dead configuration)", () => {
    const problems = checkHomeSections({ ...BASE, variants: [...BASE.variants, "ghost"] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('declares "ghost"');
  });

  it("a NEW seeded section nobody built and nobody acknowledged", () => {
    // The important one: without this, a new key silently joins the
    // placeholders and an admin discovers it by publishing.
    const problems = checkHomeSections({ ...BASE, seeded: [...BASE.seeded, "brand_new"] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Seeded section "brand_new"');
  });

  it("a key claimed as both built and a known stub", () => {
    const problems = checkHomeSections({ ...BASE, stubs: [...BASE.stubs, "hero"] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("BOTH built and a stub");
  });

  it("a stale stub for a section that is no longer seeded", () => {
    const problems = checkHomeSections({ ...BASE, stubs: [...BASE.stubs, "gone"] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('lists "gone"');
  });
});

describe("check:home-sections — source parsing", () => {
  it("reads section keys out of the seeded home.sections default", () => {
    const source = `
      ["layout", "home.sections",
        [
          { key: "hero", enabled: true, order: 1, variant: "split" },
          { key: "faq", enabled: true, order: 2 },
        ],
        "JSON", "Homepage sections", true],
    `;
    expect(parseSeededKeys(source)).toEqual(["hero", "faq"]);
  });

  it("reads keys from an object literal that carries a multi-line type annotation", () => {
    // SECTION_COMPONENTS is declared this way; anchoring on `NAME = {`
    // alone silently matched nothing and made the check pass vacuously.
    const source = [
      "export const SECTION_COMPONENTS: Partial<",
      "  Record<HomeSectionKey | string, ComponentType<SectionProps>>",
      "> = {",
      "  hero: Hero,",
      "  faq: Faq,",
      "};",
    ].join("\n");
    expect(parseObjectKeys(source, "SECTION_COMPONENTS")).toEqual(["hero", "faq"]);
  });

  it("reads entries from a string-array literal", () => {
    const source = `export const HOME_SECTION_BUILT_KEYS = [\n  "hero",\n  "faq",\n] as const;`;
    expect(parseArrayEntries(source, "HOME_SECTION_BUILT_KEYS")).toEqual(["hero", "faq"]);
  });

  it("returns null rather than an empty list when the source moved", () => {
    // Returning [] here would make the whole check pass vacuously — the
    // classic way a static check rots without anyone noticing.
    expect(parseObjectKeys("nothing here", "SECTION_COMPONENTS")).toBeNull();
    expect(parseArrayEntries("nothing here", "HOME_SECTION_BUILT_KEYS")).toBeNull();
    expect(parseSeededKeys("nothing here")).toBeNull();
  });
});
