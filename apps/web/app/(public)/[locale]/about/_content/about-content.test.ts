// ADR-051's two guarantees, as tests.
//
// Neither is about how the section LOOKS. They protect the two things that
// make shipping placeholder content survivable: that flipping one switch
// takes all of it away, and that no label the placeholder data names is
// missing from the catalog.
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../../packages/i18n/messages/en.json" with { type: "json" };
import { DEMO_ABOUT_FACTS } from "./about-facts.demo.ts";

/** Walks a dotted key path into the catalog, returning undefined at the first gap. */
function lookup(namespace: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      namespace,
    );
}

const about = en.about as unknown as Record<string, unknown>;

describe("ABOUT_CONTENT_MODE (ADR-051 §1)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("renders the placeholder dataset by default", async () => {
    const { ABOUT_FACTS } = await import("./about-facts.ts");
    expect(ABOUT_FACTS.awards.length).toBeGreaterThan(0);
    expect(ABOUT_FACTS.stats.length).toBeGreaterThan(0);
    expect(ABOUT_FACTS.timeline.length).toBeGreaterThan(0);
  });

  // The round trip ADR-051 §2 promises. Every gated section is driven by one
  // of these collections being empty, so this single assertion is what says
  // "setting the variable takes the whole placeholder section away" — not
  // some of it, and not a half-real page where nobody can tell which number
  // was ever checked.
  it("empties every gated collection when the mode is real, restoring ADR-047 §2", async () => {
    vi.stubEnv("ABOUT_CONTENT_MODE", "real");
    const { ABOUT_FACTS, REAL_ABOUT_FACTS } = await import("./about-facts.ts");

    expect(ABOUT_FACTS).toBe(REAL_ABOUT_FACTS);
    expect(ABOUT_FACTS.stats).toHaveLength(0);
    expect(ABOUT_FACTS.timeline).toHaveLength(0);
    expect(ABOUT_FACTS.awards).toHaveLength(0);
    expect(ABOUT_FACTS.jurisdictions).toHaveLength(0);
    expect(ABOUT_FACTS.payments).toHaveLength(0);
    expect(ABOUT_FACTS.support.channels).toHaveLength(0);
    expect(ABOUT_FACTS.foundedYear).toBeNull();
  });

  // Anything that is not exactly "real" is demo. A typo must fail SAFE toward
  // the state someone is looking at, never silently half-apply.
  it("treats an unrecognised value as demo rather than guessing", async () => {
    vi.stubEnv("ABOUT_CONTENT_MODE", "REAL");
    const { ABOUT_CONTENT_MODE } = await import("./about-content-mode.ts");
    expect(ABOUT_CONTENT_MODE).toBe("demo");
  });
});

describe("DEMO_ABOUT_FACTS label keys", () => {
  // The facts module stores catalog keys as DATA, so a renamed key is a
  // compile error only where the type is checked — this covers the other
  // half: a key that TYPE-checks because the union is derived from en.json,
  // but was never actually written into the catalog under that path.
  const keys = [
    ...DEMO_ABOUT_FACTS.stats.map((stat) => stat.labelKey),
    ...DEMO_ABOUT_FACTS.timeline.flatMap((entry) => [entry.titleKey, entry.bodyKey]),
    ...DEMO_ABOUT_FACTS.awards.map((award) => award.titleKey),
    ...DEMO_ABOUT_FACTS.jurisdictions.map((place) => place.nameKey),
  ];

  it.each(keys)("resolves about.%s to a string", (key) => {
    expect(typeof lookup(about, key)).toBe("string");
  });

  it("names no real awarding body or regulator (ADR-051 §4)", () => {
    // A placeholder that leaks may say something false about MBFX. It must
    // never say something false about somebody else, and the acronyms below
    // are the ones the reference material actually used.
    const REAL_BODIES = ["FCA", "CFTC", "NFA", "ASIC", "CySEC", "MAS", "CIRO", "CIMA", "StoneX"];
    const named = [
      ...DEMO_ABOUT_FACTS.awards.map((award) => award.issuer),
      ...DEMO_ABOUT_FACTS.jurisdictions.flatMap((place) => place.bodies),
    ];
    for (const value of named) {
      for (const body of REAL_BODIES) {
        expect(value).not.toContain(body);
      }
    }
  });
});
