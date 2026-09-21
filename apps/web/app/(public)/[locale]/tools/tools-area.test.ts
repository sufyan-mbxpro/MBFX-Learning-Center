// The public tools area's rules (changes-25 T6, ADR-086).
//
// A SOURCE guard, the idiom `apps/web` already uses for its page-level
// assertions (`top-bar-icons.test.ts`, `explore-destinations.test.ts`): this
// app has no jsdom, and every question below is about what a file SAYS rather
// than about what a component renders.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ROUTE_PATHS, TOOLS, TOOL_KEYS, toolFlag, toolPath } from "@repo/contracts";
import en from "@repo/i18n/messages/en.json";
import { TOOL_ICONS, hasIconForEveryTool } from "./_components/tool-icons.ts";

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/**
 * The file with its comments removed.
 *
 * A source guard that reads comments fails on its own explanation: the
 * sentence "the robots: { index: false } line goes with the placeholder" is a
 * record of the change, and a naive search reads it as the change not having
 * happened. Both assertions below hit that within a minute of being written.
 */
const code = (source: string): string =>
  source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const indexPage = read("./page.tsx");
const toolPage = read("./[tool]/page.tsx");
const layout = read("./layout.tsx");
const shell = read("./_components/tool-shell.tsx");
const widgetSwitch = read("./_components/tool-widget.tsx");
const rateFootnote = read("./_components/rate-footnote.tsx");
const widgetLayout = read("./_components/widget-layout.tsx");
const marketHours = read("./_widgets/market-hours.tsx");

describe("the index is a real page now", () => {
  it("no longer renders ComingSoon", () => {
    // ADR-081 #1 put a placeholder here; ADR-086 replaces it. The
    // `explore-destinations` guard reads the same fact from the other side.
    expect(code(indexPage)).not.toContain("<ComingSoon ");
  });

  it("is indexable — the placeholder's noindex went with it", () => {
    expect(code(indexPage)).not.toMatch(/robots:\s*\{\s*index:\s*false/);
  });
});

describe("icons", () => {
  it("gives every registered tool a component", () => {
    // The `satisfies Record<ToolKey, LucideIcon>` makes this a type error too;
    // the runtime assertion is what a reader of the test file sees.
    expect(hasIconForEveryTool()).toBe(true);
    for (const key of TOOL_KEYS) expect(TOOL_ICONS[key]).toBeDefined();
  });

  it("declares no icon for a key the registry does not have", () => {
    expect(Object.keys(TOOL_ICONS).sort()).toEqual([...TOOL_KEYS].sort());
  });
});

describe("the band flow lives in ONE place (ADR-086 #9, ADR-114 #1)", () => {
  it("orders the bands in tool-shell, not in the page", () => {
    // Read from the RETURN block only: the props destructured above it list
    // the same names in a different order, and matching those would pin the
    // signature rather than the layout.
    //
    // And read it through `code()`, for the reason that helper documents: a
    // band comment explaining WHY the masthead is compact says the word
    // "widget", and read as source that put the widget band above PageHero.
    const jsx = code(shell).slice(code(shell).indexOf("  return ("));
    const order = ["PageHero", "widget", "faq", "body", "highlights", "related"];
    let previous = -1;
    for (const band of order) {
      const at = jsx.indexOf(band);
      expect(at, `tool-shell.tsx renders no "${band}" band`).toBeGreaterThan(-1);
      expect(at, `"${band}" is out of order in tool-shell.tsx`).toBeGreaterThan(previous);
      previous = at;
    }
  });

  it("puts the widget and its explainer in ONE Section", () => {
    // changes-26 #2, and still the reason after ADR-114 moved the explainer
    // beside the widget rather than under it: two stacked `Section`s each pay
    // `section-md` (`clamp(3rem, 6vw, 5rem)`), so the calculator and the
    // paragraph about it were 160px apart on a laptop.
    //
    // Asserted over the SLICE between the masthead and the highlights band
    // rather than over the whole return, because the highlights band pays its
    // own rhythm deliberately — it is the page's argument for itself, which is
    // a different thing from the page.
    const jsx = code(shell).slice(code(shell).indexOf("  return ("));
    const band = jsx.slice(jsx.indexOf("<PageHero"), jsx.indexOf("highlights.length"));
    expect(band.split("<Section").length - 1).toBe(1);
    // …and separates its two columns with a GAP rather than with a second
    // section's padding, which is the same statement from the other side.
    expect(band).toMatch(/gap-\d/);
  });

  it("puts the calculator first and its explanation beside it (ADR-114 #1)", () => {
    // The owner's ask, as a property: two columns at `lg`, and the widget is
    // the one a reader meets first — in the DOM as well as on screen, which is
    // what a screen-reader and a phone both get.
    const jsx = code(shell).slice(code(shell).indexOf("  return ("));
    expect(jsx).toContain("lg:grid-cols-(--grid-3-2)");
    expect(jsx.indexOf("{widget}")).toBeLessThan(jsx.indexOf("<aside"));
    // code-style.md #23: the one-column base is stated, never implied.
    expect(jsx).toContain("grid grid-cols-1");
  });

  it("puts common questions UNDER the calculator, in the calculator's column", () => {
    // Owner, 2026-09-18: in the aside the FAQ read as more explainer and began
    // far below the widget's foot; full width broke the two-column page. It is
    // the widget column's second child, at the widget's width.
    const jsx = code(shell).slice(code(shell).indexOf("  return ("));
    const widgetColumn = jsx.slice(jsx.indexOf("{widget}"), jsx.indexOf("<aside"));
    expect(widgetColumn).toContain("<FaqPanel");
    const aside = jsx.slice(jsx.indexOf("<aside"), jsx.indexOf("</aside>"));
    expect(aside).not.toContain("<FaqPanel");
  });

  it("splits the widget's own columns on its WIDTH, not the viewport's", () => {
    // ADR-114 #2. `lg:grid-cols-2` inside a three-fifths column gives an
    // inputs track of about 290px at 1024px, which does not hold a currency
    // combobox beside a result panel.
    expect(widgetLayout).toContain("@container/widget");
    expect(widgetLayout).toContain("@2xl/widget:grid-cols-2");
    expect(code(widgetLayout)).not.toContain("lg:grid-cols-2");
  });

  it("keeps the page from laying itself out", () => {
    // Eight pages that each compose their own bands become eight layouts
    // within a year. The page supplies slots; the shell orders them.
    expect(toolPage).toContain("<ToolShell");
    expect(code(toolPage)).not.toContain("<PageHero");
    expect(code(toolPage)).not.toContain("<FaqPanel");
  });
});

describe("the editor's Cover image reaches the masthead", () => {
  // It was saved, audited and reference-tracked, and read by nothing: an
  // admin uploaded a cover and no public page changed (code-style.md #28).
  it("passes the resolved cover URL to the shell as the backdrop", () => {
    expect(code(toolPage)).toMatch(/backdrop=\{\s*page\.coverUrl \?/);
  });

  it("lets the shell hand that backdrop to PageHero", () => {
    expect(code(shell)).toMatch(/<PageHero[\s\S]*?backdrop=\{backdrop\}/);
  });
});

describe("a disabled or unknown tool 404s (ADR-086 #5)", () => {
  it("calls notFound for an unregistered key and for an absent page alike", () => {
    expect(toolPage).toContain("if (!isToolKey(tool)) notFound()");
    // `getToolPage` returns null for BOTH "no row" and "switched off", so the
    // page cannot accidentally distinguish them.
    expect(toolPage).toContain("if (!page) notFound()");
  });

  it("404s the whole area when its flag is off", () => {
    expect(indexPage).toContain("notFound()");
    expect(indexPage).toContain('isFeatureVisible("calculators"');
  });

  it("gates each tool on its OWN flag as well", () => {
    expect(toolPage).toContain("toolFlag(key)");
    expect(toolPage).toContain("if (!flagVisible) notFound()");
  });

  it("registers a flag for each calculator and none for the always-on tools", () => {
    expect(toolFlag("position-size")).toBe("calculators");
    expect(toolFlag("currency-converter")).toBe("currency_converter");
    // Market hours is clock arithmetic with no data behind it — there is
    // nothing for a flag to protect.
    expect(toolFlag("market-hours")).toBeNull();
  });
});

describe("the tools shell", () => {
  // ADR-112 dropped the section bar. This is the inverse of the test it
  // replaces, and it is here for the revert rather than for a deliberate
  // re-add: a strip of eight tabs that scrolls sideways under the header is
  // exactly what a future "the tools need navigation" instinct reaches for.
  it("renders NO section bar (ADR-112)", () => {
    expect(layout).not.toContain("SectionNav");
    expect(layout).not.toContain("section-nav.tsx");
  });

  it("does not load the tool list at all, having nothing to list", () => {
    expect(layout).not.toContain("getEnabledTools");
  });

  // The landmark is why the layout still exists: without it the index and the
  // eight tool pages open none, which axe reports as a MODERATE `region`
  // violation — under the serious/critical gate, so it fails silently.
  it("still opens the area's one <main> landmark", () => {
    expect(layout).toContain("<main");
  });
});

describe("prerendering", () => {
  it("generates params from the REGISTRY, not from the table", () => {
    // The set of tools is code (ADR-086 #1), so every page is known at build
    // time whether or not a row exists for it.
    expect(toolPage).toContain("return TOOL_KEYS.map");
  });

  it("reads no session (ADR-056 #1)", () => {
    expect(toolPage).not.toContain("getSession");
    expect(toolPage).not.toContain("requireUser");
  });
});

/**
 * Every string in a catalog subtree, with its dotted path.
 *
 * Module-level because two describes below check COPY rules — ADR-088's
 * "never real-time" and ADR-114 #4's "never volatility" — and a rule about
 * words has to be checked where the words are.
 */
const walkStrings = (node: unknown, path: string[] = []): [string, string][] =>
  typeof node === "string"
    ? [[path.join("."), node]]
    : node && typeof node === "object"
      ? Object.entries(node).flatMap(([k, v]) => walkStrings(v, [...path, k]))
      : [];

describe('never "real-time", never "live" (ADR-088 #7)', () => {
  // The rule nothing static enforced before this test. It is a COPY rule, so
  // the catalog is where it has to be checked.
  const toolsStrings = walkStrings((en as { tools: unknown }).tools);

  it("finds the namespace at all — a silent zero would pass every assertion", () => {
    expect(toolsStrings.length).toBeGreaterThan(30);
  });

  it.each([["real-time"], ["realtime"], ["live rates"], ["live data"]])(
    "says %s nowhere in the tools namespace",
    (phrase) => {
      const offenders = toolsStrings.filter(([, value]) => value.toLowerCase().includes(phrase));
      expect(offenders).toEqual([]);
    },
  );

  // changes-40 REPLACED the stale WARNING, not the "as of" line. ADR-088 #7's
  // requirement is that a figure says when it is from; "out of date, and shown
  // for reference only" was editorial judgement on top of that, printed under a
  // warning triangle on every tool of a freshly seeded install.
  it("prints the date a rate is from, on every rate-backed surface", () => {
    expect(rateFootnote).toContain('t("common.asOf"');
    const strings = Object.fromEntries(toolsStrings);
    expect(strings["common.asOf"]).toMatch(/\{date\}/);
  });

  it("no longer prints the stale warning", () => {
    expect(rateFootnote).not.toContain("staleAsOf");
  });
});

describe("one island per page, never eight (ADR-086 risk 4)", () => {
  it("switches on the server", () => {
    // `tool-widget.tsx` is a server component: the switch runs there, so a
    // reader on /tools/gain-loss downloads the gain/loss island and nothing
    // else. A "use client" here would ship all eight to every page.
    expect(widgetSwitch.startsWith('"use client"')).toBe(false);
    expect(widgetSwitch).toContain("switch (toolKey)");
  });
});

describe("paths", () => {
  it("resolves every tool to /tools/<key>", () => {
    for (const key of TOOL_KEYS) {
      expect(toolPath(key)).toBe(`/tools/${key}`);
      expect(TOOLS[key].key).toBe(key);
    }
  });
});

// ─── The header (changes-25 T9) ──────────────────────────────
//
// `learn.test.ts`'s sibling, and for the same reason: three registries have to
// name the same eight destinations — `TOOL_KEYS`, the mega panel's columns,
// and the seeded menu tree — and adding a ninth tool means editing all three.
// A guard that fails on whichever half is forgotten is the only thing that
// makes that survivable.

const megaMenu = readFileSync(
  fileURLToPath(new URL("../_nav/mega-menu.ts", import.meta.url)),
  "utf8",
);
const seed = readFileSync(
  fileURLToPath(new URL("../../../../../../packages/db/prisma/seed.ts", import.meta.url)),
  "utf8",
);

/**
 * The tools panel's own source, sliced out of the registry.
 *
 * It used to end at `viewAll: "tools"`, which ADR-112 DELETED — so `indexOf`
 * returned -1, `slice(start, -1)` ran to the end of the file, and both
 * assertions below passed by reading every panel in it. The end marker is now
 * the object's own closing line, which cannot be removed without the panel
 * going with it.
 */
const toolsPanel = (): string => {
  const start = megaMenu.indexOf("  tools: {");
  const end = megaMenu.indexOf("} as const satisfies", start);
  expect(start, "mega-menu.ts declares no tools panel").toBeGreaterThan(-1);
  expect(end, "the tools panel is not the last entry any more").toBeGreaterThan(start);
  return megaMenu.slice(start, end);
};

describe("the tools mega panel", () => {
  it("names EVERY registered tool across its three columns", () => {
    const panel = toolsPanel();
    for (const key of TOOL_KEYS) {
      expect(panel, `the tools panel never lists "${key}"`).toContain(`"tool-${key}"`);
    }
  });

  it("names no tool twice", () => {
    const panel = toolsPanel();
    for (const key of TOOL_KEYS) {
      const count = panel.split(`"tool-${key}"`).length - 1;
      expect(count, `"${key}" appears ${count} times in the tools panel`).toBe(1);
    }
  });

  it("gives every tool a header icon", () => {
    // `MEGA_MENU_ICONS` is `Partial<Record<RouteKey, LucideIcon>>`, so a
    // missing entry is silent — the row just renders without a glyph, next to
    // seven that have one.
    for (const key of TOOL_KEYS) {
      expect(megaMenu, `no mega-menu icon for "${key}"`).toContain(`"tool-${key}": `);
    }
  });
});

describe("the seeded menu tree", () => {
  it("seeds a child row for every registered tool", () => {
    const tree = seed.slice(
      seed.indexOf("const TOOLS_NAV = {"),
      seed.indexOf("  /**\n   * A root row"),
    );
    expect(tree.length).toBeGreaterThan(100);
    for (const key of TOOL_KEYS) {
      expect(tree, `the seeded tools menu has no row for "${key}"`).toContain(`"tool-${key}"`);
    }
  });

  it("keeps `tools` out of the FLAT rows now that it is a tree", () => {
    // `upsertNavTree` matches a root on [menuId, routeKey, parentId: null], so
    // a leftover flat row would be adopted as the tree's root and the header
    // would show one entry with children it did not expect.
    const flat = seed.slice(
      seed.indexOf("const NAV = ["),
      seed.indexOf("];", seed.indexOf("const NAV = [")),
    );
    expect(flat).not.toContain('routeKey: "tools"');
  });
});

describe("the masthead", () => {
  // Both surfaces, not one. The index and the eight tool pages are separate
  // files and the reason they are compact is the same on both — content the
  // reader came for sits directly under the band — so a change that shortens
  // one and forgets the other is the failure worth catching. `PageHero`'s own
  // guard (`about-primitives.test.tsx`) proves `compact` IS the shorter band;
  // this proves these two ask for it.
  it("is the compact banner on the index and on every tool page", () => {
    for (const [name, source] of [
      ["the tools index", indexPage],
      ["the tool shell", shell],
    ] as const) {
      expect(code(source), `${name} does not ask for the compact masthead`).toContain(
        'size="compact"',
      );
    }
  });

  it("sets no `spacing` of its own — density comes from the variant", () => {
    // `PageHero` omits `spacing` from its props, so this is a type error too;
    // the assertion is what a reader of the test file sees, and it is what
    // catches the prop being handed back to callers later.
    for (const source of [indexPage, shell]) {
      expect(code(source)).not.toMatch(/<PageHero[\s\S]*?spacing=/);
    }
  });
});

describe("the area opens one landmark", () => {
  // The layout owns the `<main>`, the way `about/layout.tsx` and
  // `learn/layout.tsx` do. Before that, no page under /tools had one at all:
  // axe reports a missing region as MODERATE, so the suite’s serious/critical
  // gate could not see it, and eight pages shipped with their whole content
  // outside any landmark.
  it("wraps the tools area in a main element", () => {
    expect(code(layout)).toContain("<main");
  });

  it("does not open a second one in a page", () => {
    // Two `main` elements is its own axe violation, and the reason the
    // landmark belongs to the layout rather than to each page.
    for (const [name, source] of [
      ["the tools index", indexPage],
      ["the tool page", toolPage],
      ["the tool shell", shell],
    ] as const) {
      expect(code(source), `${name} opens a second <main>`).not.toContain("<main");
    }
  });
});

// ─── The economic calendar (ADR-115) ─────────────────────────
//
// It is in the Tools panel and is NOT a `TOOLS` member, which is a pair of
// facts that only stay true together if both are asserted. The guard above —
// "the panel names every registered tool" — is unchanged and still correct,
// because the calendar is not one.

describe("the economic calendar is in the menu but not in the registry", () => {
  it("is not a tool", () => {
    expect(TOOL_KEYS).not.toContain("economic-calendar");
    // It keeps its own URL (ADR-050), which is the half a later "just make it
    // the ninth tool" would break.
    expect(ROUTE_PATHS["economic-calendar"]).toBe("/economic-calendar");
  });

  it("sits in the panel's Timing column, beside the two tools that answer 'when'", () => {
    const panel = toolsPanel();
    const timing = panel.slice(panel.indexOf('key: "timing"'), panel.indexOf('key: "rates"'));
    expect(timing, "the Timing column does not list the calendar").toContain('"economic-calendar"');
  });

  it("carries a header glyph, which is silent to omit", () => {
    // `MEGA_MENU_ICONS` is `Partial<Record<RouteKey, LucideIcon>>`, so a
    // missing entry renders a row with no glyph next to eight that have one.
    expect(megaMenu).toContain('"economic-calendar": ');
  });

  it("is seeded as a child of the Tools tree", () => {
    const tree = seed.slice(
      seed.indexOf("const TOOLS_NAV = {"),
      seed.indexOf("  /**\n   * A root row"),
    );
    expect(tree).toContain('routeKey: "economic-calendar"');
  });

  it("is no longer a flat header row, and the seed removes the one that exists", () => {
    const flat = seed.slice(
      seed.indexOf("const NAV = ["),
      seed.indexOf("];", seed.indexOf("const NAV = [")),
    );
    expect(flat).not.toContain('routeKey: "economic-calendar"');
    // An upsert seed never deletes, so an existing database keeps the row
    // unless something says otherwise — and the delete must be SCOPED, since
    // the footer row and the new Tools child share this routeKey.
    expect(seed).toContain('routeKey: "economic-calendar", parentId: null');
  });

  it("keeps its footer row, because a footer is a sitemap", () => {
    const footer = seed.slice(
      seed.indexOf("const FOOTER_MENUS = ["),
      seed.indexOf("] satisfies", seed.indexOf("const FOOTER_MENUS = [")),
    );
    expect(footer).toContain('routeKey: "economic-calendar"');
  });

  it("is a card on the index, appended by the page rather than by the service", () => {
    // ADR-115 #3: `getEnabledTools` reads the `Tool` table and there is no row
    // for the calendar. Teaching the service about one would make the admin
    // list and the drift guard learn the same exception.
    expect(code(indexPage)).toContain('isFeatureVisible("economic_calendar"');
    expect(code(indexPage)).toContain('ROUTE_PATHS["economic-calendar"]');
  });
});

// ─── Market hours (ADR-114 #4) ───────────────────────────────

describe("/tools/market-hours leads with the clock and the overlaps", () => {
  it("dropped the 24-hour timeline", () => {
    // The inverse of the test it replaces, and here for the revert rather than
    // for a deliberate re-add: the timeline is one component away from coming
    // back, and `sessionDaySegments` is still in @repo/utils, still tested.
    expect(code(marketHours)).not.toContain("sessionDaySegments");
    expect(code(marketHours)).not.toContain("nowFraction");
  });

  it("derives the overlaps rather than listing them", () => {
    expect(code(marketHours)).toContain("sessionOverlaps(");
  });

  it("ticks the clock in its own component, not in the widget", () => {
    // `useClientSecond` in the widget would re-run the session arithmetic and
    // every pairwise intersection sixty times a minute to move two digits.
    const widgetBody = marketHours.slice(marketHours.indexOf("export function MarketHoursWidget"));
    expect(widgetBody).not.toContain("useClientSecond");
    expect(marketHours).toContain("function LiveClock");
  });

  it("says how many sessions overlap, never how volatile that is (ADR-088)", () => {
    // The reference's "highest volatility, all major pairs active" is a claim
    // about the market. What we can say is arithmetic on the clock.
    // Through `code()`, for the reason that helper documents: the comment
    // in the widget explaining why it says "how long, not how volatile" uses
    // the word, and read as source it fails the rule it is describing.
    expect(code(marketHours).toLowerCase()).not.toContain("volatil");
    const strings = Object.fromEntries(
      walkStrings((en as { tools: { marketHours: unknown } }).tools.marketHours),
    );
    for (const value of Object.values(strings)) {
      expect(String(value).toLowerCase()).not.toContain("volatil");
    }
  });
});
