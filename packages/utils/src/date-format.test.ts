import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./date-format.ts";

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
