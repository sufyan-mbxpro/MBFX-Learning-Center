// The site's one date format.
//
// Every date a person reads — admin tables, editor status panels, public
// bylines — goes through these two functions, so "when" looks the same on
// every screen: `Sep 18, 2026` for a day, `Sep 18, 2026, 4:00 AM` for a moment.
// Before this, ~25 call sites each built their own `Intl.DateTimeFormat` and a
// few printed `toISOString()` straight to the screen, which is how an editor
// ended up showing `2026-09-18T04:00:00.000Z`.
//
// Machine-read timestamps are NOT this helper's job: `<time dateTime>`, JSON-LD,
// OpenGraph, CSV exports and API bodies keep ISO 8601.

export const DATE_FORMAT_OPTIONS = {
  dateStyle: "medium",
} as const satisfies Intl.DateTimeFormatOptions;

export const DATE_TIME_FORMAT_OPTIONS = {
  dateStyle: "medium",
  timeStyle: "short",
} as const satisfies Intl.DateTimeFormatOptions;

type DateInput = Date | string | number;

// Constructing an Intl formatter is the expensive half; a table of 50 rows
// would otherwise build 50 of them.
const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, withTime: boolean): Intl.DateTimeFormat {
  const key = `${locale}|${withTime ? "dt" : "d"}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = new Intl.DateTimeFormat(
      locale,
      withTime ? DATE_TIME_FORMAT_OPTIONS : DATE_FORMAT_OPTIONS,
    );
    cache.set(key, hit);
  }
  return hit;
}

function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * `formatDate(new Date("2026-09-18T04:00:00Z"))` → "Sep 18, 2026".
 *
 * An unparseable input returns "" rather than throwing — `Intl` raises a
 * RangeError on an invalid Date, and a bad timestamp should not take a page
 * down with it.
 */
export function formatDate(value: DateInput, locale = "en"): string {
  const date = toDate(value);
  return date ? formatter(locale, false).format(date) : "";
}

/** `formatDateTime(new Date("2026-09-18T04:00:00Z"))` → "Sep 18, 2026, 4:00 AM" (in the runtime's zone). */
export function formatDateTime(value: DateInput, locale = "en"): string {
  const date = toDate(value);
  return date ? formatter(locale, true).format(date) : "";
}
