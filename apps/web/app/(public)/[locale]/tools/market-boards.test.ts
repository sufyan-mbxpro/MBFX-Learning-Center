// The market boards and the market news band (ADR-136).
//
// A SOURCE guard, like `tools-area.test.ts` beside it: this app has no jsdom,
// and every rule below is about what a file SAYS.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ROUTE_PATHS, TOOL_KEYS } from "@repo/contracts";
import en from "@repo/i18n/messages/en.json";

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** The file with its comments removed, so a guard never fails on its own explanation. */
const code = (source: string): string =>
  source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const liveRatesPage = code(read("./live-rates/page.tsx"));
const liveRatesBoard = code(read("./live-rates/_components/live-rates-board.tsx"));
const volatilityPage = code(read("./volatility/page.tsx"));
const volatilityBoard = code(read("./volatility/_components/volatility-board.tsx"));
const frame = code(read("../_components/tradingview-frame.tsx"));
const newsBand = code(read("../analysis/_components/market-news-band.tsx"));
// changes-42: the frame and its market chips moved into a client board.
const newsBoard = code(read("../analysis/_components/market-news-board.tsx"));
const analysisPage = code(read("../analysis/page.tsx"));
const indexPage = code(read("./page.tsx"));
const megaMenu = read("../_nav/mega-menu.ts");
const sitemap = code(read("../../../sitemap.ts"));
const proxy = read("../../../../proxy.ts");
const seed = read("../../../../../../packages/db/prisma/seed.ts");

function walkStrings(node: unknown, prefix = ""): [string, string][] {
  if (typeof node === "string") return [[prefix, node]];
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) =>
      walkStrings(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

describe("two boards that are not tools (ADR-136 §5)", () => {
  it("keeps both out of the TOOLS registry and off the `tool-` prefix", () => {
    expect(TOOL_KEYS).not.toContain("live-rates");
    expect(TOOL_KEYS).not.toContain("volatility");
    expect(ROUTE_PATHS["live-rates"]).toBe("/tools/live-rates");
    expect(ROUTE_PATHS.volatility).toBe("/tools/volatility");
  });

  it("404s live rates behind `market_data`, the flag nothing read before", () => {
    expect(liveRatesPage).toContain('isFeatureVisible("market_data", null)');
    expect(liveRatesPage).toContain("notFound()");
  });

  it("404s volatility behind the Tools area's flag", () => {
    expect(volatilityPage).toContain('isFeatureVisible("calculators", null)');
    expect(volatilityPage).toContain("notFound()");
  });

  // changes-40 moved `volatility` out of the Rates column and into Timing to
  // balance a 6 / 3 / 5 panel. Both are still IN the panel with a glyph, which
  // is what this guard was protecting; which headed column each sits under is
  // composition, and the mega-menu file's own comment records the move.
  it("puts both in the Tools panel, with glyphs", () => {
    const rates = megaMenu.slice(megaMenu.indexOf('key: "rates"'));
    expect(rates).toContain('"live-rates"');
    const timing = megaMenu.slice(
      megaMenu.indexOf('key: "timing"'),
      megaMenu.indexOf('key: "rates"'),
    );
    expect(timing).toContain('"volatility"');
    expect(megaMenu).toContain('"live-rates": ChartCandlestick');
    expect(megaMenu).toContain("volatility: Activity");
  });

  it("seeds both as Tools children and footer rows", () => {
    const tree = seed.slice(
      seed.indexOf("const TOOLS_NAV = {"),
      seed.indexOf("async function upsertNavTree"),
    );
    expect(tree).toContain('routeKey: "live-rates"');
    expect(tree).toContain('routeKey: "volatility"');
    const footer = seed.slice(seed.indexOf("const FOOTER_MENUS = ["));
    expect(footer).toContain('routeKey: "live-rates"');
    expect(footer).toContain('routeKey: "volatility"');
  });

  it("appends both cards on /tools and lists both in the sitemap, each behind its flag", () => {
    expect(indexPage).toContain('ROUTE_PATHS["live-rates"]');
    expect(indexPage).toContain("ROUTE_PATHS.volatility");
    expect(sitemap).toContain('"market_data"');
    expect(sitemap).toContain('ROUTE_PATHS["live-rates"], ROUTE_PATHS["market-news"]');
    expect(sitemap).toContain("ROUTE_PATHS.volatility");
  });
});

describe("TradingView is framed, never scripted (ADR-136 §2)", () => {
  it("renders no <script> and loads nothing from the vendor's script host", () => {
    for (const source of [frame, liveRatesBoard, liveRatesPage, newsBand, newsBoard]) {
      expect(source).not.toMatch(/<script|createElement\(\s*["']script/);
      expect(source).not.toContain("s3.tradingview.com");
    }
  });

  it("builds every frame URL with the pure builder, on the server", () => {
    expect(liveRatesPage).toContain("tradingViewWidgetUrl(");
    expect(newsBoard).toContain("tradingViewWidgetUrl(");
    expect(newsBand).toContain("<MarketNewsBoard");
    expect(frame.startsWith('"use client"')).toBe(true);
    expect(frame).not.toContain("tradingViewWidgetUrl");
  });

  // Keying on the mode alone was a real bug: every setting lives in the URL
  // FRAGMENT, so switching group changed the src and the frame kept showing
  // the previous group's symbols.
  it("keys the iframe by its whole URL, so a theme or a group change reloads it", () => {
    expect(frame).toContain("const src = urls[resolvedTheme];");
    expect(frame).toContain("key={src}");
  });

  it("allows the widget host as a frame source and never as a script source", () => {
    const frameSrc = proxy.split("\n").find((line) => line.includes("`frame-src"));
    expect(frameSrc).toContain("https://www.tradingview-widget.com");
    const scriptSrc = proxy.split("\n").filter((line) => line.includes("script-src"));
    expect(scriptSrc.join("\n")).not.toContain("tradingview");
  });

  it("draws no bid, ask or spread figure the widget cannot supply", () => {
    expect(liveRatesBoard).not.toMatch(/\b(bid|ask|spread)\b/i);
  });

  it("credits the vendor beside every frame", () => {
    expect(liveRatesBoard).toContain("TRADINGVIEW_ATTRIBUTION_URL");
    expect(newsBand).toContain("TRADINGVIEW_ATTRIBUTION_URL");
  });
});

describe("the market news band on /analysis (ADR-136 §6)", () => {
  it("comes after our own listing and taxonomy", () => {
    const listing = analysisPage.indexOf("<ArticleListing");
    const taxonomy = analysisPage.indexOf("<ArchiveTaxonomy");
    const band = analysisPage.indexOf("<MarketNewsBand");
    expect(listing).toBeGreaterThan(-1);
    expect(band).toBeGreaterThan(taxonomy);
    expect(taxonomy).toBeGreaterThan(listing);
  });

  it("says the stories were not reviewed here", () => {
    expect(newsBand).toContain('t("marketNewsNote")');
    expect(en.news.marketNewsNote).toMatch(/not reviewed/i);
  });
});

describe("volatility is ours, and says what it is (ADR-136 §3, ADR-088 #7)", () => {
  const strings = walkStrings((en as { volatility: unknown }).volatility);

  it("finds the namespace at all — a silent zero would pass every assertion", () => {
    expect(strings.length).toBeGreaterThan(30);
  });

  it.each([["real-time"], ["realtime"], ["live"]])("says %s nowhere in its namespace", (word) => {
    const offenders = strings.filter(([, value]) => new RegExp(`\\b${word}\\b`, "i").test(value));
    expect(offenders).toEqual([]);
  });

  it("reads its figures from stored bars on the server, not in the island", () => {
    expect(volatilityPage).toContain("getVolatilityBoard()");
    expect(volatilityBoard).not.toContain("fetch(");
  });

  it("prints its method and its as-of date", () => {
    expect(volatilityPage).toContain("<Methodology");
    expect(volatilityPage).toContain('t("asOf"');
  });

  it("renders a dash, with a spoken reason, for a figure below its window", () => {
    expect(volatilityBoard).toContain('<Dash label={t("notEnough")} />');
  });

  it("uses the reference's published level bands", () => {
    expect(en.volatility.levelBands).toEqual({
      low: "Low (under 0.5%)",
      medium: "Medium (0.5–1%)",
      high: "High (1–2%)",
      extreme: "Extreme (2% and over)",
    });
  });
});

describe("live rates admits what it cannot show", () => {
  it("says quotes may be delayed and that spreads are the broker's", () => {
    expect(en.liveRates.delayNote).toMatch(/may be delayed/i);
    expect(en.liveRates.spreadBody).toMatch(/broker/i);
  });
});
