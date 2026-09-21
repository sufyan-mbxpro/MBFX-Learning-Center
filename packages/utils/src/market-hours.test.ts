// Session clock tests. The instants are FIXED and chosen either side of real
// DST transitions, because the bug this file exists to prevent is the one that
// only appears for a few months of the year.
import { describe, expect, it } from "vitest";

import {
  isMarketOpen,
  nowFraction,
  parseClockTime,
  sessionDaySegments,
  sessionOverlaps,
  sessionState,
  timelineWindow,
  zoneOffsetMinutes,
  zonedParts,
  type SessionSpec,
} from "./market-hours.ts";

const SESSIONS: SessionSpec[] = [
  { name: "Sydney", city: "Sydney", timeZone: "Australia/Sydney", open: "07:00", close: "16:00" },
  { name: "Tokyo", city: "Tokyo", timeZone: "Asia/Tokyo", open: "09:00", close: "18:00" },
  { name: "London", city: "London", timeZone: "Europe/London", open: "08:00", close: "17:00" },
  {
    name: "New York",
    city: "New York",
    timeZone: "America/New_York",
    open: "08:00",
    close: "17:00",
  },
];

describe("parseClockTime", () => {
  it("reads HH:MM as minutes past midnight", () => {
    expect(parseClockTime("00:00")).toBe(0);
    expect(parseClockTime("08:30")).toBe(510);
    expect(parseClockTime("23:59")).toBe(1439);
  });

  it("refuses anything that is not HH:MM", () => {
    expect(() => parseClockTime("8:00")).toThrow(RangeError);
    expect(() => parseClockTime("24:00")).toThrow(RangeError);
    expect(() => parseClockTime("8am")).toThrow(RangeError);
  });
});

describe("zoneOffsetMinutes — DST is derived, never stored", () => {
  it("reads London at UTC+0 in January and UTC+1 in July", () => {
    // The whole reason no offset is a column: the same zone, two answers.
    expect(zoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "Europe/London")).toBe(0);
    expect(zoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "Europe/London")).toBe(60);
  });

  it("reads New York at −5 in January and −4 in July", () => {
    expect(zoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "America/New_York")).toBe(-300);
    expect(zoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "America/New_York")).toBe(-240);
  });

  it("reads Sydney's SOUTHERN summer the other way round", () => {
    // Australia's DST runs opposite to the northern hemisphere's, which is
    // what makes a single hardcoded "summer" offset wrong twice over.
    expect(zoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "Australia/Sydney")).toBe(660);
    expect(zoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "Australia/Sydney")).toBe(600);
  });

  it("reads Tokyo at a constant +9 — it observes no DST at all", () => {
    expect(zoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "Asia/Tokyo")).toBe(540);
    expect(zoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "Asia/Tokyo")).toBe(540);
  });
});

describe("zonedParts", () => {
  it("reads the wall clock in the named zone, not the runtime's", () => {
    const p = zonedParts(new Date("2026-01-15T12:00:00Z"), "Asia/Tokyo");
    expect(p.hour).toBe(21);
    expect(p.day).toBe(15);
  });

  it("reports midnight as hour 0, not hour 24", () => {
    const p = zonedParts(new Date("2026-01-15T00:00:00Z"), "UTC");
    expect(p.hour).toBe(0);
  });

  it("reports the weekday as a 0–6 index", () => {
    // 2026-01-15 is a Thursday.
    expect(zonedParts(new Date("2026-01-15T12:00:00Z"), "UTC").weekday).toBe(4);
  });
});

describe("isMarketOpen — the weekend gap", () => {
  it("is open mid-week", () => {
    expect(isMarketOpen(new Date("2026-01-14T12:00:00Z"))).toBe(true);
  });

  it("is shut at 3am UTC on a Saturday", () => {
    // The case a naive per-session clock gets wrong: Tokyo's window says
    // open, and the market is not.
    expect(isMarketOpen(new Date("2026-01-17T03:00:00Z"))).toBe(false);
  });

  it("is shut through Saturday UTC only until Sydney's Sunday arrives", () => {
    // Not "all day Saturday": Sydney is UTC+11 in January, so 23:00 UTC on
    // Saturday is already 10:00 on Sunday there and the week has restarted.
    // The gap is bounded by two LOCAL edges, and neither of them is a UTC
    // midnight — which is the entire reason this function exists.
    expect(isMarketOpen(new Date("2026-01-17T12:00:00Z"))).toBe(false);
    expect(isMarketOpen(new Date("2026-01-17T23:00:00Z"))).toBe(true);
  });

  it("is shut after the New York Friday close and open before it", () => {
    // 2026-01-16 is a Friday. New York closes at 17:00 local = 22:00 UTC in
    // January.
    expect(isMarketOpen(new Date("2026-01-16T21:00:00Z"))).toBe(true);
    expect(isMarketOpen(new Date("2026-01-16T23:00:00Z"))).toBe(false);
  });

  it("moves the Friday close with New York's own DST", () => {
    // In July the same 17:00 local is 21:00 UTC, so 21:30 UTC is shut in
    // summer and open in winter. A hardcoded UTC edge gets exactly this
    // wrong for half the year.
    expect(isMarketOpen(new Date("2026-07-17T21:30:00Z"))).toBe(false);
    expect(isMarketOpen(new Date("2026-01-16T21:30:00Z"))).toBe(true);
  });

  it("reopens at the Sydney Sunday open, not at UTC midnight", () => {
    // 2026-01-18 is a Sunday. Sydney is UTC+11 in January, so 07:00 Sydney
    // is 20:00 UTC on Saturday the 17th.
    expect(isMarketOpen(new Date("2026-01-17T19:00:00Z"))).toBe(false);
    expect(isMarketOpen(new Date("2026-01-17T21:00:00Z"))).toBe(true);
  });
});

describe("sessionState", () => {
  it("opens London at 08:00 London time and not before", () => {
    const before = sessionState(SESSIONS, new Date("2026-01-14T07:30:00Z"), "UTC");
    const after = sessionState(SESSIONS, new Date("2026-01-14T08:30:00Z"), "UTC");
    expect(before.sessions.find((s) => s.name === "London")!.isOpen).toBe(false);
    expect(after.sessions.find((s) => s.name === "London")!.isOpen).toBe(true);
  });

  it("shifts London's UTC open by an hour in July", () => {
    const july = sessionState(SESSIONS, new Date("2026-07-15T07:30:00Z"), "UTC");
    expect(july.sessions.find((s) => s.name === "London")!.isOpen).toBe(true);
  });

  it("closes every session across the weekend gap, whatever its own clock says", () => {
    const saturday = sessionState(SESSIONS, new Date("2026-01-17T03:00:00Z"), "UTC");
    expect(saturday.sessions.every((s) => !s.isOpen)).toBe(true);
    expect(saturday.openCount).toBe(0);
    expect(saturday.volumeBand).toBe("closed");
    expect(saturday.isMarketOpen).toBe(false);
  });

  it("reports the London/New York overlap as the day's highest band", () => {
    // 13:30 UTC in January: London is open (08:00–17:00 local) and New York
    // has just opened (08:00 local = 13:00 UTC).
    const overlap = sessionState(SESSIONS, new Date("2026-01-14T13:30:00Z"), "UTC", {
      mediumVolumeFrom: 2,
      highVolumeFrom: 2,
    });
    const open = overlap.sessions.filter((s) => s.isOpen).map((s) => s.name);
    expect(open).toContain("London");
    expect(open).toContain("New York");
    expect(overlap.volumeBand).toBe("high");
  });

  it("steps the band down when only one session is open", () => {
    const quiet = sessionState(SESSIONS, new Date("2026-01-14T18:00:00Z"), "UTC", {
      mediumVolumeFrom: 2,
      highVolumeFrom: 3,
    });
    expect(quiet.openCount).toBe(1);
    expect(quiet.volumeBand).toBe("low");
  });

  it("handles a session that wraps midnight in its own zone", () => {
    const wrapping: SessionSpec[] = [
      {
        name: "Overnight",
        city: "Sydney",
        timeZone: "Australia/Sydney",
        open: "21:00",
        close: "06:00",
      },
    ];
    // 22:00 Sydney in January is 11:00 UTC.
    const inside = sessionState(wrapping, new Date("2026-01-14T11:00:00Z"), "UTC");
    expect(inside.sessions[0]!.isOpen).toBe(true);
    // 12:00 Sydney is 01:00 UTC — outside the window.
    const outside = sessionState(wrapping, new Date("2026-01-14T01:00:00Z"), "UTC");
    expect(outside.sessions[0]!.isOpen).toBe(false);
  });

  it("renders the local label in the VIEWER's zone, not the session's", () => {
    const state = sessionState(SESSIONS, new Date("2026-01-14T12:00:00Z"), "Asia/Tokyo");
    const london = state.sessions.find((s) => s.name === "London")!;
    // 08:00 London in January is 17:00 in Tokyo.
    expect(london.localLabel.startsWith("17:00")).toBe(true);
  });

  it("renders a 12-hour label when asked", () => {
    const state = sessionState(SESSIONS, new Date("2026-01-14T12:00:00Z"), "Europe/London", {
      hour12: true,
    });
    const london = state.sessions.find((s) => s.name === "London")!;
    expect(london.localLabel).toMatch(/AM|PM/);
  });

  it("gives every session an opensAt strictly before its closesAt", () => {
    const state = sessionState(SESSIONS, new Date("2026-01-14T12:00:00Z"), "UTC");
    for (const s of state.sessions) expect(s.closesAt).toBeGreaterThan(s.opensAt);
  });
});

describe("the timeline", () => {
  const at = new Date("2026-01-14T12:00:00Z");

  it("spans exactly 24 hours from the viewer's local midnight", () => {
    const w = timelineWindow(at, "UTC");
    expect(w.dayEnd - w.dayStart).toBe(24 * 60 * 60 * 1000);
    expect(new Date(w.dayStart).toISOString()).toBe("2026-01-14T00:00:00.000Z");
  });

  it("places a session as a fraction of the day", () => {
    const w = timelineWindow(at, "UTC");
    const state = sessionState(SESSIONS, at, "UTC");
    const london = state.sessions.find((s) => s.name === "London")!;
    const segments = sessionDaySegments(london, w);
    expect(segments).toHaveLength(1);
    // 08:00–17:00 UTC in January.
    expect(segments[0]!.startFraction).toBeCloseTo(8 / 24, 6);
    expect(segments[0]!.endFraction).toBeCloseTo(17 / 24, 6);
  });

  it("splits a session that crosses the viewer's midnight into two bands", () => {
    // Returned as a list precisely so the renderer never has to know this.
    const w = timelineWindow(at, "UTC");
    const crossing = { opensAt: w.dayStart - 2 * 3600_000, closesAt: w.dayStart + 3 * 3600_000 };
    const segments = sessionDaySegments(crossing, w);
    expect(segments.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps every fraction inside [0, 1]", () => {
    const w = timelineWindow(at, "UTC");
    const state = sessionState(SESSIONS, at, "UTC");
    for (const s of state.sessions) {
      for (const seg of sessionDaySegments(s, w)) {
        expect(seg.startFraction).toBeGreaterThanOrEqual(0);
        expect(seg.endFraction).toBeLessThanOrEqual(1);
        expect(seg.endFraction).toBeGreaterThan(seg.startFraction);
      }
    }
  });

  it("puts the now-marker where the clock is, and nowhere when it is off the window", () => {
    const w = timelineWindow(at, "UTC");
    expect(nowFraction(at, w)).toBeCloseTo(0.5, 6);
    expect(nowFraction(new Date("2026-01-15T12:00:00Z"), w)).toBeNull();
  });
});

describe("sessionOverlaps (ADR-114 #4)", () => {
  // A January instant: London is on GMT, New York on EST, Sydney on AEDT.
  const at = new Date("2026-01-14T12:00:00Z");
  const window = timelineWindow(at, "UTC");
  const states = sessionState(SESSIONS, at, "UTC").sessions;

  const label = (o: { names: [string, string] }) => o.names.join(" + ");

  it("finds the London / New York window and gets its length right", () => {
    const overlaps = sessionOverlaps(states, window, at.getTime());
    const londonNewYork = overlaps.find((o) => label(o) === "London + New York");
    expect(londonNewYork).toBeDefined();
    // London closes 17:00 GMT; New York opens 08:00 EST = 13:00 GMT. Four hours.
    expect(londonNewYork!.durationMinutes).toBe(4 * 60);
    expect(new Date(londonNewYork!.start).toISOString()).toBe("2026-01-14T13:00:00.000Z");
    expect(new Date(londonNewYork!.end).toISOString()).toBe("2026-01-14T17:00:00.000Z");
  });

  it("moves that window when the clocks do — the whole point of deriving it", () => {
    // July: London on BST (+1), New York on EDT (-4). London now closes at
    // 16:00 UTC and New York opens at 12:00 UTC, so the same overlap is an
    // hour earlier and the SAME four hours long. A stored offset gets this
    // wrong twice a year.
    const july = new Date("2026-07-15T12:00:00Z");
    const julyWindow = timelineWindow(july, "UTC");
    const julyStates = sessionState(SESSIONS, july, "UTC").sessions;
    const overlap = sessionOverlaps(julyStates, julyWindow, july.getTime()).find(
      (o) => label(o) === "London + New York",
    );
    expect(overlap).toBeDefined();
    expect(new Date(overlap!.start).toISOString()).toBe("2026-07-15T12:00:00.000Z");
    expect(overlap!.durationMinutes).toBe(4 * 60);
  });

  it("marks the window containing `at` as active, and only that one", () => {
    const overlaps = sessionOverlaps(states, window, at.getTime());
    const active = overlaps.filter((o) => o.isActive);
    // 12:00 UTC: London is open, New York is not (13:00), Tokyo closed at
    // 09:00 UTC. Nothing overlaps at noon.
    expect(active).toHaveLength(0);
    const atThree = sessionOverlaps(states, window, Date.parse("2026-01-14T15:00:00Z"));
    expect(atThree.filter((o) => o.isActive).map(label)).toEqual(["London + New York"]);
  });

  it("reads as a day: sorted by start", () => {
    const overlaps = sessionOverlaps(states, window, at.getTime());
    expect(overlaps.length).toBeGreaterThan(0);
    const starts = overlaps.map((o) => o.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("clips every window to the viewer's own day", () => {
    for (const overlap of sessionOverlaps(states, window, at.getTime())) {
      expect(overlap.start).toBeGreaterThanOrEqual(window.dayStart);
      expect(overlap.end).toBeLessThanOrEqual(window.dayEnd);
      expect(overlap.end).toBeGreaterThan(overlap.start);
    }
  });

  it("finds an overlap that straddles the viewer's midnight", () => {
    // Asia/Tokyo as the viewer's zone puts the Sydney/Tokyo overlap inside
    // the local day and pushes London's into the small hours — the case the
    // three-candidate shift exists for.
    const tokyoWindow = timelineWindow(at, "Asia/Tokyo");
    const tokyoStates = sessionState(SESSIONS, at, "Asia/Tokyo").sessions;
    const overlaps = sessionOverlaps(tokyoStates, tokyoWindow, at.getTime());
    expect(overlaps.map(label)).toContain("Sydney + Tokyo");
    for (const overlap of overlaps) {
      expect(overlap.start).toBeGreaterThanOrEqual(tokyoWindow.dayStart);
      expect(overlap.end).toBeLessThanOrEqual(tokyoWindow.dayEnd);
    }
  });

  it("returns nothing for sessions that never meet", () => {
    const apart = sessionState(
      [
        { name: "A", city: "A", timeZone: "UTC", open: "00:00", close: "06:00" },
        { name: "B", city: "B", timeZone: "UTC", open: "12:00", close: "18:00" },
      ],
      at,
      "UTC",
    ).sessions;
    expect(sessionOverlaps(apart, window, at.getTime())).toEqual([]);
  });

  it("pairs only — three open at once is three pairs, never one triple", () => {
    const three = sessionState(
      [
        { name: "A", city: "A", timeZone: "UTC", open: "08:00", close: "18:00" },
        { name: "B", city: "B", timeZone: "UTC", open: "09:00", close: "17:00" },
        { name: "C", city: "C", timeZone: "UTC", open: "10:00", close: "16:00" },
      ],
      at,
      "UTC",
    ).sessions;
    const overlaps = sessionOverlaps(three, window, at.getTime());
    expect(overlaps.map(label).sort()).toEqual(["A + B", "A + C", "B + C"]);
    for (const overlap of overlaps) expect(overlap.names).toHaveLength(2);
  });
});
