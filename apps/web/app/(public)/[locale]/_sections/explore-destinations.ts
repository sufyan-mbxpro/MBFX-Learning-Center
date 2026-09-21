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
//
// `markets` was dropped from the carousel in changes-32, at the owner's ask.
// The ROUTE is untouched — `/markets` still renders `ComingSoon`, and the
// header, the footer and `RESERVED_PATHS` still name it. What changed is that
// the homepage no longer spends a card of its most valuable band advertising
// the one destination that cannot answer yet.
//
// That leaves every entry `live` and the `soon` branch of `DestinationCard`
// currently unreached. It is kept rather than deleted because `status` is a
// claim the test above checks against the filesystem on every run: the branch
// costs a badge, and the alternative is that the next section built ahead of
// its route silently links to a page that apologises in prose instead of
// saying "Coming soon" on the card.
import {
  BookA,
  Calculator,
  GraduationCap,
  LineChart,
  Newspaper,
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

// changes-38: the owner's list, in the owner's order — "learning path, daily
// analysis, market news, trading glossary, trading calculator". The calendar
// card left the band: the calendar lives under Tools (ADR-115), and the Tools
// card already leads there. `HOME_MEDIA.calendar` stays as a keyed file.
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
    key: "analysis",
    routeKey: "analysis",
    icon: LineChart,
    feature: "analysis",
    tone: "success",
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
    key: "glossary",
    routeKey: "glossary",
    icon: BookA,
    feature: "glossary",
    tone: "info",
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
  // The `about` card left with the section it pointed at (changes-33,
  // ADR-109). `/support` did NOT take its place: this band is "explore the
  // PLATFORM" — things a reader can go and use — and a help page is not one
  // of them. Support is in the header and in the footer.
] as const satisfies readonly ExploreDestination[];

/** The destination's URL. Goes through ROUTE_PATHS so no href is hand-typed. */
export function destinationHref(destination: ExploreDestination): string {
  return ROUTE_PATHS[destination.routeKey];
}

/**
 * Icon-box classes per tone. SOLID at rest (changes-43): the badge sits on the
 * card's photograph, and a 10% wash let the picture show straight through it,
 * which is the transparency the owner asked to remove. Each fill carries its
 * engine-derived foreground, the one pairing ADR-003 contrast-checks, and the
 * primary tone uses the white-label `--primary-solid` (ADR-140 §6). Never a
 * hand-authored colour (code-style.md #4).
 */
export const DESTINATION_ICON_CLASS = {
  primary: "bg-primary-solid text-primary-solid-foreground",
  info: "bg-info text-info-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  muted: "bg-muted-foreground text-background",
} as const satisfies Record<HomeMediaTone, string>;

/**
 * The hover response, applied only on cards that are actually links. The fill
 * is already solid, so the badge answers with movement rather than colour.
 */
export const DESTINATION_ICON_HOVER_CLASS = {
  primary: "group-hover:-translate-y-0.5",
  info: "group-hover:-translate-y-0.5",
  success: "group-hover:-translate-y-0.5",
  warning: "group-hover:-translate-y-0.5",
  destructive: "group-hover:-translate-y-0.5",
  muted: "group-hover:-translate-y-0.5",
} as const satisfies Record<HomeMediaTone, string>;
