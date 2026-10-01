import { describe, expect, it } from "vitest";

import { formatDurationParts, formatDurationSeconds } from "./duration.ts";

describe("formatDurationSeconds", () => {
  it("names the unit a value divides into exactly", () => {
    expect(formatDurationSeconds(30)).toBe("30 seconds");
    expect(formatDurationSeconds(60)).toBe("1 minute");
    expect(formatDurationSeconds(300)).toBe("5 minutes");
    expect(formatDurationSeconds(3_600)).toBe("1 hour");
    expect(formatDurationSeconds(7_200)).toBe("2 hours");
    expect(formatDurationSeconds(604_800)).toBe("7 days");
  });

  it("keeps 24 hours as hours, not one day", () => {
    // A refresh interval is said in hours at this size; days start above it.
    expect(formatDurationSeconds(86_400)).toBe("24 hours");
    expect(formatDurationSeconds(172_800)).toBe("2 days");
  });

  it("falls back to the smaller unit rather than inventing a fraction", () => {
    // 90 minutes must read back as the quantity that was chosen.
    expect(formatDurationSeconds(5_400)).toBe("90 minutes");
    expect(formatDurationSeconds(45)).toBe("45 seconds");
    expect(formatDurationSeconds(3_661)).toBe("3,661 seconds");
  });

  it("does not throw on a nonsense stored value", () => {
    expect(formatDurationSeconds(0)).toBe("0 seconds");
    expect(formatDurationSeconds(-5)).toBe("0 seconds");
  });
});

describe("formatDurationParts", () => {
  it("reads two units compactly", () => {
    expect(formatDurationParts({ days: 2, hours: 4 })).toBe("2d 4h");
    expect(formatDurationParts({ hours: 3, minutes: 7 })).toBe("3h 7m");
  });

  it("drops a zero part unless it is the only one", () => {
    expect(formatDurationParts({ days: 2, hours: 0 })).toBe("2d");
    expect(formatDurationParts({ minutes: 0 })).toBe("0m");
  });

  it("follows the locale", () => {
    expect(formatDurationParts({ days: 2, hours: 4 }, "ar")).not.toBe("2d 4h");
  });
});
