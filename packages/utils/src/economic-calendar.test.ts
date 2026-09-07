import { describe, expect, it } from "vitest";
import {
  ECONOMIC_CALENDAR_ATTRIBUTION_URL,
  ECONOMIC_CALENDAR_LANGS,
  economicCalendarLang,
  economicCalendarWidgetUrl,
} from "./economic-calendar.ts";

describe("economicCalendarLang", () => {
  it.each(ECONOMIC_CALENDAR_LANGS)("passes through the supported language %s", (lang) => {
    expect(economicCalendarLang(lang)).toBe(lang);
  });

  it.each([
    ["es-MX", "es"],
    ["ar-EG", "ar"],
    ["EN", "en"],
    ["  es  ", "es"],
  ])("normalises %s to %s", (locale, expected) => {
    expect(economicCalendarLang(locale)).toBe(expected);
  });

  // ur is our fourth locale and the vendor has no catalog for it — the
  // widget 404s on /ur/. Falling back is what keeps the frame non-empty.
  it.each(["ur", "ur-PK", "hi", "", "not-a-locale"])(
    "falls back to English for the unsupported locale %s",
    (locale) => {
      expect(economicCalendarLang(locale)).toBe("en");
    },
  );

  it("does not claim to support Urdu", () => {
    expect(ECONOMIC_CALENDAR_LANGS).not.toContain("ur");
  });
});

describe("economicCalendarWidgetUrl", () => {
  it("builds the vendor widget URL for a supported locale", () => {
    expect(economicCalendarWidgetUrl({ locale: "es" })).toBe(
      "https://www.tradays.com/es/economic-calendar/widget?mode=2",
    );
  });

  it("defaults to the loader's own display mode", () => {
    expect(economicCalendarWidgetUrl({ locale: "en" })).toContain("mode=2");
    expect(economicCalendarWidgetUrl({ locale: "en", mode: 1 })).toContain("mode=1");
  });

  it("falls back to the English widget rather than a 404 frame", () => {
    expect(economicCalendarWidgetUrl({ locale: "ur" })).toBe(
      "https://www.tradays.com/en/economic-calendar/widget?mode=2",
    );
  });

  // The origin is a constant, never a caller's string: this is the property
  // that makes the embed non-SSRF-able (security.md #9, ADR-050 §3).
  it.each([
    "https://evil.example.com",
    "../../evil",
    "en/../../../etc/passwd",
    "javascript:alert(1)",
    "en?x=y#z",
  ])("cannot be steered off the vendor origin by the locale %s", (locale) => {
    // `origin` is deliberately absent from this package's minimal ambient
    // URL declaration (url-global.d.ts); protocol + hostname is the same
    // assertion without widening it.
    const url = new URL(economicCalendarWidgetUrl({ locale }));
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("www.tradays.com");
    expect(url.pathname).toMatch(/^\/[a-z]{2}\/economic-calendar\/widget$/);
  });

  it("credits the vendor at a URL that resolves", () => {
    expect(ECONOMIC_CALENDAR_ATTRIBUTION_URL).toBe("https://www.mql5.com/en/economic-calendar");
  });
});
