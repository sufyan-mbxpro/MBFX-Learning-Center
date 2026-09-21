// The economic calendar's top-level filters (ADR-137 §3).
//
// The reference (`mbfx.co/trading/calendar`) puts a filter row above the
// widget, and the owner asked for the same. What it could NOT be is the
// reference's own three tabs — Economic events / Earnings / Dividends are
// TradingView's internal navigation on `tradingview.com`, not settings the
// embeddable widget accepts, so a tab that promised earnings would open a
// calendar that never shows any. These are the two filters the widget really
// has, which is the honest version of the same control.
//
// Both lists are CODE, for `MARKET_BOARD_GROUPS`' reason (ADR-136 §4): which
// countries count as "Europe" is page composition, not content (ADR-042), and
// a widget URL assembled from anything a user can type is exactly what
// `tradingViewWidgetUrl` exists to prevent (security.md #9).
import type { EventImportance } from "@repo/utils";

export const CALENDAR_IMPORTANCE_KEYS = ["all", "high", "medium", "low"] as const;
export type CalendarImportanceKey = (typeof CALENDAR_IMPORTANCE_KEYS)[number];

/**
 * Our key → the vendor's levels. `-1` is LOW in TradingView's scheme, which
 * reads like a typo and is not: the widget's own filter string is `-1,0,1`.
 */
export const CALENDAR_IMPORTANCE: Record<CalendarImportanceKey, readonly EventImportance[]> = {
  all: [-1, 0, 1],
  high: [1],
  medium: [0],
  low: [-1],
};

export const CALENDAR_REGION_KEYS = ["major", "americas", "europe", "asiaPacific", "all"] as const;
export type CalendarRegionKey = (typeof CALENDAR_REGION_KEYS)[number];

/**
 * Our key → the vendor's country codes.
 *
 * `all` is deliberately EMPTY rather than a list of every code we could think
 * of: an omitted `countryFilter` is the widget's own "everything", and a list
 * we maintain by hand would silently drop whichever economy nobody remembered.
 *
 * `major` leads because it is what a forex reader wants — the eight economies
 * behind the major pairs, in the order the pairs are usually quoted.
 */
export const CALENDAR_REGIONS: Record<CalendarRegionKey, readonly string[]> = {
  major: ["us", "eu", "gb", "jp", "ch", "au", "ca", "nz"],
  americas: ["us", "ca", "br", "mx"],
  europe: ["eu", "gb", "ch", "de", "fr", "it", "es"],
  asiaPacific: ["jp", "cn", "au", "nz", "in", "kr", "sg", "hk"],
  all: [],
};
