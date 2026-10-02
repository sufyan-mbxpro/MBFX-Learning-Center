import { afterEach, describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  getSiteTimeZone,
  isValidTimeZone,
  setSiteTimeZone,
  toZonedInput,
  zonedInputAtHour,
  zonedInputToIso,
} from "./date-format.ts";

// Mid-day UTC, so the calendar day is the same in every zone CI might run in.
const NOON = "2026-09-18T12:00:00.000Z";

describe("formatDate", () => {
  it("renders a human date, never ISO", () => {
    expect(formatDate(new Date(NOON))).toBe("Sep 18, 2026");
  });

  it("accepts an ISO string or epoch millis", () => {
    expect(formatDate(NOON)).toBe("Sep 18, 2026");
    expect(formatDate(Date.parse(NOON))).toBe("Sep 18, 2026");
  });

  it("returns an empty string for an unparseable input instead of throwing", () => {
    expect(formatDate("not a date")).toBe("");
    expect(formatDateTime(new Date(Number.NaN))).toBe("");
  });

  it("honours the locale", () => {
    expect(formatDate(NOON, "de")).toBe("18.09.2026");
  });
});

describe("formatDateTime", () => {
  it("adds a short time and contains no ISO markers", () => {
    const out = formatDateTime(NOON);
    expect(out).toMatch(/^Sep 18, 2026, \d{1,2}:\d{2}\s?(AM|PM)$/);
    expect(out).not.toMatch(/T\d{2}:|Z$/);
  });
});

// ADR-182 — the site's timezone.
describe("site timezone", () => {
  const INSTANT = "2026-09-18T04:00:00.000Z";

  afterEach(() => setSiteTimeZone(undefined));

  it("formats in the site's zone once one is set", () => {
    setSiteTimeZone("Asia/Karachi"); // UTC+5, no DST
    expect(formatDateTime(INSTANT)).toBe("Sep 18, 2026, 9:00 AM");
    setSiteTimeZone("America/New_York"); // UTC-4 in September
    expect(formatDateTime(INSTANT)).toBe("Sep 18, 2026, 12:00 AM");
    // The day itself moves across midnight, not just the hour.
    expect(formatDate("2026-09-18T02:00:00.000Z")).toBe("Sep 17, 2026");
  });

  it("an explicit zone wins over the site's", () => {
    setSiteTimeZone("Asia/Karachi");
    expect(formatDateTime(INSTANT, "en", "UTC")).toBe("Sep 18, 2026, 4:00 AM");
  });

  it("an unknown or empty zone clears it instead of throwing", () => {
    setSiteTimeZone("Mars/Olympus_Mons");
    expect(getSiteTimeZone()).toBeUndefined();
    setSiteTimeZone("UTC");
    setSiteTimeZone("");
    expect(getSiteTimeZone()).toBeUndefined();
    expect(isValidTimeZone("Europe/London")).toBe(true);
  });

  it("round-trips picker input through the site's zone", () => {
    setSiteTimeZone("Asia/Karachi");
    expect(toZonedInput(INSTANT)).toBe("2026-09-18T09:00");
    expect(zonedInputToIso("2026-09-18T09:00")).toBe(INSTANT);
  });

  it("resolves the offset in force on the DAY typed, across DST", () => {
    // London is UTC+0 in January and UTC+1 in July.
    expect(zonedInputToIso("2026-01-15T09:00", "Europe/London")).toBe("2026-01-15T09:00:00.000Z");
    expect(zonedInputToIso("2026-07-15T09:00", "Europe/London")).toBe("2026-07-15T08:00:00.000Z");
    expect(toZonedInput("2026-07-15T08:00:00.000Z", "Europe/London")).toBe("2026-07-15T09:00");
  });

  it("returns empty for input that does not parse", () => {
    expect(zonedInputToIso("", "UTC")).toBe("");
    expect(zonedInputToIso("tomorrow", "UTC")).toBe("");
    expect(toZonedInput("nope", "UTC")).toBe("");
  });

  it("builds the presets from TODAY in the site's zone", () => {
    // 22:00 UTC on the 18th is already the 19th in Karachi.
    const from = new Date("2026-09-18T22:00:00.000Z");
    expect(zonedInputAtHour(1, 9, from, "Asia/Karachi")).toBe("2026-09-20T09:00");
    expect(zonedInputAtHour(7, 9, from, "UTC")).toBe("2026-09-25T09:00");
    // Month and year roll over.
    expect(zonedInputAtHour(1, 9, new Date("2026-12-31T12:00:00Z"), "UTC")).toBe(
      "2027-01-01T09:00",
    );
  });
});
