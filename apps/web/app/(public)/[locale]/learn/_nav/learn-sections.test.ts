// The Learn section bar's registry and its rules (ADR-065 §5).
//
// Three things are worth pinning, and all three failed silently before this
// file existed: that the bar is built PER TRACK, that its entries are real
// registered routes, and that the "which tab is current" rule survives the
// extra path segment tracks added.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isRouteKey, LEARN_TRACK_KEYS, LEARN_TRACK_SURFACES, ROUTE_PATHS } from "@repo/contracts";
import en from "@repo/i18n/messages/en.json";
import { activeSectionHref, learnSectionsFor } from "./learn-sections.ts";

const PATHS = new Set<string>(Object.values(ROUTE_PATHS));

describe("learnSectionsFor", () => {
  it("builds one section per registered SURFACE, for every registered track", () => {
    for (const track of LEARN_TRACK_KEYS) {
      const sections = learnSectionsFor(track);
      // Counted from the registry, not typed here. ADR-068 Consequences
      // records why: this file hardcoded "three" in three separate places and
      // none of them failed when a fourth surface arrived.
      expect(sections).toHaveLength(LEARN_TRACK_SURFACES.length);
      // Every entry is a REGISTERED route, not a concatenated guess — a tab
      // pointing at an unregistered path is a tab pointing at a 404.
      for (const section of sections) expect(PATHS.has(section.href)).toBe(true);
    }
  });

  it("scopes every href to its own track", () => {
    for (const track of LEARN_TRACK_KEYS) {
      for (const section of learnSectionsFor(track)) {
        expect(section.href.startsWith(`${ROUTE_PATHS.learn}/${track}`)).toBe(true);
      }
    }
  });

  it("gates each surface on the flag its route is gated on, in registry order", () => {
    const flags = learnSectionsFor("forex").map((section) => section.flag);
    // `index` is the courses surface — the registry names the ROUTE KEY, and
    // the flag behind it is `courses`. Every other surface's flag IS its
    // registry name, so the map is one special case rather than a second list.
    expect(flags).toEqual(
      LEARN_TRACK_SURFACES.map((surface) => (surface === "index" ? "courses" : surface)),
    );
  });

  it("names only catalog keys that resolve", () => {
    for (const track of LEARN_TRACK_KEYS) {
      for (const section of learnSectionsFor(track)) {
        const value = section.labelKey
          .split(".")
          .reduce<unknown>(
            (node, part) =>
              node && typeof node === "object"
                ? (node as Record<string, unknown>)[part]
                : undefined,
            en.learn,
          );
        expect(value, section.labelKey).toBeTypeOf("string");
      }
    }
  });
});

describe("activeSectionHref", () => {
  const hrefs = learnSectionsFor("forex").map((section) => section.href);

  it("marks Courses current on the track index", () => {
    expect(activeSectionHref("/learn/forex", hrefs)).toBe("/learn/forex");
  });

  it("marks Courses current on a course and on a lesson under it", () => {
    expect(activeSectionHref("/learn/forex/price-action", hrefs)).toBe("/learn/forex");
    expect(activeSectionHref("/learn/forex/price-action/pips", hrefs)).toBe("/learn/forex");
  });

  // The bug longest-prefix exists to prevent: /learn/forex is a prefix of
  // /learn/forex/quizzes, so a plain rule lights up Courses on a quiz page.
  it("marks Quizzes current on the quiz index and on a quiz", () => {
    expect(activeSectionHref("/learn/forex/quizzes", hrefs)).toBe("/learn/forex/quizzes");
    expect(activeSectionHref("/learn/forex/quizzes/basics", hrefs)).toBe("/learn/forex/quizzes");
  });

  it("marks Glossary current on the track glossary", () => {
    expect(activeSectionHref("/learn/forex/glossary", hrefs)).toBe("/learn/forex/glossary");
  });

  it("marks nothing current outside the track", () => {
    expect(activeSectionHref("/learn/crypto", hrefs)).toBeUndefined();
    expect(activeSectionHref("/learn", hrefs)).toBeUndefined();
    expect(activeSectionHref("/glossary", hrefs)).toBeUndefined();
  });
});

// A source-level guard rather than a render test: apps/web's vitest runs in
// node with no DOM, and what matters here is a CSS contract, not behaviour.
// `top-16` was the tempting wrong answer — correct for exactly one header
// configuration and silently wrong the moment the announcement bar is on.
describe("the section bar is pinned below the header (ADR-065 §5)", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../_components/learn-section-nav.tsx", import.meta.url)),
    "utf8",
  );

  it("sticks, and offsets on the measured header height", () => {
    expect(source).toContain("sticky top-(--header-offset)");
  });

  it("sits below the header's stacking level, never above it", () => {
    // The header is z-40; a bar that outranked it would paint over an open
    // nav panel.
    expect(source).toContain("z-30");
    expect(source).not.toContain("z-50");
  });
});

describe("the header publishes the offset it asks for", () => {
  const shell = readFileSync(
    fileURLToPath(new URL("../../_components/sticky-header-shell.tsx", import.meta.url)),
    "utf8",
  );

  it("measures the real element rather than assuming a height", () => {
    expect(shell).toContain("ResizeObserver");
    expect(shell).toContain("--header-offset");
  });

  it("publishes zero when the header is not sticky", () => {
    // Nothing is pinned above the bar in that configuration, so an offset
    // would push it down the page for no reason.
    expect(shell).toContain("sticky ? Math.round");
  });
});

// The route keys the bar's hrefs come from also have to exist as keys, not
// only as paths — `LEARN_TRACK_ROUTE_KEYS` is what the seeded menu rows and
// the mega-menu panels reference.
describe("route-key registration", () => {
  it("registers learn-<track>, -quizzes and -glossary for each track", () => {
    for (const track of LEARN_TRACK_KEYS) {
      expect(isRouteKey(`learn-${track}`)).toBe(true);
      expect(isRouteKey(`learn-${track}-quizzes`)).toBe(true);
      expect(isRouteKey(`learn-${track}-glossary`)).toBe(true);
    }
  });
});
