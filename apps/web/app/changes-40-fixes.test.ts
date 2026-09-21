// changes-40 — the owner's fix list, as guards.
//
// A source guard file per change set, like `changes-39-fixes.test.ts` beside
// it: most of what follows is a class, a prop or an absence on an async server
// component behind a session, so the assertion is about what the file says.
//
// Each block names the complaint it answers, because a guard whose reason is
// lost is a guard the next person deletes.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import en from "@repo/i18n/messages/en.json" with { type: "json" };

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const ADMIN = "app/(admin)/admin/";
const PUBLIC = "app/(public)/[locale]/";

// ─── "all the live view pages should be open in the new page" ────────────

describe("every View live button opens a new tab", () => {
  const EDITORS = [
    "articles/[id]/article-editor.tsx",
    "glossary/[id]/glossary-editor.tsx",
    "glossary/topics/[id]/topic-editor.tsx",
    "learn/courses/[id]/course-editor.tsx",
    "learn/lessons/[id]/lesson-editor.tsx",
    "learn/videos/[id]/video-editor.tsx",
    "tools/[key]/tool-editor.tsx",
  ];

  it.each(EDITORS)("%s", (file) => {
    const src = read(ADMIN + file);
    // Every `<a …/>` that carries the live destination, however the editor
    // spells it: `href={viewLiveHref}` or an absolute template literal, on one
    // line or across several.
    const anchors = [...src.matchAll(/<a[\s\S]*?\/>/g)]
      .map(([m]) => m)
      .filter((a) => a.includes("viewLiveHref") || a.includes("toolPath("));
    expect(anchors.length, `${file}: no View live anchor found`).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(anchor, `${file}: View live must open a new tab`).toContain('target="_blank"');
      // A new tab without `rel` hands the opened page a `window.opener`.
      expect(anchor, `${file}: target=_blank needs rel`).toMatch(/rel="no(opener|referrer)/);
    }
  });
});

// ─── The Base UI warning on /analysis and /news ──────────────────────────
//
// "A component is changing the default value state of an uncontrolled
// FieldControl after being initialized." Searching became a soft navigation in
// changes-39, so the box is no longer remounted and its `defaultValue` changed
// under it — which both warned and left the previous query on screen.

describe("the listing search box is controlled", () => {
  const nav = read(PUBLIC + "news/_components/listing-navigation.tsx");
  const sidebar = read(PUBLIC + "news/_components/article-sidebar.tsx");

  it("exports a controlled input and the sidebar uses it", () => {
    expect(nav).toContain("export function ListingSearchInput");
    expect(nav).toMatch(/value=\{value\}/);
    expect(sidebar).toContain("<ListingSearchInput");
  });

  it("no search field in the listing sidebar takes a changing defaultValue", () => {
    expect(sidebar).not.toContain("defaultValue={query}");
    expect(nav).not.toContain("defaultValue=");
  });
});

// ─── "Rates as of … — out of date … do not show this message" ────────────

describe("the rate footnote prints a date, not a warning", () => {
  const footnote = read(PUBLIC + "tools/_components/rate-footnote.tsx");

  it("still says when the figure is from (ADR-088 #7's actual requirement)", () => {
    expect(footnote).toContain('t("common.asOf"');
    expect(en.tools.common.asOf).toMatch(/\{date\}/);
  });

  it("no longer prints the stale warning, and the key is gone with it", () => {
    expect(footnote).not.toContain("staleAsOf");
    expect(en.tools.common).not.toHaveProperty("staleAsOf");
  });
});

// ─── One AI affordance per rich-text field ───────────────────────────────
//
// The owner: "we'll use only the inner tiptap text editor AI generate, not the
// outer one". A rich-text field carried the toolbar assistant AND `AiFieldMenu`
// a few pixels apart, doing overlapping jobs — and the outer one replaced the
// whole field where the inner one edits a passage.

describe("the outer AI menu is for plain-text fields only", () => {
  const EDITORS_WITH_RICH_TEXT = [
    "articles/[id]/article-editor.tsx",
    "glossary/[id]/glossary-editor.tsx",
    "glossary/topics/[id]/topic-editor.tsx",
    "learn/courses/[id]/course-editor.tsx",
    "learn/lessons/[id]/lesson-editor.tsx",
    "learn/videos/[id]/video-editor.tsx",
    "tools/[key]/tool-editor.tsx",
  ];

  it.each(EDITORS_WITH_RICH_TEXT)("%s has no field menu on a RichTextEditor", (file) => {
    const src = read(ADMIN + file);
    // For each `<RichTextEditor`, the `<Field` that OWNS it — the nearest one
    // before it. Scanning forward from every `<Field` instead would span the
    // whole file up to the first rich-text editor and report a menu belonging
    // to a text input six fields earlier.
    const editors = [...src.matchAll(/<RichTextEditor/g)].map((m) => m.index ?? 0);
    expect(editors.length, `${file}: no rich-text field found`).toBeGreaterThan(0);
    for (const at of editors) {
      const fieldAt = src.lastIndexOf("<Field", at);
      expect(fieldAt, `${file}: a RichTextEditor outside a Field`).toBeGreaterThan(-1);
      const owner = src.slice(fieldAt, at);
      expect(owner, `${file}: a rich-text field still carries the outer AI menu`).not.toContain(
        "fieldMenu(",
      );
    }
  });

  it("keeps the inner assistant, which is the one that stays", () => {
    // Three spellings across the seven editors, all of them a spread onto
    // `RichTextEditor`'s `ai` prop. What the guard is for is that the toolbar
    // assistant survived the removal of the menu beside it.
    for (const file of EDITORS_WITH_RICH_TEXT) {
      expect(read(ADMIN + file), file).toMatch(
        /\{\.\.\.\(aiAssistant|\{\.\.\.\(ai\?\.assistant|\{\.\.\.assistant\}/,
      );
    }
  });

  it("keeps the menu on plain-text fields — this removed a duplicate, not a feature", () => {
    expect(read(ADMIN + "articles/[id]/article-editor.tsx")).toContain('fieldMenu("title")');
    expect(read(ADMIN + "articles/[id]/article-editor.tsx")).toContain("<AiFillButton");
  });
});

// ─── The editor can set the site's own two faces ─────────────────────────

describe("the rich-text font menu offers the display face", () => {
  const extensions = read(ADMIN + "_components/editor-extensions.ts");

  it("lists body and display beside the generic serif and mono", () => {
    expect(extensions).toContain('["body", "display", "serif", "mono"]');
  });

  it("keeps ed-ff-sans allowed, because published articles already carry it", () => {
    // A stored class is DATA. Renaming the mark does not rewrite the database,
    // so dropping the old class from the sanitizer would strip it on the next
    // save and silently revert an author's choice.
    const globals = readFileSync(
      resolve(process.cwd(), "../../packages/ui/src/styles/globals.css"),
      "utf8",
    );
    expect(globals).toContain(".ed-ff-sans");
    expect(globals).toContain(".ed-ff-display");
    const contracts = readFileSync(
      resolve(process.cwd(), "../../packages/contracts/src/content.ts"),
      "utf8",
    );
    for (const cls of ["ed-ff-body", "ed-ff-display", "ed-ff-sans"]) {
      expect(contracts).toContain(`"${cls}"`);
    }
  });
});

// ─── The glossary's reading rail ─────────────────────────────────────────

describe("every glossary page carries the news and tags panels", () => {
  const PAGES = [
    "glossary/page.tsx",
    "glossary/[slug]/page.tsx",
    "glossary/topics/page.tsx",
    "glossary/topics/[topic]/page.tsx",
  ];

  it.each(PAGES)("%s renders the rail", (file) => {
    expect(read(PUBLIC + file)).toContain("<GlossarySidebar");
  });

  it("draws the same two panels the news sidebar does", () => {
    const rail = read(PUBLIC + "glossary/_components/glossary-sidebar.tsx");
    expect(rail).toContain("<LatestPostsPanel");
    expect(rail).toContain("<PopularTagsPanel");
    expect(rail).toContain("facet-panels.tsx");
  });

  it("renders nothing when the news section is off or empty", () => {
    const rail = read(PUBLIC + "glossary/_components/glossary-sidebar.tsx");
    expect(rail).toContain('isFeatureVisible("news", null)');
    expect(rail).toMatch(/facets\.latest\.length === 0 && facets\.tags\.length === 0/);
  });
});

// ─── The two owner banners, and the band that had none ───────────────────

describe("the mastheads changes-40 was asked for", () => {
  it("gives /analysis its own picture rather than reusing /news'", () => {
    expect(read(PUBLIC + "news/_content/news-media.ts")).toContain(
      'analysisBanner: "/banners/analysis.webp"',
    );
    expect(read(PUBLIC + "analysis/page.tsx")).toContain('backdropSlot="analysisBanner"');
  });

  it("gives /glossary/topics a masthead with the owner's piece behind it", () => {
    const page = read(PUBLIC + "glossary/topics/page.tsx");
    expect(page).toContain("<PageHero");
    expect(page).toContain('slot="topicsBanner"');
    expect(read(PUBLIC + "glossary/_content/glossary-media.ts")).toContain(
      'topicsBanner: "/banners/glossary-topics.webp"',
    );
  });

  it("gives the economic calendar the compact photographic band every tool has", () => {
    const page = read(PUBLIC + "economic-calendar/page.tsx");
    expect(page).toContain('size="compact"');
    expect(page).toContain("<CalendarBackdrop />");
  });

  it("shows the topics band's photograph on the archives too, not only on /news", () => {
    // "Topics / Keep exploring" is the same band to a reader, and one of the
    // two showed a photograph while the other showed a flat muted ground.
    const taxonomy = read(PUBLIC + "news/_components/archive-taxonomy.tsx");
    expect(taxonomy).toContain('tone="inverted"');
    expect(taxonomy).toContain('<NewsBackdrop slot="topics" />');
    expect(taxonomy).toContain("from-secondary/90");
  });
});

// ─── The calendar is TradingView's now (ADR-137) ─────────────────────────

describe("the economic calendar", () => {
  const page = read(PUBLIC + "economic-calendar/page.tsx");
  const board = read(PUBLIC + "economic-calendar/_components/calendar-board.tsx");
  const proxy = read("proxy.ts");

  it("frames the vendor widget and runs none of its script", () => {
    expect(board).not.toMatch(/<script|createElement\(\s*["']script/);
    expect(board).not.toContain("s3.tradingview.com");
    expect(board).toContain("tradingViewWidgetUrl(");
  });

  it("drops the previous vendor from the CSP along with its code", () => {
    expect(proxy).not.toContain("tradays.com");
    const frameSrc = proxy.split("\n").find((line) => line.includes("`frame-src"));
    expect(frameSrc).toContain("https://www.tradingview-widget.com");
  });

  it("carries the reference's filter row, built from closed lists", () => {
    const filters = read(PUBLIC + "economic-calendar/_content/calendar-filters.ts");
    expect(filters).toContain("CALENDAR_IMPORTANCE");
    expect(filters).toContain("CALENDAR_REGIONS");
    expect(board).toContain("<ViewChips");
    expect(en.economicCalendar.filterImportance.high).toBeTruthy();
    expect(en.economicCalendar.filterRegion.major).toBeTruthy();
  });

  it("puts the instructions beside the calendar, not four bands away", () => {
    const calendarBand = page.indexOf("<CalendarBoard");
    const instructions = page.indexOf('t("usingTitle")');
    expect(calendarBand).toBeGreaterThan(-1);
    expect(instructions).toBeGreaterThan(calendarBand);
    // …and inside the same section as the widget.
    expect(page.indexOf("</Section>", calendarBand)).toBeGreaterThan(instructions);
  });
});

// ─── "Around the markets" as a page of its own ───────────────────────────

describe("the market news tool", () => {
  const page = read(PUBLIC + "tools/market-news/page.tsx");
  const megaMenu = read(PUBLIC + "_nav/mega-menu.ts");

  it("renders the same band /analysis does, rather than a copy of it", () => {
    expect(page).toContain("<MarketNewsBand");
    expect(page).toContain("analysis/_components/market-news-band.tsx");
  });

  it("is not a TOOLS member — there is nothing on it to configure", () => {
    const tools = readFileSync(
      resolve(process.cwd(), "../../packages/contracts/src/tools.ts"),
      "utf8",
    );
    expect(tools).not.toContain('"market-news"');
  });

  it("sits in the Tools panel's Rates & relationships column", () => {
    const rates = megaMenu.slice(megaMenu.indexOf('key: "rates"'));
    expect(rates).toContain('"market-news"');
    expect(megaMenu).toContain('"market-news": Newspaper');
  });
});

// ─── "balance the menu items" ────────────────────────────────────────────

describe("the Tools mega panel is balanced", () => {
  const megaMenu = read(PUBLIC + "_nav/mega-menu.ts");

  function column(key: string): string[] {
    const start = megaMenu.indexOf(`key: "${key}"`);
    expect(start, `column ${key} not found`).toBeGreaterThan(-1);
    const end = megaMenu.indexOf("},", megaMenu.indexOf("routeKeys:", start));
    return [...megaMenu.slice(start, end).matchAll(/"([\w-]+)"/g)]
      .map((m) => m[1]!)
      .filter((value) => value !== key && !value.startsWith("mega."));
  }

  it("no column is more than two rows longer than another", () => {
    const lengths = ["position", "timing", "rates"].map((key) => column(key).length);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(2);
  });

  it("still lists every destination it listed before, and one more", () => {
    const all = new Set(["position", "timing", "rates"].flatMap(column));
    for (const key of [
      "tool-position-size",
      "tool-risk-reward",
      "tool-margin",
      "tool-pip-value",
      "tool-profit-loss",
      "tool-gain-loss",
      "tool-market-hours",
      "tool-pivot-points",
      "economic-calendar",
      "volatility",
      "live-rates",
      "tool-currency-converter",
      "tool-correlation",
      "tool-risk-sentiment",
      "market-news",
    ]) {
      expect(all.has(key), `${key} missing from the Tools panel`).toBe(true);
    }
  });
});

// ─── "in the footer tools divide in 2 columns" ───────────────────────────

describe("the footer's Tools column is two", () => {
  const seed = readFileSync(resolve(process.cwd(), "../../packages/db/prisma/seed.ts"), "utf8");

  it("seeds a second menu and lists it in footer.menuColumns", () => {
    expect(seed).toContain('key: "footer_tools_markets"');
    expect(seed).toContain('{ menuKey: "footer_tools_markets", order: 4 }');
  });

  it("leaves neither column much longer than the others", () => {
    const menu = (key: string) => {
      const start = seed.indexOf(`key: "${key}"`);
      expect(start, `${key} not seeded`).toBeGreaterThan(-1);
      const end = seed.indexOf("\n    },", start);
      return [...seed.slice(start, end).matchAll(/routeKey:/g)].length;
    };
    for (const key of ["footer_tools", "footer_tools_markets"]) {
      expect(menu(key), `${key} is still a tall stack`).toBeLessThanOrEqual(8);
    }
  });
});

// ─── "in first intro add the definitions with headings, second how to use" ─

describe("every tool opens on a definition and says how to use it", () => {
  const seed = readFileSync(resolve(process.cwd(), "../../packages/db/prisma/seed.ts"), "utf8");
  const block = seed.slice(seed.indexOf("const TOOL_SEEDS"), seed.indexOf("for (const tool of"));
  const entries = [...block.matchAll(/\n {4}\{\n {6}key: "([\w-]+)",[\s\S]*?\n {6}config:/g)];

  it("finds all eleven tools — a silent zero would pass every assertion", () => {
    expect(entries).toHaveLength(11);
  });

  it.each(entries.map((m) => [m[1]!, m[0]!]))("%s", (_key, source) => {
    const intro = source.slice(source.indexOf("intro:"), source.indexOf("body:"));
    const body = source.slice(source.indexOf("body:"));
    // The definition leads the intro — a reader arriving from a search result
    // needs the word before the form means anything.
    expect(intro).toMatch(/"<h2>(What|When|How)\b/);
    // …and the instructions lead the explainer.
    expect(body).toMatch(/"<h2>How to (use|read)\b/);
    expect(body).toContain("<ol>");
  });
});
