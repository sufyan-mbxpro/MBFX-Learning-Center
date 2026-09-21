import { describe, expect, it } from "vitest";
import {
  TRADINGVIEW_WIDGET_ORIGIN,
  tradingViewLocale,
  tradingViewWidgetUrl,
  type TradingViewWidget,
} from "./tradingview.ts";

/** The settings JSON a URL carries in its fragment. */
function settingsOf(url: string): Record<string, unknown> {
  const hash = url.slice(url.indexOf("#") + 1);
  return JSON.parse(decodeURIComponent(hash)) as Record<string, unknown>;
}

const majors = {
  name: "Major pairs",
  symbols: [
    { name: "FX:EURUSD", displayName: "EUR/USD" },
    { name: "FX:GBPUSD", displayName: "GBP/USD" },
  ],
};

describe("tradingViewLocale", () => {
  it.each([
    ["en", "en"],
    ["es", "es"],
    ["es-MX", "es"],
    ["ar", "ar_AE"],
    ["AR", "ar_AE"],
  ])("maps %s to %s", (locale, expected) => {
    expect(tradingViewLocale(locale)).toBe(expected);
  });

  it.each(["ur", "hi", "", "nonsense"])("falls back to English for %s", (locale) => {
    expect(tradingViewLocale(locale)).toBe("en");
  });
});

describe("tradingViewWidgetUrl", () => {
  it("frames the vendor's widget host and nothing else", () => {
    const url = tradingViewWidgetUrl({
      widget: "market-quotes",
      locale: "en",
      colorTheme: "light",
      settings: { group: majors },
    });
    expect(
      url.startsWith(`${TRADINGVIEW_WIDGET_ORIGIN}/embed-widget/market-quotes/?locale=en#`),
    ).toBe(true);
  });

  it("carries one symbol group, the theme and a fill-the-box size in the fragment", () => {
    const url = tradingViewWidgetUrl({
      widget: "market-quotes",
      locale: "es",
      colorTheme: "dark",
      settings: { group: majors },
    });
    expect(url).toContain("?locale=es#");
    const settings = settingsOf(url);
    expect(settings).toMatchObject({ width: "100%", height: "100%", colorTheme: "dark" });
    expect(settings.symbolsGroups).toEqual([majors]);
    // `locale` travels in the query string, never in the fragment (the loader's own split).
    expect(settings).not.toHaveProperty("locale");
  });

  it("differs between the light and dark frames, so a keyed iframe reloads", () => {
    const build = (colorTheme: "light" | "dark") =>
      tradingViewWidgetUrl({ widget: "timeline", locale: "en", colorTheme, settings: {} });
    expect(build("light")).not.toBe(build("dark"));
  });

  it("forces the timeline to English, as the vendor's loader does", () => {
    const url = tradingViewWidgetUrl({
      widget: "timeline",
      locale: "ar",
      colorTheme: "light",
      settings: {},
    });
    expect(url).toContain("/embed-widget/timeline/?locale=en#");
    expect(settingsOf(url)).toMatchObject({ feedMode: "all_symbols", displayMode: "regular" });
  });

  it("names a market only for a market feed", () => {
    const all = tradingViewWidgetUrl({
      widget: "timeline",
      locale: "en",
      colorTheme: "light",
      settings: { market: "forex" },
    });
    expect(settingsOf(all)).not.toHaveProperty("market");
    const forex = tradingViewWidgetUrl({
      widget: "timeline",
      locale: "en",
      colorTheme: "light",
      settings: { feedMode: "market", market: "forex" },
    });
    expect(settingsOf(forex)).toMatchObject({ feedMode: "market", market: "forex" });
  });

  it("refuses a widget outside the closed list", () => {
    expect(() =>
      tradingViewWidgetUrl({
        widget: "advanced-chart" as TradingViewWidget,
        locale: "en",
        colorTheme: "light",
        settings: {},
      }),
    ).toThrow(/Unknown TradingView widget/);
  });
});

// ─── The economic calendar (ADR-137) ──────────────────────────
describe("tradingViewWidgetUrl — events", () => {
  const settingsOf = (url: string): Record<string, unknown> =>
    JSON.parse(decodeURIComponent(url.slice(url.indexOf("#") + 1))) as Record<string, unknown>;

  it("joins importance into the vendor's filter string", () => {
    const url = tradingViewWidgetUrl({
      widget: "events",
      locale: "en",
      colorTheme: "dark",
      settings: { importance: [1], countries: ["us", "eu"] },
    });
    expect(url.startsWith("https://www.tradingview-widget.com/embed-widget/events/")).toBe(true);
    expect(settingsOf(url)).toMatchObject({
      importanceFilter: "1",
      countryFilter: "us,eu",
      colorTheme: "dark",
    });
  });

  it("defaults to all three importance levels", () => {
    const url = tradingViewWidgetUrl({
      widget: "events",
      locale: "en",
      colorTheme: "light",
      settings: {},
    });
    expect(settingsOf(url)).toMatchObject({ importanceFilter: "-1,0,1" });
  });

  // An empty filter is not "everywhere" to this widget — it is "nothing
  // passes", and the frame comes back with an empty calendar in it.
  it("omits countryFilter rather than sending an empty one", () => {
    const url = tradingViewWidgetUrl({
      widget: "events",
      locale: "en",
      colorTheme: "light",
      settings: { countries: [] },
    });
    expect(settingsOf(url)).not.toHaveProperty("countryFilter");
  });

  it("keeps the reader's locale — only the timeline is forced to English", () => {
    const url = tradingViewWidgetUrl({
      widget: "events",
      locale: "es",
      colorTheme: "light",
      settings: {},
    });
    expect(url).toContain("?locale=es#");
  });
});
