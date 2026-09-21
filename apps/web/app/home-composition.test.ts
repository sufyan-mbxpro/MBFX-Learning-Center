// Homepage composition guards (changes-28, ADR-092/093/095).
//
// Read as source, for the reason `public-chrome.test.ts` and
// `locale-serving.test.ts` both record: the sections are async server
// components awaiting translations and a database, and the properties under
// test are imports, registry membership and JSX structure. No type catches any
// of them — `SECTION_COMPONENTS` is a `Partial<Record<string, …>>` by design,
// and a `<Suspense>` that is simply absent is valid React.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  HOME_SECTION_BUILT_KEYS,
  HOME_SECTION_STUB_KEYS,
  HOME_SECTION_VARIANTS,
} from "@repo/contracts";

const ROOT = resolve(process.cwd(), "app/(public)/[locale]");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/**
 * Source with its comments removed.
 *
 * These guards assert what the code DOES, and several of the files under test
 * explain in a comment exactly which thing they deliberately do not do. A bare
 * substring search then matches the explanation and fails the file for saying
 * why it is correct — so the prose comes out before the assertion goes in.
 */
function withoutComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("ADR-092 — the video rail reads published topics, not a code registry", () => {
  it("the all-null code registry is deleted", () => {
    expect(existsSync(join(ROOT, "_content/home-videos.ts"))).toBe(false);
  });

  it.each(["_sections/video-showcase.tsx", "learn/page.tsx", "_sections/connect.tsx"])(
    "%s imports no home-videos registry",
    (path) => {
      // The import, not the word: the section's own header comment names the
      // deleted file to explain what changed, and a guard that forbids saying
      // so would forbid the explanation along with the defect.
      expect(read(path)).not.toMatch(/from "[^"]*home-videos/);
    },
  );

  it("the rail resolves its source through @repo/core, never parseVideoUrl itself", () => {
    const src = read("_sections/video-showcase.tsx");
    expect(src).toContain("getFeaturedVideoTopics");
    // security.md #9: a raw URL is turned into an embed URL in ONE place, on
    // the server, inside the service. A section reaching for the parser is a
    // second path to an iframe `src`.
    expect(src).not.toContain("parseVideoUrl");
  });

  it('nothing says "recording soon" any more — a topic without a video is a guide', () => {
    for (const path of ["_sections/video-showcase.tsx", "_components/video-tile.tsx"]) {
      expect(read(path)).not.toContain("videoSoon");
    }
  });

  it("the tile keeps play and navigate as SEPARATE targets (ADR-068 §7)", () => {
    const src = read("_components/video-tile.tsx");
    // An <a> nested inside a <button> is invalid HTML and the reason the
    // playable tile is an <article> holding two siblings rather than one
    // control doing both jobs.
    expect(src).toContain("<article");
    expect(src).not.toMatch(/<button[\s\S]*?<a\s[\s\S]*?<\/button>/);
  });
});

describe("ADR-093 — the two new bands are registered in every place a band lives", () => {
  const registry = read("_sections/registry.ts");
  const seed = readFileSync(resolve(process.cwd(), "../../packages/db/prisma/seed.ts"), "utf8");

  it.each(["connect", "quotes"])(
    "%s has a component, a built-key entry and a seeded row",
    (key) => {
      expect(registry).toMatch(new RegExp(`\\b${key}:`));
      expect(HOME_SECTION_BUILT_KEYS as readonly string[]).toContain(key);
      expect(HOME_SECTION_STUB_KEYS as readonly string[]).not.toContain(key);
      expect(seed).toContain(`{ key: "${key}"`);
    },
  );

  it("connect declares no variant vocabulary, like risk_disclaimer", () => {
    // An empty list would reject EVERY variant while looking configurable —
    // the case `settings.test.ts` pins. A band with one shape is simply absent
    // from the registry.
    expect(Object.keys(HOME_SECTION_VARIANTS)).not.toContain("connect");
  });

  it("quotes offers the day's quote and the full rail", () => {
    expect(HOME_SECTION_VARIANTS.quotes).toEqual(["single", "carousel"]);
  });

  it("the connect band draws no follow row without an active social link", () => {
    // A "follow us" heading over an empty row invites a visitor to follow
    // nobody. ADR-093's rule is unchanged; changes-35 moved it one level down,
    // from the BAND to the COLUMN, because the band gained a second half (the
    // subscribe panel, merged in from the standalone newsletter band). So the
    // follow half is gated on the links and the band survives without it.
    const src = read("_sections/connect.tsx");
    expect(src).toContain("const showFollow = socialLinks.length > 0;");
    expect(src).toContain("{showFollow && (");
  });

  it("the connect band renders nothing when BOTH of its halves are empty", () => {
    // ADR-116 §3's per-dataset rule, which this band needs now that it has two
    // datasets: no social link AND no newsletter placement is a band with
    // nothing in it, not a band with two empty columns.
    expect(read("_sections/connect.tsx")).toContain(
      "if (!showFollow && !showSubscribe) return null;",
    );
  });

  it("the merged subscribe half still reads BOTH newsletter switches", () => {
    // ADR-080 #5 is untouched by the merge: the FLAG says signup exists, the
    // PLACEMENT says it is drawn here, and the form still submits `home` as its
    // source so admin filtering sees what it always saw. Merging two bands must
    // not quietly become "signup is always on the home page".
    const src = read("_sections/connect.tsx");
    expect(src).toContain('isFeatureVisible("newsletter", null)');
    expect(src).toContain('isNewsletterPlacementEnabled("home")');
    expect(src).toContain('source="home"');
  });

  it("the connect band claims no livestream", () => {
    // The reference it is modelled on embeds one. changes-23 is unbuilt, so
    // copying the claim would put a promise on the homepage that every click
    // disproves (ADR-047 §3).
    expect(withoutComments(read("_sections/connect.tsx")).toLowerCase()).not.toContain(
      "livestream",
    );
  });
});

describe("ADR-095 — the page streams band by band", () => {
  const page = read("page.tsx");

  it("wraps sections in a Suspense boundary with a shaped fallback", () => {
    expect(page).toContain("<Suspense");
    expect(page).toContain("<SectionSkeleton");
  });

  it("renders the first bands eagerly rather than behind a boundary", () => {
    // A skeleton replaced before the reader's eye has settled is a flash, not
    // a progressive load — so the above-the-fold bands stay unsuspended.
    expect(page).toContain("EAGER_SECTIONS");
  });

  it("wraps an eager band in a Fragment, never an element", () => {
    // `main` is a flex column: an extra <div> between it and a full-bleed
    // Section becomes the flex item and collapses the band's background to
    // content width.
    expect(page).toContain("<Fragment key={section.key}>");
  });

  it("every built band that lists things declares its pending tone", () => {
    // A muted band whose placeholder is white flashes a stripe that then
    // disappears, which reads as a bug rather than as loading.
    const registry = read("_sections/registry.ts");
    const pending = registry.slice(registry.indexOf("SECTION_PENDING"));
    for (const key of ["learning_videos", "connect", "quotes", "glossary_spotlight"]) {
      expect(pending, `${key} has no pending shape`).toContain(`${key}:`);
    }
  });
});
