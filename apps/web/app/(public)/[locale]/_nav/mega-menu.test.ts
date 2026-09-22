// Mega-menu registry tests (ADR-048, changes-09-plan.md PR 3).
//
// The registry is DATA that names two things it does not own: route keys
// from `@repo/contracts` and message keys from the catalog. TypeScript
// covers the first (`satisfies Partial<Record<RouteKey, …>>`) and the
// second (`MessageKey<"nav">`), but only for keys spelled in this file —
// so these tests cover the runtime half: that the named keys still RESOLVE
// against the live registry and the live catalog, and that binding a spec
// to real menu rows cannot make a destination disappear.
import { describe, expect, it } from "vitest";
import {
  isRouteKey,
  learnTrackPath,
  LEARN_TRACK_KEYS,
  LEARN_TRACK_SURFACES,
  ROUTE_PATHS,
} from "@repo/contracts";
import en from "@repo/i18n/messages/en.json";
import {
  MEGA_MENU_ICONS,
  MEGA_MENU_PANELS,
  panelForHref,
  resolveMegaMenuPanel,
  routeKeyForHref,
  type MegaPanelSpec,
  type MegaResolvableItem,
} from "./mega-menu.ts";

/** Reads a dotted key out of a catalog namespace, the way `t()` would. */
function lookup(namespace: Record<string, unknown>, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined,
      namespace,
    );
}

const PANELS = Object.entries(MEGA_MENU_PANELS) as [string, MegaPanelSpec][];

describe("MEGA_MENU_PANELS — the registry names only things that exist", () => {
  it("every panel is keyed by a registered route key", () => {
    for (const [key] of PANELS) expect(isRouteKey(key)).toBe(true);
  });

  it("every column, feature and view-all target is a registered route key", () => {
    for (const [, panel] of PANELS) {
      for (const column of panel.columns) {
        for (const routeKey of column.routeKeys) expect(isRouteKey(routeKey)).toBe(true);
      }
      for (const routeKey of panel.featureRouteKeys ?? []) expect(isRouteKey(routeKey)).toBe(true);
      if (panel.viewAll) expect(isRouteKey(panel.viewAll)).toBe(true);
    }
  });

  // The typo'd-key silent-blank bug, killed the same way Module 03 kills the
  // typo'd-permission silent-403: check the string against the real catalog.
  it("every catalog key a panel names resolves in en.json", () => {
    for (const [, panel] of PANELS) {
      for (const column of panel.columns) {
        expect(lookup(en.nav, column.titleKey), column.titleKey).toBeTypeOf("string");
      }
      if (panel.strip) {
        expect(lookup(en.nav, panel.strip.titleKey)).toBeTypeOf("string");
        expect(lookup(en.nav, panel.strip.descriptionKey)).toBeTypeOf("string");
      }
    }
    expect(lookup(en.nav, "mega.viewAll")).toBeTypeOf("string");
  });

  it("every icon entry is keyed by a registered route key", () => {
    for (const key of Object.keys(MEGA_MENU_ICONS)) expect(isRouteKey(key)).toBe(true);
  });
});

describe("panelForHref / routeKeyForHref", () => {
  it("maps a menu href back to its route key", () => {
    expect(routeKeyForHref(ROUTE_PATHS.tools)).toBe("tools");
    expect(routeKeyForHref("/tools/pip-value")).toBe("tool-pip-value");
  });

  it("returns null for an href no registry entry claims", () => {
    expect(routeKeyForHref("https://example.com")).toBeNull();
    expect(panelForHref("/glossary")).toBeNull();
  });

  it("finds the Tools panel from the Tools item's href", () => {
    expect(panelForHref("/tools")).not.toBeNull();
  });

  // ADR-109 withdrew the About section. Its keys left ROUTE_PATHS with it, so
  // an href that still points there resolves to nothing rather than to a panel
  // whose columns name pages that no longer exist.
  it("claims nothing for the withdrawn sections", () => {
    for (const href of ["/about", "/about/support", "/markets"]) {
      expect(routeKeyForHref(href), href).toBeNull();
      expect(panelForHref(href), href).toBeNull();
    }
  });
});

function child(routeKey: keyof typeof ROUTE_PATHS, label: string): MegaResolvableItem {
  return {
    id: routeKey,
    label,
    title: `${label} description`,
    href: ROUTE_PATHS[routeKey],
    isExternal: false,
    openInNewTab: false,
  };
}

describe("resolveMegaMenuPanel — binding the spec to live menu rows", () => {
  // Exercised against the TOOLS panel since ADR-109 withdrew About. It is the
  // same object: three headed columns and a view-all footer, ADR-076 §2's
  // shape — which is the point of having settled on one shape.
  const TOOL_CHILDREN = [
    child("tool-position-size", "Position Size"),
    child("tool-pip-value", "Pip Value"),
    child("tool-margin", "Margin"),
    child("tool-profit-loss", "Profit & Loss"),
    child("tool-risk-reward", "Risk & Reward"),
    child("tool-gain-loss", "Gain & Loss"),
    child("tool-market-hours", "Market Hours"),
    child("tool-pivot-points", "Pivot Points"),
    child("tool-currency-converter", "Currency Converter"),
    child("tool-correlation", "Correlation"),
    child("tool-risk-sentiment", "Risk Sentiment"),
  ];

  it("groups the seeded children into the registry's columns, in registry order", () => {
    const resolved = resolveMegaMenuPanel(MEGA_MENU_PANELS.tools, TOOL_CHILDREN);
    expect(resolved.columns.map((c) => c.key)).toEqual(["position", "timing", "rates"]);
    expect(resolved.columns[0]?.items.map((i) => i.item.label)).toEqual([
      "Position Size",
      "Risk & Reward",
      "Margin",
      "Pip Value",
      "Profit & Loss",
    ]);
    // changes-49: 5 / 5 / 5 — gain-loss closes the timing column.
    expect(resolved.columns[1]?.items.at(-1)?.item.label).toBe("Gain & Loss");
  });

  // changes-43. The owner asked for this panel to match Learn Forex's, whose
  // visible difference is the footer band. It resolves against the panel's
  // own top-level item, because the seeded tools tree has no `tools` child
  // (the reason changes-33 found the old declaration never rendered).
  it("renders a view-all footer that resolves to the section itself", () => {
    expect(MEGA_MENU_PANELS.tools).toHaveProperty("viewAll", "tools");

    const parent = child("tools", "Tools");
    const viaParent = resolveMegaMenuPanel(MEGA_MENU_PANELS.tools, TOOL_CHILDREN, parent);
    expect(viaParent.viewAll?.href).toBe("/tools");

    // Without the parent it still needs a child row, as before.
    expect(resolveMegaMenuPanel(MEGA_MENU_PANELS.tools, TOOL_CHILDREN).viewAll).toBeNull();

    // A parent for a DIFFERENT section never satisfies the key.
    const stranger = resolveMegaMenuPanel(
      MEGA_MENU_PANELS.tools,
      TOOL_CHILDREN,
      child("glossary", "Glossary"),
    );
    expect(stranger.viewAll).toBeNull();
  });

  it("carries each row's icon and its one-line description", () => {
    const resolved = resolveMegaMenuPanel(MEGA_MENU_PANELS.tools, TOOL_CHILDREN);
    const first = resolved.columns[0]?.items[0];
    expect(first?.icon).toBeDefined();
    expect(first?.item.title).toBe("Position Size description");
  });

  // The guarantee that matters operationally: a page added to the seed
  // before anyone updates this registry must still be reachable.
  it("appends a child no column claims rather than dropping it", () => {
    const extra = child("glossary", "Glossary");
    const resolved = resolveMegaMenuPanel(MEGA_MENU_PANELS.tools, [...TOOL_CHILDREN, extra]);
    const allLabels = resolved.columns.flatMap((c) => c.items.map((i) => i.item.label));
    expect(allLabels).toContain("Glossary");
    expect(allLabels).toHaveLength(TOOL_CHILDREN.length + 1);
  });

  it("skips a column whose children are all missing, instead of rendering an empty heading", () => {
    const resolved = resolveMegaMenuPanel(MEGA_MENU_PANELS.tools, [
      child("tool-position-size", "Position Size"),
    ]);
    expect(resolved.columns.map((c) => c.key)).toEqual(["position"]);
  });

  it("resolves a feature rail when a spec declares one", () => {
    const spec: MegaPanelSpec = {
      featureRouteKeys: ["tool-position-size"],
      columns: [{ key: "c", titleKey: "mega.tools.position", routeKeys: ["tool-pip-value"] }],
    };
    const resolved = resolveMegaMenuPanel(spec, TOOL_CHILDREN.slice(0, 2));
    expect(resolved.features.map((f) => f.item.label)).toEqual(["Position Size"]);
    expect(resolved.columns[0]?.items.map((i) => i.item.label)).toEqual(["Pip Value"]);
  });

  it("returns no view-all target when the spec omits one", () => {
    const spec: MegaPanelSpec = {
      columns: [{ key: "c", titleKey: "mega.tools.position", routeKeys: ["tool-position-size"] }],
    };
    expect(resolveMegaMenuPanel(spec, TOOL_CHILDREN).viewAll).toBeNull();
  });
});

// ─── The track panels (ADR-065 §4) ───────────────────────────
//
// Two panels built from the same shape, one per school. What is worth pinning
// beyond the generic loops above is that each one lists ITS OWN track's three
// surfaces — a copy-paste that left "Learn Crypto" pointing at forex quizzes
// would pass every check in this file except this one.
describe("MEGA_MENU_PANELS — the schools", () => {
  it("gives every registered track a panel", () => {
    for (const track of LEARN_TRACK_KEYS) {
      expect(panelForHref(learnTrackPath(track)), track).not.toBeNull();
    }
  });

  it("lists only that track's surfaces, then the umbrella", () => {
    for (const track of LEARN_TRACK_KEYS) {
      const panel = panelForHref(learnTrackPath(track));
      const keys = panel?.columns.flatMap((column) => column.routeKeys) ?? [];
      // Built from the registry rather than typed here, so a fifth surface
      // fails in ONE place with a message that names it — the lesson
      // ADR-068 Consequences records about hardcoded surface lists.
      expect(keys).toEqual([
        ...LEARN_TRACK_SURFACES.map((surface) =>
          surface === "index" ? `learn-${track}` : `learn-${track}-${surface}`,
        ),
        "learn",
      ]);
    }
  });

  // ADR-076 §2: the footer lands on the school's OWN index — what "Learn Forex
  // · View all" promises. ADR-065 §4 refused a footer only because it would
  // have pointed at the umbrella page covering both schools.
  it("declares a view-all footer on the track's own index, never the umbrella", () => {
    for (const track of LEARN_TRACK_KEYS) {
      const viewAll = panelForHref(learnTrackPath(track))?.viewAll;
      expect(viewAll).toBe(`learn-${track}`);
      expect(viewAll).not.toBe("learn");
    }
  });

  // ADR-076 §2's shape: three headed columns, so the popup renders `wide`
  // rather than as a one-column list (site-nav.tsx's size rule). Measured
  // against the Tools panel since ADR-109 withdrew About — every panel in the
  // header is meant to be the same object, and comparing two of them is what
  // catches one drifting.
  it("is a multi-column panel, the same shape as Tools", () => {
    for (const track of LEARN_TRACK_KEYS) {
      const columns = panelForHref(learnTrackPath(track))?.columns ?? [];
      expect(columns.length).toBe(MEGA_MENU_PANELS.tools.columns.length);
    }
  });

  it("resolves against live menu rows the way the seed builds them", () => {
    const children: MegaResolvableItem[] = [
      child("learn-forex", "Courses"),
      child("learn-forex-videos", "Videos"),
      child("learn-forex-quizzes", "Quizzes"),
      child("learn-forex-glossary", "Glossary"),
      child("learn", "All learning"),
    ];
    const resolved = resolveMegaMenuPanel(MEGA_MENU_PANELS["learn-forex"], children);
    expect(resolved.columns.map((c) => c.items.map((i) => i.item.label))).toEqual([
      ["Courses", "Videos"],
      ["Quizzes", "Glossary"],
      ["All learning"],
    ]);
    // Every row carries a glyph: the panel's rows are icon + label + one line,
    // and a single missing icon reads as a broken row rather than a plain one.
    expect(resolved.columns.flatMap((c) => c.items).every((i) => i.icon !== undefined)).toBe(true);
    expect(resolved.columns.at(-1)?.items.at(-1)?.item.href).toBe(ROUTE_PATHS.learn);
    expect(resolved.viewAll?.href).toBe(ROUTE_PATHS["learn-forex"]);
  });
});
