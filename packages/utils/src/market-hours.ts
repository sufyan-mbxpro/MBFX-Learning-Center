// Forex session clock (Module 13, changes-25 T2) — pure, no I/O, 90% floor.
//
// Two things make this harder than it looks, and both are handled here rather
// than in the widget:
//
//   1. **DST.** A session is "08:00 in Europe/London", which is a different
//      UTC instant in January and in July. A stored UTC offset is wrong twice
//      a year, so `Intl.DateTimeFormat` is the provider of truth and the
//      offset is DERIVED at the instant being asked about.
//   2. **The weekend gap.** The market closes at the New York Friday close and
//      reopens at the Sydney Sunday open. Without that, a naive "is it between
//      open and close in this zone" says Tokyo is open at 3am on Saturday.

/** One session, as `MarketSessionSpec` in @repo/contracts stores it. */
export interface SessionSpec {
  name: string;
  city: string;
  /** An IANA zone, e.g. "Europe/London". */
  timeZone: string;
  /** "HH:MM" in the session's OWN zone. */
  open: string;
  close: string;
}

export type VolumeBand = "closed" | "low" | "medium" | "high";

export interface SessionState {
  name: string;
  city: string;
  timeZone: string;
  isOpen: boolean;
  /** Epoch ms of the session's next (or current) open. */
  opensAt: number;
  /** Epoch ms of the close that pairs with `opensAt`. */
  closesAt: number;
  /** "08:00 – 17:00" rendered in the VIEWER's zone, not the session's. */
  localLabel: string;
}

export interface MarketClockState {
  sessions: SessionState[];
  /** How many sessions are open at `at`. */
  openCount: number;
  volumeBand: VolumeBand;
  /** False across the weekend gap, whatever the individual clocks say. */
  isMarketOpen: boolean;
}

export interface SessionStateOptions {
  /** How many overlapping sessions make the band step up. */
  mediumVolumeFrom?: number;
  highVolumeFrom?: number;
  /** 24-hour by default; 12-hour renders "8:00 AM". */
  hour12?: boolean;
}

const MINUTES_PER_DAY = 24 * 60;
const NEW_YORK = "America/New_York";
const SYDNEY = "Australia/Sydney";

/** Parse "HH:MM" to minutes past midnight. Throws on anything else. */
export function parseClockTime(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new RangeError(`Not an HH:MM time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * The wall-clock parts of `at` in `timeZone`.
 *
 * `Intl.DateTimeFormat` with an explicit `timeZone` is the only correct way to
 * do this in a portable runtime: it applies whatever DST rule was in force at
 * that instant, which is the whole reason no offset is stored anywhere.
 */
export function zonedParts(
  at: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(at).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // "24" is what hour12:false emits for midnight in some ICU versions.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: weekdays.indexOf(parts.weekday ?? "Sun"),
  };
}

/** The zone's offset from UTC, in minutes, at the given instant. */
export function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const p = zonedParts(at, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  // Seconds and ms are not in the parts, so compare on the minute.
  const actual = Math.floor(at.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - actual) / 60_000);
}

/**
 * The epoch ms at which `timeZone`'s wall clock next reads `minutes` past
 * midnight, searching from the day `at` falls on and allowing `dayOffset`
 * whole days either way.
 *
 * The offset is resolved twice — once from a first guess, once from the
 * instant that guess produces — because a DST boundary between the two moves
 * the answer by an hour. Two passes converge for every real zone; a third
 * would only matter for a transition inside the same hour, which no zone has.
 */
function instantAt(at: Date, timeZone: string, minutes: number, dayOffset: number): number {
  const p = zonedParts(at, timeZone);
  const utcMidnight = Date.UTC(p.year, p.month - 1, p.day + dayOffset, 0, 0);
  let guess = utcMidnight + minutes * 60_000;
  for (let pass = 0; pass < 2; pass += 1) {
    const offset = zoneOffsetMinutes(new Date(guess), timeZone);
    const corrected = utcMidnight + minutes * 60_000 - offset * 60_000;
    if (corrected === guess) break;
    guess = corrected;
  }
  return guess;
}

/**
 * Is the FX market open at all?
 *
 * The week runs from the Sydney Sunday open to the New York Friday close.
 * Both edges are evaluated in their own zone, so the gap moves with each
 * zone's DST rather than with a hardcoded UTC pair.
 */
export function isMarketOpen(
  at: Date,
  opts: { openMinutes?: number; closeMinutes?: number } = {},
): boolean {
  const openMinutes = opts.openMinutes ?? 7 * 60; // Sydney 07:00 Sunday
  const closeMinutes = opts.closeMinutes ?? 17 * 60; // New York 17:00 Friday
  const t = at.getTime();

  const sydney = zonedParts(at, SYDNEY);
  const newYork = zonedParts(at, NEW_YORK);

  // Saturday is closed in both zones, always.
  if (sydney.weekday === 6 && newYork.weekday === 6) return false;

  // Sunday in Sydney: open only once the Sunday open has passed there.
  if (sydney.weekday === 0) {
    return t >= instantAt(at, SYDNEY, openMinutes, 0);
  }
  // Friday in New York: open only until the Friday close there.
  if (newYork.weekday === 5) {
    return t < instantAt(at, NEW_YORK, closeMinutes, 0);
  }
  // Saturday in one zone but not the other is the gap's own shoulder: the
  // market is shut between the New York Friday close and the Sydney Sunday
  // open, and both of those have already been decided above.
  if (sydney.weekday === 6 || newYork.weekday === 6) return false;
  return true;
}

/**
 * Per-session state at `at`, plus the overall band.
 *
 * A session whose `close` is at or before its `open` wraps midnight (Sydney
 * 21:00–06:00), which is why the window is computed as a start instant plus a
 * duration rather than as two independent instants.
 */
export function sessionState(
  sessions: readonly SessionSpec[],
  at: Date,
  viewerTimeZone: string,
  options: SessionStateOptions = {},
): MarketClockState {
  const { mediumVolumeFrom = 2, highVolumeFrom = 3, hour12 = false } = options;
  const marketOpen = isMarketOpen(at);
  const now = at.getTime();

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: viewerTimeZone,
    hour12,
    hour: "2-digit",
    minute: "2-digit",
  });

  const states: SessionState[] = sessions.map((session) => {
    const openMinutes = parseClockTime(session.open);
    const closeMinutes = parseClockTime(session.close);
    const durationMinutes =
      closeMinutes > openMinutes ? closeMinutes - openMinutes : closeMinutes + MINUTES_PER_DAY - openMinutes;

    // Yesterday's window can still be running (the wrap case), so both are
    // considered and the one containing `now` wins; otherwise the next one.
    let opensAt = instantAt(at, session.timeZone, openMinutes, -1);
    let closesAt = opensAt + durationMinutes * 60_000;
    if (now >= closesAt) {
      opensAt = instantAt(at, session.timeZone, openMinutes, 0);
      closesAt = opensAt + durationMinutes * 60_000;
      if (now >= closesAt) {
        opensAt = instantAt(at, session.timeZone, openMinutes, 1);
        closesAt = opensAt + durationMinutes * 60_000;
      }
    }

    const withinWindow = now >= opensAt && now < closesAt;
    return {
      name: session.name,
      city: session.city,
      timeZone: session.timeZone,
      // A session inside the weekend gap is not open, whatever its own clock
      // says — this is the rule that stops "Tokyo, open" at 3am on Saturday.
      isOpen: withinWindow && marketOpen,
      opensAt,
      closesAt,
      localLabel: `${formatter.format(new Date(opensAt))} – ${formatter.format(new Date(closesAt))}`,
    };
  });

  const openCount = states.filter((s) => s.isOpen).length;
  const volumeBand: VolumeBand =
    openCount === 0
      ? "closed"
      : openCount >= highVolumeFrom
        ? "high"
        : openCount >= mediumVolumeFrom
          ? "medium"
          : "low";

  return { sessions: states, openCount, volumeBand, isMarketOpen: marketOpen };
}

/** The 24-hour window the timeline draws, in the viewer's own zone. */
export interface TimelineWindow {
  dayStart: number;
  dayEnd: number;
}

/** The viewer's local midnight-to-midnight around `at`. */
export function timelineWindow(at: Date, viewerTimeZone: string): TimelineWindow {
  const dayStart = instantAt(at, viewerTimeZone, 0, 0);
  return { dayStart, dayEnd: dayStart + MINUTES_PER_DAY * 60_000 };
}

/**
 * A session as a fraction of the viewer's 24-hour day, for the timeline band.
 *
 * Returns a list, not one segment, because a session that crosses the viewer's
 * midnight is two bands on one axis — and returning a list is what keeps the
 * renderer from having to know that. Empty when the session does not touch the
 * window at all, which is the correct "draw nothing" rather than a zero-width
 * band.
 */
export function sessionDaySegments(
  state: Pick<SessionState, "opensAt" | "closesAt">,
  window: TimelineWindow,
): { startFraction: number; endFraction: number }[] {
  const { dayStart, dayEnd } = window;
  const span = dayEnd - dayStart;
  const segments: { startFraction: number; endFraction: number }[] = [];
  // The session, and the same session shifted a day either way — a window is
  // 24 hours and no session is longer, so three candidates cover every overlap.
  for (const shift of [-span, 0, span]) {
    const start = Math.max(state.opensAt + shift, dayStart);
    const end = Math.min(state.closesAt + shift, dayEnd);
    if (end > start) {
      segments.push({
        startFraction: (start - dayStart) / span,
        endFraction: (end - dayStart) / span,
      });
    }
  }
  return segments;
}

/** Where "now" sits on the timeline, 0–1, or null when it is off the window. */
export function nowFraction(at: Date, window: TimelineWindow): number | null {
  const t = at.getTime();
  if (t < window.dayStart || t >= window.dayEnd) return null;
  return (t - window.dayStart) / (window.dayEnd - window.dayStart);
}
