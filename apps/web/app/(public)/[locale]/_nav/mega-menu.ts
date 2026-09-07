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
import { BadgeCheck, Building2, Headset, Scale, ShieldCheck, type LucideIcon } from "lucide-react";
import { ROUTE_PATHS, type RouteKey } from "@repo/contracts";
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
  about: Building2,
  "about-why-us": BadgeCheck,
  "about-transparency": Scale,
  "about-security": ShieldCheck,
  "about-support": Headset,
};

/**
 * Panels, keyed by the TOP-LEVEL item's route key. An item with no entry
 * keeps the plain dropdown it has today — panels arrive section by section
 * as those sections are built, which is the ADR-042 cadence.
 */
export const MEGA_MENU_PANELS = {
  // Three columns and a footer row, no feature rail: the rail's only
  // candidate here is the overview page, which the first column already
  // lists, and a panel that says the same thing twice is worse than a
  // simpler one. The rail stays in the API for the sections whose panels
  // genuinely have promoted destinations.
  about: {
    columns: [
      {
        key: "company",
        titleKey: "mega.about.company",
        routeKeys: ["about", "about-why-us"],
      },
      {
        key: "howWeWork",
        titleKey: "mega.about.howWeWork",
        routeKeys: ["about-transparency", "about-security"],
      },
      {
        key: "help",
        titleKey: "mega.about.help",
        routeKeys: ["about-support"],
      },
    ],
    viewAll: "about",
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
    viewAll: viewAllKey ? (byRouteKey.get(viewAllKey) ?? null) : null,
  };
}
