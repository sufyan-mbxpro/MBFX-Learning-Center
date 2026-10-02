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
//
// ADR-182: "when" is read in the SITE's timezone (Settings → General →
// Default timezone), on both surfaces. It is a module-level value because the
// setting is one value for the whole site and these functions are called from
// ~50 places, server and client alike; `setSiteTimeZone` is called by the
// app's root layouts on the server and by a small client component in the
// browser. Unset, everything falls back to the runtime's own zone — the
// behaviour before ADR-182, and what a unit test or a script gets.
import { zonedParts, zoneOffsetMinutes } from "./market-hours.ts";

export const DATE_FORMAT_OPTIONS = {
  dateStyle: "medium",
} as const satisfies Intl.DateTimeFormatOptions;

export const DATE_TIME_FORMAT_OPTIONS = {
  dateStyle: "medium",
  timeStyle: "short",
} as const satisfies Intl.DateTimeFormatOptions;

type DateInput = Date | string | number;

let siteTimeZone: string | undefined;

/** Is `timeZone` an IANA zone this runtime knows? `Intl` throws a RangeError otherwise. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Set the zone every date on the site is read in (ADR-182). An empty or
 * unknown zone CLEARS it rather than throwing: a bad stored value must not
 * take every page that prints a date down with it.
 */
export function setSiteTimeZone(timeZone: string | null | undefined): void {
  siteTimeZone = timeZone && isValidTimeZone(timeZone) ? timeZone : undefined;
}

/** The site's zone, or `undefined` when none is set (the runtime's own zone applies). */
export function getSiteTimeZone(): string | undefined {
  return siteTimeZone;
}

// Constructing an Intl formatter is the expensive half; a table of 50 rows
// would otherwise build 50 of them.
const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(
  locale: string,
  withTime: boolean,
  timeZone: string | undefined,
): Intl.DateTimeFormat {
  const key = `${locale}|${withTime ? "dt" : "d"}|${timeZone ?? ""}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = new Intl.DateTimeFormat(locale, {
      ...(withTime ? DATE_TIME_FORMAT_OPTIONS : DATE_FORMAT_OPTIONS),
      ...(timeZone ? { timeZone } : {}),
    });
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
export function formatDate(value: DateInput, locale = "en", timeZone = siteTimeZone): string {
  const date = toDate(value);
  return date ? formatter(locale, false, timeZone).format(date) : "";
}

/** `formatDateTime(new Date("2026-09-18T04:00:00Z"))` → "Sep 18, 2026, 4:00 AM" (in the site's zone). */
export function formatDateTime(value: DateInput, locale = "en", timeZone = siteTimeZone): string {
  const date = toDate(value);
  return date ? formatter(locale, true, timeZone).format(date) : "";
}

// ─── Wall-clock input ("YYYY-MM-DDTHH:mm") ↔ instant ──────────────────────
//
// The admin's date-time picker keeps the `datetime-local` wire format: a
// wall-clock time with no zone. Which zone it MEANS used to be the editor's
// browser (`new Date(local)`), while the same instant was printed back in the
// server's — so a schedule typed as 09:00 could read 04:00 after saving.
// Both directions now go through the site's zone.

const pad = (n: number) => String(n).padStart(2, "0");

function wallClock(year: number, month: number, day: number, hour: number, minute: number) {
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

/** An instant as the picker's "YYYY-MM-DDTHH:mm", read in `timeZone`. "" for an invalid date. */
export function toZonedInput(value: DateInput, timeZone = siteTimeZone): string {
  const date = toDate(value);
  if (!date) return "";
  if (!timeZone) {
    return wallClock(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
    );
  }
  const p = zonedParts(date, timeZone);
  return wallClock(p.year, p.month, p.day, p.hour, p.minute);
}

const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/**
 * The picker's "YYYY-MM-DDTHH:mm", read as a wall clock in `timeZone`, as an
 * ISO instant. "" for anything that does not parse.
 *
 * The offset is resolved twice, as `market-hours.ts`'s `instantAt` does: a DST
 * boundary between the first guess and the instant it produces moves the
 * answer by an hour. A wall time that does not exist (the hour skipped in
 * spring) lands an hour later, which is what a person typing it meant.
 */
export function zonedInputToIso(local: string, timeZone = siteTimeZone): string {
  const match = INPUT_PATTERN.exec(local);
  if (!match) return "";
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  if (!timeZone) {
    const date = new Date(y, mo - 1, d, h, mi);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  let guess = asUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    const corrected = asUtc - zoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
    if (corrected === guess) break;
    guess = corrected;
  }
  return new Date(guess).toISOString();
}

/**
 * "`days` from today at `hour`:00" in `timeZone`, as picker input — the
 * "Tomorrow 9:00" and "Next week" presets. Today is `from`'s day in that zone,
 * not the editor's.
 */
export function zonedInputAtHour(
  days: number,
  hour: number,
  from: Date = new Date(),
  timeZone = siteTimeZone,
): string {
  if (!timeZone) {
    const d = new Date(from);
    d.setDate(d.getDate() + days);
    return wallClock(d.getFullYear(), d.getMonth() + 1, d.getDate(), hour, 0);
  }
  const p = zonedParts(from, timeZone);
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return wallClock(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hour, 0);
}
