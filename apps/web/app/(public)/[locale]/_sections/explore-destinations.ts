// The explore carousel's destination registry.
//
// ADR-042 settles that homepage COMPOSITION is code, so this list is code —
// the same split `_nav/mega-menu.ts` makes for the header (ADR-048): the
// database owns content data, a code registry owns how a surface is composed.
//
// Three things every entry carries, and one thing it deliberately does not:
//
//   routeKey  — resolved through `ROUTE_PATHS`, never a hand-typed href, so a
//               path that moves moves here too.
//   feature   — the flag that governs the destination. A card for a disabled
//               feature is not rendered at all, matching what the header
//               already does with `requiresFeature` and what `LatestAnalysis`
//               does with `isFeatureVisible`.
//   status    — whether the section BEHIND it is built yet.
//
// ...and not a label. Titles, blurbs and alt text are catalog keys
// (code-style.md #2), derived from `key` at the call site.
//
// `status` is the honest half, and what it MEANS changed in changes-22.
//
// It used to mean "there is no page here at all": `/tools` and `/markets` were
// seeded into the header but had no route, so they fell through the
// `[...slug]` catch-all onto the site's 404, and a `soon` card therefore
// rendered as a flat, non-interactive tile rather than link to an error page.
//
// Both now have a real route that renders `ComingSoon` — a page that says what
// the section will do and hands the reader the four finished ones. So `soon`
// no longer means "do not link"; it means "the page behind this explains that
// the section is still being built". The card links like any other, because a
// link to a page that answers for itself is not a broken promise.
//
// `learn` was `soon` until 2026-09-11 and should not have been: `/learn` has
// had a route since changes-11 Phase 4. `explore-destinations.test.ts` still
// checks the claim against the filesystem — every destination must have a page
// file, and a `soon` one must be the page that renders `ComingSoon` — so
// neither half can rot in silence the way the first one did.
import {
  BadgeCheck,
  BookA,
  CalendarDays,
  Calculator,
  GraduationCap,
  LineChart,
  Newspaper,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { ROUTE_PATHS, type RouteKey } from "@repo/contracts";

import type { HomeMediaTone } from "../_components/home-media.tsx";
import type { HomeMediaKey } from "../_content/home-media.ts";

export interface ExploreDestination {
  /** Catalog + media key. `learn` → `home.exploreLearnTitle`, `HOME_MEDIA.learn`. */
  key: HomeMediaKey;
  routeKey: RouteKey;
  icon: LucideIcon;
  /** Feature flag gating the destination; `null` for pages no flag governs. */
  feature: string | null;
  tone: HomeMediaTone;
  /**
   * `soon` marks a destination whose route exists and renders `ComingSoon`
   * — the card still links, and says so. Promoting one means building the
   * section and pointing its route at the real page.
   */
  status: "live" | "soon";
}

export const EXPLORE_DESTINATIONS = [
  {
    key: "learn",
    routeKey: "learn",
    icon: GraduationCap,
    feature: "courses",
    tone: "primary",
    status: "live",
  },
  {
    key: "tools",
    routeKey: "tools",
    icon: Calculator,
    feature: "calculators",
    tone: "info",
    // Live as of changes-25 T6: /tools renders eight tools, not ComingSoon.
    // The guard below reads the route file, so this cannot drift back.
    status: "live",
  },
  {
    key: "calendar",
    routeKey: "economic-calendar",
    icon: CalendarDays,
    feature: "economic_calendar",
    tone: "warning",
    status: "live",
  },
  {
    key: "news",
    routeKey: "news",
    icon: Newspaper,
    feature: "news",
    tone: "destructive",
    status: "live",
  },
  {
    key: "analysis",
    routeKey: "analysis",
    icon: LineChart,
    feature: "analysis",
    tone: "success",
    status: "live",
  },
  {
    key: "glossary",
    routeKey: "glossary",
    icon: BookA,
    feature: "glossary",
    tone: "info",
    status: "live",
  },
  {
    key: "markets",
    routeKey: "markets",
    icon: TrendingUp,
    feature: "market_data",
    tone: "success",
    status: "soon",
  },
  {
    key: "about",
    routeKey: "about",
    icon: BadgeCheck,
    feature: null,
    tone: "muted",
    status: "live",
  },
] as const satisfies readonly ExploreDestination[];

/** The destination's URL. Goes through ROUTE_PATHS so no href is hand-typed. */
export function destinationHref(destination: ExploreDestination): string {
  return ROUTE_PATHS[destination.routeKey];
}

/**
 * Icon-box classes per tone: the `*-interactive` ink on a 10% wash at rest,
 * flipping to the FILL with its derived foreground on hover — the one pairing
 * ADR-003 contrast-checks, and never a hand-authored hover colour
 * (code-style.md #4). Raw `--primary` is not used for a glyph: ADR-018 rule 5.
 */
export const DESTINATION_ICON_CLASS = {
  primary: "bg-primary/10 text-primary-interactive",
  info: "bg-info/10 text-info-interactive",
  success: "bg-success/10 text-success-interactive",
  warning: "bg-warning/10 text-warning-interactive",
  destructive: "bg-destructive/10 text-destructive-interactive",
  muted: "bg-muted-foreground/10 text-muted-foreground",
} as const satisfies Record<HomeMediaTone, string>;

/** The hover flip, applied only on cards that are actually links. */
export const DESTINATION_ICON_HOVER_CLASS = {
  primary: "group-hover:bg-primary group-hover:text-primary-foreground",
  info: "group-hover:bg-info group-hover:text-info-foreground",
  success: "group-hover:bg-success group-hover:text-success-foreground",
  warning: "group-hover:bg-warning group-hover:text-warning-foreground",
  destructive: "group-hover:bg-destructive group-hover:text-destructive-foreground",
  muted: "group-hover:bg-muted-foreground group-hover:text-background",
} as const satisfies Record<HomeMediaTone, string>;

/** The rule that sweeps across the card's top edge on hover. */
export const DESTINATION_BAR_CLASS = {
  primary: "bg-primary",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
} as const satisfies Record<HomeMediaTone, string>;
