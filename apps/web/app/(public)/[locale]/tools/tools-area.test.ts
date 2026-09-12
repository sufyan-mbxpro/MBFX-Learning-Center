// The public tools area's rules (changes-25 T6, ADR-086).
//
// A SOURCE guard, the idiom `apps/web` already uses for its page-level
// assertions (`top-bar-icons.test.ts`, `explore-destinations.test.ts`): this
// app has no jsdom, and every question below is about what a file SAYS rather
// than about what a component renders.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { TOOLS, TOOL_KEYS, toolFlag, toolPath } from "@repo/contracts";
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

describe("the six-band flow lives in ONE place (ADR-086 #9)", () => {
  it("orders the bands in tool-shell, not in the page", () => {
    // Read from the RETURN block only: the props destructured above it list
    // the same names in a different order, and matching those would pin the
    // signature rather than the layout.
    const jsx = shell.slice(shell.indexOf("  return ("));
    const order = ["PageHero", "widget", "body", "faq", "related", "disclaimer"];
    let previous = -1;
    for (const band of order) {
      const at = jsx.indexOf(band);
      expect(at, `tool-shell.tsx renders no "${band}" band`).toBeGreaterThan(-1);
      expect(at, `"${band}" is out of order in tool-shell.tsx`).toBeGreaterThan(previous);
      previous = at;
    }
  });

  it("keeps the page from laying itself out", () => {
    // Eight pages that each compose their own bands become eight layouts
    // within a year. The page supplies slots; the shell orders them.
    expect(toolPage).toContain("<ToolShell");
    expect(code(toolPage)).not.toContain("<PageHero");
    expect(code(toolPage)).not.toContain("<FaqPanel");
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

describe("the section bar", () => {
  it("uses the ONE SectionNav, not a second strip (ADR-076 §1)", () => {
    expect(layout).toContain("SectionNav");
    expect(layout).toContain("_components/section-nav.tsx");
  });

  it("hides itself when it would have a single tab", () => {
    // A row of one tab is chrome that tells the reader nothing — the rule the
    // learn bar and GlossaryTabs already follow.
    expect(layout).toContain("items.length > 1");
  });

  it("lists only ENABLED tools — a disabled one is absent, not disabled", () => {
    expect(layout).toContain("getEnabledTools");
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

describe('never "real-time", never "live" (ADR-088 #7)', () => {
  // The rule nothing static enforced before this test. It is a COPY rule, so
  // the catalog is where it has to be checked.
  const walk = (node: unknown, path: string[] = []): [string, string][] =>
    typeof node === "string"
      ? [[path.join("."), node]]
      : node && typeof node === "object"
        ? Object.entries(node).flatMap(([k, v]) => walk(v, [...path, k]))
        : [];

  const toolsStrings = walk((en as { tools: unknown }).tools);

  it("finds the namespace at all — a silent zero would pass every assertion", () => {
    expect(toolsStrings.length).toBeGreaterThan(30);
  });

  it.each([["real-time"], ["realtime"], ["live rates"], ["live data"]])(
    'says %s nowhere in the tools namespace',
    (phrase) => {
      const offenders = toolsStrings.filter(([, value]) =>
        value.toLowerCase().includes(phrase),
      );
      expect(offenders).toEqual([]);
    },
  );

  it("labels a stale rate in words rather than hiding it", () => {
    expect(rateFootnote).toContain("staleAsOf");
    const strings = Object.fromEntries(toolsStrings);
    expect(strings["common.staleAsOf"]).toMatch(/out of date/i);
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

describe("the tools mega panel", () => {
  it("names EVERY registered tool across its three columns", () => {
    const panel = megaMenu.slice(megaMenu.indexOf("  tools: {"), megaMenu.indexOf('viewAll: "tools"'));
    for (const key of TOOL_KEYS) {
      expect(panel, `the tools panel never lists "${key}"`).toContain(`"tool-${key}"`);
    }
  });

  it("names no tool twice", () => {
    const panel = megaMenu.slice(megaMenu.indexOf("  tools: {"), megaMenu.indexOf('viewAll: "tools"'));
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
    const tree = seed.slice(seed.indexOf("const TOOLS_NAV = {"), seed.indexOf("  /**\n   * A root row"));
    expect(tree.length).toBeGreaterThan(100);
    for (const key of TOOL_KEYS) {
      expect(tree, `the seeded tools menu has no row for "${key}"`).toContain(`"tool-${key}"`);
    }
  });

  it("keeps `tools` out of the FLAT rows now that it is a tree", () => {
    // `upsertNavTree` matches a root on [menuId, routeKey, parentId: null], so
    // a leftover flat row would be adopted as the tree's root and the header
    // would show one entry with children it did not expect.
    const flat = seed.slice(seed.indexOf("const NAV = ["), seed.indexOf("];", seed.indexOf("const NAV = [")));
    expect(flat).not.toContain('routeKey: "tools"');
  });
});
