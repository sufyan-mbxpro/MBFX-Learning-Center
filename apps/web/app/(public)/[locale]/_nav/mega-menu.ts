// The mega-menu panel registry (ADR-048).
//
// The split this file exists to hold:
//
//   DATABASE  — which top-level items exist, their order, their labels and
//               every href. `buildNavigation` still owns all of that, and an
//               admin editing a menu label still changes what the panel says.
//   CODE      — how a panel is COMPOSED: which children group into which
//               column, what icon each carries, whether there is a feature
//               rail, a promo strip or a "view all" row.
//
// `buildNavigation` caps at depth 2 by design (Module 08 SKILL), and a panel
// needs three levels plus per-link icons. Raising the builder to depth 3
// would rebuild the admin composition surface ADR-042 cancelled, so the
// third level lives here instead — which is exactly what ADR-042 means by
// "changing menu composition is a code change".
//
// Children are matched to columns by ROUTE KEY, resolved to the same paths
// `ROUTE_PATHS` gives the menu rows. A child that no column claims is not
// dropped: `resolveMegaMenuPanel` appends it to the last column, so adding a
// page to the seed can never make it invisible in the header.
import {
  Activity,
  ArrowLeftRight,
  Calculator,
  CalendarDays,
  ChartCandlestick,
  Clock,
  Coins,
  Gauge,
  GitFork,
  Grid3x3,
  Newspaper,
  Percent,
  Scale,
  ShieldCheck,
  TrendingUp,
  BookA,
  GraduationCap,
  Headset,
  Layers,
  ListChecks,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  LEARN_TRACK_ROUTE_KEYS,
  ROUTE_PATHS,
  type LearnTrackKey,
  type RouteKey,
} from "@repo/contracts";
import type { MessageKey } from "@repo/i18n";

/** A column heading, and the children that belong under it. */
export interface MegaColumnSpec {
  key: string;
  titleKey: MessageKey<"nav">;
  routeKeys: readonly RouteKey[];
}

export interface MegaPanelSpec {
  /** Children promoted to the gradient rail beside the columns. */
  featureRouteKeys?: readonly RouteKey[];
  columns: readonly MegaColumnSpec[];
  /** The full-width band under the columns. */
  strip?: { titleKey: MessageKey<"nav">; descriptionKey: MessageKey<"nav"> };
  /** The footer row's destination; its label comes from the panel's own item. */
  viewAll?: RouteKey;
}

/** Icon per destination. A key with no entry renders a row without a glyph, never a broken one. */
export const MEGA_MENU_ICONS: Partial<Record<RouteKey, LucideIcon>> = {
  // The learning surfaces (ADR-065 §4). One glyph per SURFACE rather than per
  // track: a forex quiz and a crypto quiz are the same kind of thing, and
  // giving each school its own icon set would make the two panels look like
  // two different sites.
  "learn-forex": GraduationCap,
  "learn-forex-quizzes": ListChecks,
  "learn-forex-videos": Video,
  "learn-forex-glossary": BookA,
  "learn-crypto": GraduationCap,
  "learn-crypto-quizzes": ListChecks,
  "learn-crypto-videos": Video,
  "learn-crypto-glossary": BookA,
  learn: Layers,
  // Support is a row in the header, not a panel (ADR-109): the About section
  // it replaces had five destinations and this has one, and a mega panel over
  // a single page is a popup that says the page's own name.
  support: Headset,
  // The tools (ADR-086, ADR-135). One glyph per tool rather than one for the
  // section: the section bar under /tools lists all eight side by side, and a
  // row of identical icons is a row of no icons.
  "tool-position-size": Calculator,
  "tool-pip-value": Coins,
  "tool-margin": Scale,
  "tool-profit-loss": TrendingUp,
  "tool-risk-reward": ShieldCheck,
  "tool-gain-loss": Percent,
  "tool-pivot-points": GitFork,
  "tool-market-hours": Clock,
  "tool-currency-converter": ArrowLeftRight,
  "tool-correlation": Grid3x3,
  "tool-risk-sentiment": Gauge,
  // Not a tool, and in the panel anyway (ADR-115). It answers "when", which
  // is what the Timing column is for.
  "economic-calendar": CalendarDays,
  // The market boards (ADR-136 §5) and the headline feed (changes-40): in the
  // panel, not in the registry.
  "live-rates": ChartCandlestick,
  volatility: Activity,
  "market-news": Newspaper,
};

/**
 * One school's panel (ADR-076 §2): three headed
 * columns and a "view all" footer, so every mega panel in the header is the
 * same kind of object. Built per track from `LEARN_TRACK_ROUTE_KEYS` rather
 * than typed twice, so "Learn Crypto" cannot be left pointing at forex rows.
 *
 * The footer lands on the school's OWN index, which is what "Learn Forex ·
 * View all" promises. ADR-065 §4 refused a footer because it would have
 * pointed at the umbrella `/learn`; the umbrella stays a labelled row in the
 * last column instead, carrying its own seeded label.
 */
function trackPanel(track: LearnTrackKey): MegaPanelSpec {
  const keys = LEARN_TRACK_ROUTE_KEYS[track];
  return {
    columns: [
      { key: "study", titleKey: "mega.learn.study", routeKeys: [keys.index, keys.videos] },
      {
        key: "practise",
        titleKey: "mega.learn.practise",
        routeKeys: [keys.quizzes, keys.glossary],
      },
      { key: "more", titleKey: "mega.learn.more", routeKeys: ["learn"] },
    ],
    viewAll: keys.index,
  };
}

/**
 * Panels, keyed by the TOP-LEVEL item's route key. An item with no entry
 * keeps the plain dropdown it has today — panels arrive section by section
 * as those sections are built, which is the ADR-042 cadence.
 */
export const MEGA_MENU_PANELS = {
  // The two schools (ADR-065 §4, reshaped by ADR-076 §2).
  "learn-forex": trackPanel("forex"),
  "learn-crypto": trackPanel("crypto"),

  // The eight tools (ADR-086 §9), in the shape ADR-076 §2 settled: three headed
  // columns grouped by what a reader is trying to DO, not by what each tool
  // reads. Someone opening this menu knows they want to size a trade; they do
  // not know, and should not need to know, that two of these need a rate.
  tools: {
    columns: [
      {
        key: "position",
        titleKey: "mega.tools.position",
        // Six since changes-41 (ADR-135): margin, profit and risk are all
        // questions asked while sizing a trade, which is what this column is.
        routeKeys: [
          "tool-position-size",
          "tool-risk-reward",
          "tool-margin",
          "tool-pip-value",
          "tool-profit-loss",
        ],
      },
      {
        key: "timing",
        titleKey: "mega.tools.timing",
        // `economic-calendar` is here and is NOT a `TOOLS` member (ADR-115):
        // it keeps its own URL, flag and vendor widget, and the column's
        // heading is what makes it belong — market hours, pivot periods and a
        // release schedule all answer "when".
        //
        // **`volatility` moved here in changes-40.** The owner asked for the
        // panel to be balanced, and it was 6 / 3 / 5 — a middle column a
        // third the height of its neighbours, with the panel's whole bottom
        // half empty beneath it. Volatility is the one entry that reads
        // equally well under either heading: "how far each pair has been
        // moving" is a question about market CONDITIONS, which is what a
        // reader is asking when they look at session hours. That leaves
        // 6 / 4 / 5 with the new headline feed, and no row filed somewhere a
        // reader would not look for it — which a forced 5 / 5 / 5 would have
        // needed.
        //
        // **5 / 5 / 5 since changes-49** (owner: five tools in each column).
        // `gain-loss` moved here from Position & risk: it is the one sizing
        // tool asked AFTER a trade rather than before it — how an account
        // performed over a period — and the heading became Timing &
        // performance so it is not filed under a word that excludes it.
        // (No double quotes in this comment: changes-40-fixes.test.ts counts
        // every quoted run in the column as a destination.)
        routeKeys: [
          "tool-market-hours",
          "tool-pivot-points",
          "economic-calendar",
          "volatility",
          "tool-gain-loss",
        ],
      },
      {
        key: "rates",
        titleKey: "mega.tools.rates",
        // The market boards join the column that already reads prices
        // (ADR-136 §5), and the headline feed joins them (changes-40): the
        // owner asked for "Around the markets" here by name, and it belongs —
        // this column is where a reader goes to find out what the market is
        // doing rather than to calculate something about their own trade.
        // Like the boards, it is NOT a `TOOLS` member.
        routeKeys: [
          "live-rates",
          "tool-currency-converter",
          "tool-correlation",
          "tool-risk-sentiment",
          "market-news",
        ],
      },
    ],
    // The footer the schools carry (changes-43): the owner asked for this
    // panel to look like Learn Forex's, and the footer band is the visible
    // difference. It used to be declared and never render (changes-33),
    // because the key resolved only against CHILD rows and the seeded tree has
    // no `tools` child; `resolveMegaMenuPanel` now also takes the panel's own
    // top-level item, which IS `/tools`.
    viewAll: "tools",
  },
} as const satisfies Partial<Record<RouteKey, MegaPanelSpec>>;

export type MegaMenuRouteKey = keyof typeof MEGA_MENU_PANELS;

/** Path → route key, so a NavItem (which carries only an href) can find its spec. */
const PATH_TO_ROUTE_KEY = new Map<string, RouteKey>(
  (Object.entries(ROUTE_PATHS) as [RouteKey, string][]).map(([key, path]) => [path, key]),
);

export function routeKeyForHref(href: string): RouteKey | null {
  return PATH_TO_ROUTE_KEY.get(href) ?? null;
}

export function panelForHref(href: string): MegaPanelSpec | null {
  const key = routeKeyForHref(href);
  if (!key) return null;
  return (MEGA_MENU_PANELS as Partial<Record<RouteKey, MegaPanelSpec>>)[key] ?? null;
}

/** The minimum a resolved child needs to render — a slice of NavItem, not a copy of it. */
export interface MegaResolvableItem {
  id: string;
  label: string;
  title: string | null;
  href: string;
  isExternal: boolean;
  openInNewTab: boolean;
}

export interface ResolvedMegaColumn<T extends MegaResolvableItem> {
  key: string;
  titleKey: MessageKey<"nav">;
  items: { item: T; icon: LucideIcon | undefined }[];
}

export interface ResolvedMegaPanel<T extends MegaResolvableItem> {
  features: { item: T; icon: LucideIcon | undefined }[];
  columns: ResolvedMegaColumn<T>[];
  strip: MegaPanelSpec["strip"];
  viewAll: T | null;
}

/**
 * Binds a panel spec to the live menu children.
 *
 * Two guarantees, both load-bearing: a child the spec does not mention still
 * appears (appended to the final column), and a spec entry with no matching
 * child is skipped silently. Neither a database edit nor a code edit alone
 * can make a destination disappear from the header.
 */
export function resolveMegaMenuPanel<T extends MegaResolvableItem>(
  spec: MegaPanelSpec,
  children: readonly T[],
  /**
   * The top-level item that owns the panel. `viewAll` resolves against it
   * when no child row carries the key: a section's footer usually points at
   * the section itself, and the seed does not list a section as its own child.
   */
  parent?: T,
): ResolvedMegaPanel<T> {
  const byRouteKey = new Map<RouteKey, T>();
  const unclaimed: T[] = [];
  for (const child of children) {
    const key = routeKeyForHref(child.href);
    if (key && !byRouteKey.has(key)) byRouteKey.set(key, child);
    else unclaimed.push(child);
  }

  const decorate = (item: T) => {
    const key = routeKeyForHref(item.href);
    return { item, icon: key ? MEGA_MENU_ICONS[key] : undefined };
  };

  const featureKeys = new Set(spec.featureRouteKeys ?? []);
  const features = [...featureKeys]
    .map((key) => byRouteKey.get(key))
    .filter((item): item is T => item !== undefined)
    .map(decorate);

  const columns: ResolvedMegaColumn<T>[] = spec.columns.map((column) => ({
    key: column.key,
    titleKey: column.titleKey,
    items: column.routeKeys
      .map((key) => byRouteKey.get(key))
      .filter((item): item is T => item !== undefined)
      .map(decorate),
  }));

  // Anything the spec never named — a page added to the seed ahead of its
  // column — lands in the last column rather than vanishing.
  const claimed = new Set<string>([
    ...features.map((f) => f.item.id),
    ...columns.flatMap((c) => c.items.map((i) => i.item.id)),
  ]);
  const leftovers = [...children.filter((c) => !claimed.has(c.id)), ...unclaimed].filter(
    (item, index, all) => all.findIndex((other) => other.id === item.id) === index,
  );
  const lastColumn = columns.at(-1);
  if (leftovers.length > 0 && lastColumn) lastColumn.items.push(...leftovers.map(decorate));

  const viewAllKey = spec.viewAll;
  return {
    features,
    columns: columns.filter((column) => column.items.length > 0),
    strip: spec.strip,
    viewAll: viewAllKey
      ? (byRouteKey.get(viewAllKey) ??
        (parent && routeKeyForHref(parent.href) === viewAllKey ? parent : null))
      : null,
  };
}
