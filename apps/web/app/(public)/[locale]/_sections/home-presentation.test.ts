// The home page's four presentation bands (changes-35, ADR-116).
//
// Read as source, like `home-bands.test.ts` beside it and for the same reason:
// these are async server components, and apps/web's vitest config carries no
// JSX transform because nothing here has ever needed to render one. What is
// under test is a property of the code a reviewer checks by reading.
//
// Three kinds of thing are asserted, and only the first is about layout:
//
//   1. DEGRADATION — every band renders nothing, or fewer columns, rather than
//      a heading over a hole. ADR-116 §3 is the rule; `in_practice` has four
//      rendered states and that is three more than a grid band has.
//   2. REGISTRATION — `in_practice` exists in all four places a home band has
//      to exist in, and deliberately not in the fifth.
//   3. DENSITY — band A's size, because "reduce the space" was the ask and a
//      later well-meant edit restoring `spacing="lg"` should fail here rather
//      than be noticed three months on (ADR-116 §4).
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOME_SECTION_BUILT_KEYS,
  HOME_SECTION_STUB_KEYS,
  HOME_SECTION_VARIANTS,
  isKnownHomeSectionKey,
} from "@repo/contracts";

const ROOT = resolve(process.cwd(), "app/(public)/[locale]");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const SEED = resolve(process.cwd(), "../../packages/db/prisma/seed.ts");
const seedSource = readFileSync(SEED, "utf8");

/** The seeded `home.sections` block, which is what the page actually renders. */
function seededRow(key: string): string | null {
  const match = seedSource.match(new RegExp(`\\{ key: "${key}",[^}]*\\}`));
  return match?.[0] ?? null;
}

describe("ADR-116 §3 — a band degrades rather than rendering a hole", () => {
  it("in_practice returns null only when ALL THREE datasets are empty", () => {
    const src = read("_sections/in-practice.tsx");
    // The guard counts columns rather than testing one dataset: an `if
    // (testimonials.length === 0) return null` here would delete the video and
    // the tools along with the quotes.
    expect(src).toMatch(/const columnCount = columns\.filter\(Boolean\)\.length;/);
    expect(src).toMatch(/if \(columnCount === 0\) return null;/);
  });

  it("in_practice lays out by COLUMN COUNT, not by breakpoint alone", () => {
    const src = read("_sections/in-practice.tsx");
    // A band that lost a column to a flag has to close up. `lg:grid-cols-3`
    // with one column missing is a two-column band with a gap where the third
    // used to be.
    expect(src).toContain("columnCount === 3");
    expect(src).toContain("columnCount === 2");
  });

  it.each([
    ["testimonials", "testimonials.length > 0"],
    ["the video", 'video !== "" &&'],
    ["the tools", "shownTools.length > 0"],
  ])("in_practice renders %s only when it has data", (_label, guard) => {
    expect(read("_sections/in-practice.tsx")).toContain(guard);
  });

  it("the desk band survives either kind being absent", () => {
    const src = read("_sections/latest-news.tsx");
    // A short or absent feed gives its seats to the other one (ADR-121 §1);
    // the rule itself is pure and tested in `desk-entries.test.ts`.
    expect(src).toContain("deskEntries(news, analysis)");
    // Both absent: nothing at all.
    expect(src).toMatch(/if \(news\.length === 0 && analysis\.length === 0\) return null;/);
  });

  it("the desk band's calls to action follow the feeds that are on the row", () => {
    // An "All analysis" button over a row with no analysis in it is the same
    // hole as a heading over an empty panel.
    const src = read("_sections/latest-news.tsx");
    expect(src).toContain("{news.length > 0 && (");
    expect(src).toContain("{analysis.length > 0 && (");
  });

  it("the glossary band drops its third column when there is no term of the day", () => {
    const src = read("_sections/glossary-spotlight.tsx");
    expect(src).toContain("{termOfTheDay && (");
    // And it does not pay for the read on the variants that do not draw it.
    expect(src).toMatch(/isFeature \? getTermOfTheDay\(locale\) : null,/);
  });

  it("no new band imports an Empty component", () => {
    // The `home-bands.test.ts` formulation: "contains no empty-state markup"
    // matches the prose explaining why there is no empty state, so the thing
    // that can actually be told apart is an `Empty` COMPONENT.
    for (const path of [
      "_sections/in-practice.tsx",
      "_sections/latest-news.tsx",
      "_sections/glossary-spotlight.tsx",
    ]) {
      expect(read(path)).not.toMatch(/components\/empty/);
    }
  });
});

describe("ADR-116 §3 — in_practice is registered everywhere a band must be", () => {
  it("is a built key, not a stub", () => {
    expect(HOME_SECTION_BUILT_KEYS as readonly string[]).toContain("in_practice");
    expect(HOME_SECTION_STUB_KEYS as readonly string[]).not.toContain("in_practice");
  });

  it("has a component and a pending shape", () => {
    const src = read("_sections/registry.ts");
    expect(src).toMatch(/in_practice: InPractice,/);
    expect(src).toMatch(/\bin_practice:\s*\{/);
  });

  it("declares no variant vocabulary", () => {
    // What varies about this band is not a layout choice at all — it is which
    // of its three columns have data. A variant list would offer an admin a
    // choice the band does not have (`connect` / `risk_disclaimer` precedent).
    expect(isKnownHomeSectionKey("in_practice")).toBe(false);
  });

  it("is seeded enabled, because a band absent when empty needs no off switch", () => {
    expect(seededRow("in_practice")).toMatch(/enabled: true/);
  });
});

describe("ADR-116 §1 — each band's seeded variant exists in the vocabulary", () => {
  it.each([
    ["latest_news", "desk"],
    ["glossary_spotlight", "feature"],
    ["faq", "columns"],
  ])("%s accepts %s", (key, variant) => {
    const variants = HOME_SECTION_VARIANTS[key as keyof typeof HOME_SECTION_VARIANTS];
    expect(variants as readonly string[]).toContain(variant);
    expect(seededRow(key)).toContain(`variant: "${variant}"`);
  });

  it.each([
    ["latest_news", "split"],
    ["glossary_spotlight", "cards"],
    ["faq", "accordion"],
  ])("%s keeps %s — a variant is added, never traded", (key, variant) => {
    const variants = HOME_SECTION_VARIANTS[key as keyof typeof HOME_SECTION_VARIANTS];
    expect(variants as readonly string[]).toContain(variant);
  });
});

describe("ADR-116 §4 — the platform band's density is a decision, not a detail", () => {
  const src = () => read("_sections/explore.tsx");

  it("is a small band, not a large one", () => {
    // `lg` put ~4.5rem of padding on each edge, and every band pays its own
    // twice over — this one's bottom plus the next one's top.
    expect(src()).toContain('<Section spacing="sm">');
    expect(src()).not.toContain('<Section spacing="lg">');
  });

  it("runs four slides across, on the named token", () => {
    // ADR-072 §10: the width is a token in globals.css, never a bracket here.
    expect(src()).toContain("lg:w-(--width-slide-4)");
    expect(src()).not.toContain("lg:w-(--width-slide-3)");
  });

  it("shows arrows centred under the track, and no dot rail", () => {
    // A dot per destination is eight controls nobody counts, and the rail was
    // the widest thing in the band.
    expect(src()).toContain('controls="arrows"');
    expect(src()).toContain('controlsAlign="center"');
  });

  it("puts the view-all control in the heading row", () => {
    // Promoted out of a line of its own under the track — one text line saved
    // at every viewport.
    // Anchored on `flex-wrap`, which is the HEADING row's own class: the card
    // markup carries its own `items-end justify-between` for the icon/badge
    // row, and matching that one made this pass for the wrong reason.
    expect(src()).toMatch(/flex-wrap items-end justify-between[\s\S]{0,1200}exploreAll/);
  });

  it("sends view-all to the sitemap, the one page that lists every section", () => {
    // `/learn` would promote one of the eight cards over the other seven.
    expect(src()).toContain("ROUTE_PATHS.sitemap");
  });
});

describe("A multi-column band's columns end on one line (owner, 2026-09-16)", () => {
  // The complaint was concrete: the glossary band's browse button hung ~90px
  // below the cards beside it, its term card stopped ~100px short of the
  // carousel's controls, and `in_practice`'s three columns came out 300px,
  // 237px and 420px. Three columns that each end somewhere different read as
  // three adjacent things rather than as one band.
  //
  // `items-start` is what caused all of it, and it is the thing to keep out —
  // it is the natural class to reach for and it is right in the OTHER shape
  // (a list beside a lead, which `split` still uses).
  it.each([
    ["the glossary browse band", "_sections/glossary-spotlight.tsx", "--grid-home-browse"],
    ["in_practice", "_sections/in-practice.tsx", "lg:grid-cols-3"],
  ])("%s stretches its columns", (_label, path, gridMarker) => {
    const src = read(path);
    const grid = src.slice(src.indexOf(gridMarker) - 400, src.indexOf(gridMarker) + 200);
    expect(grid).not.toContain("items-start");
  });

  it("the glossary band pins its browse button to the column's bottom edge", () => {
    expect(read("_sections/glossary-spotlight.tsx")).toContain('<div className="mt-auto">');
  });

  it("in_practice's footage fills its column to the row's height (owner, 2026-09-17)", () => {
    // The clip is cover-fitted behind an absolute layer, so the quotes and
    // the tools set the row and the video matches them. `self-center` on the
    // grid ITEM was the older bug: it shrank the column and left the band
    // ragged again.
    const src = read("_sections/in-practice.tsx");
    expect(src).toContain("lg:aspect-auto lg:h-full");
    expect(src).toContain('className="absolute inset-0"');
    expect(src).toContain("<HeroVideo");
    expect(src).not.toContain("lg:self-center");
  });

  it("in_practice pins the tools column's last link to the bottom", () => {
    expect(read("_sections/in-practice.tsx")).toMatch(/link-underline mt-auto/);
  });

  it("the desk band is the /news Top stories shape (changes-39)", () => {
    // The owner asked for the home news & analysis band to match /news's lead
    // story beside a numbered rail. It draws the SAME component, so the two
    // cannot drift apart, and keeps a call to action per feed.
    const src = read("_sections/latest-news.tsx");
    const desk = src.slice(src.indexOf("if (isDesk)"), src.indexOf("Every other variant"));
    expect(desk).toContain("<SpotlightGrid");
    expect(desk).toContain("runnerCount={DESK_SEATS - 1}");
    expect(desk).not.toContain("<ArticleCards");
    expect(desk).toContain('href="/news"');
    expect(desk).toContain('href="/analysis"');
    // /news carries three in its rail too since changes-46 (owner: "add 3
    // suggestions on the right side"), aligned to the lead's bottom edge.
    const news = read("news/_components/news-spotlight.tsx");
    expect(news).toContain("runnerCount={3}");
    expect(news).toMatch(/<SpotlightGrid[\s\S]*?alignRail[\s\S]*?priority\s*\/>/);
    expect(read("news/page.tsx")).toContain("const SPOTLIGHT_COUNT = 4;");
  });

  it("the desk band is the small spacing step", () => {
    // It is the tallest band on the page and the owner asked for it shorter.
    const src = read("_sections/latest-news.tsx");
    const desk = src.slice(src.indexOf("if (isDesk)"));
    expect(desk).toContain('<Section spacing="sm">');
  });
});

describe("ADR-116 §5/§6/§7 — what the seed says about the absorbed bands", () => {
  it.each(["latest_analysis", "popular_tools", "testimonials"])(
    "%s is seeded off on the home page, and still registered",
    (key) => {
      expect(seededRow(key)).toMatch(/enabled: false/);
      // Off, never deleted: re-enabling is one word, and nothing else in the
      // build has to change for it to work.
      expect(HOME_SECTION_BUILT_KEYS as readonly string[]).toContain(key);
      expect(read("_sections/registry.ts")).toContain(`${key}:`);
    },
  );

  it("the trust strip is seeded off, and migrated off for an existing database (ADR-121 §3)", () => {
    expect(seededRow("trust_strip")).toMatch(/enabled: false/);
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "../../packages/db/prisma/migrations/20260916200000_disable_trust_strip_changes37/migration.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("'trust_strip'");
    // Off, never deleted — ADR-103's component and rule stay.
    expect(read("_sections/registry.ts")).toContain("trust_strip: TrustStrip,");
  });

  it("the testimonial rail advances on its own and brings its pause control (ADR-121 §4)", () => {
    const src = read("_sections/in-practice.tsx");
    expect(src).toContain("hoverArrows");
    expect(src).toMatch(/autoplay=\{\{[\s\S]*pauseLabel: t\("practiceQuotesPause"\)/);
  });

  it("the facts band is seeded off, and migrated off for an existing database (changes-39)", () => {
    expect(seededRow("facts")).toMatch(/enabled: false/);
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "../../packages/db/prisma/migrations/20260917120000_disable_facts_changes39/migration.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("'facts'");
    expect(migration).not.toContain("'trust_strip'");
    expect(read("_sections/registry.ts")).toContain("facts: Facts,");
  });

  it("connect shows a picture where the subscribe half was, for a signed-in reader only (changes-39)", () => {
    const src = read("_sections/connect.tsx");
    // Hidden by default, shown under the same pre-paint hint that hides the
    // subscribe half — so exactly one of the two holds that track.
    expect(src).toContain("hidden");
    expect(src).toContain("lg:in-data-[session=learner]:block");
    expect(src).toContain('src="/banners/spare-forex.webp"');
    // The follow half no longer stretches across the row when signed in.
    expect(src).not.toContain("in-data-[session=learner]:lg:grid-cols-1");
  });

  it("connect no longer reads a video, so the page features exactly one", () => {
    const src = read("_sections/connect.tsx");
    expect(src).not.toContain("getFeaturedVideoTopics");
    expect(src).not.toContain("VideoTile");
    // And the one that is left is in_practice's owner footage (2026-09-17).
    expect(read("_sections/in-practice.tsx")).toContain("HOME_MEDIA.practiceVideo");
  });

  it("the questions come before the ask", () => {
    // ADR-116 §6: answer the objection, then request the email address.
    const faq = seededRow("faq");
    const newsletter = seededRow("newsletter");
    const orderOf = (row: string | null) => Number(row?.match(/order: (\d+)/)?.[1] ?? NaN);
    expect(orderOf(faq)).toBeLessThan(orderOf(newsletter));
  });

  it("the risk disclaimer prints in the footer and in no page body", () => {
    // changes-34 turned the home band off because the footer printed the same
    // text. changes-36 (ADR-119) took it out of the footer too; changes-38
    // (ADR-122) put it back in the footer ONLY, and took the band off the
    // tool pages and the economic calendar, where it had survived.
    expect(seededRow("risk_disclaimer")).toMatch(/enabled: false/);
    const footer = readFileSync(join(ROOT, "_components/footer.tsx"), "utf8");
    expect(footer).toContain('getSetting("legal.riskDisclaimer")');
    expect(footer).toContain("<CtaBand");
    for (const page of ["tools/page.tsx", "tools/[tool]/page.tsx", "economic-calendar/page.tsx"]) {
      expect(readFileSync(join(ROOT, page), "utf8"), page).not.toContain("RiskDisclaimer");
    }
    expect(readFileSync(join(ROOT, "tools/_components/tool-shell.tsx"), "utf8")).not.toContain(
      "{disclaimer}",
    );
    expect(readFileSync(join(ROOT, "news/[slug]/page.tsx"), "utf8")).not.toContain(
      'getSetting("legal.riskDisclaimer")',
    );
  });
});
