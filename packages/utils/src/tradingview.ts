// TradingView widget URL builder (Module 13, ADR-136 §2).
//
// ADR-050's pattern a second time. The vendor's loader script
// (`s3.tradingview.com/external-embedding/embed-widget-<id>.js`) was read
// rather than assumed, and all it does is build an iframe:
//
//   https://www.tradingview-widget.com/embed-widget/<id>/?locale=<l>#<settings>
//
// where `<settings>` is the widget's JSON, URL-encoded, minus `locale` (which
// travels in the query string instead). Building that URL here means no vendor
// script ever enters our document and `script-src` stays closed. It also keeps
// security.md #9 true by construction: the origin is a constant, the widget id
// comes from a closed list, and the caller passes settings, never a URL.

export const TRADINGVIEW_WIDGET_ORIGIN = "https://www.tradingview-widget.com";

/** Where the attribution credit points. */
export const TRADINGVIEW_ATTRIBUTION_URL = "https://www.tradingview.com/";

/** The widgets this site frames, and no others. */
export const TRADINGVIEW_WIDGETS = ["market-quotes", "timeline", "events"] as const;

export type TradingViewWidget = (typeof TRADINGVIEW_WIDGETS)[number];

export type TradingViewColorTheme = "light" | "dark";

/** Our locale → TradingView's locale code. Unsupported locales (Urdu among them) fall back to English. */
const LOCALES: Record<string, string> = { en: "en", es: "es", ar: "ar_AE" };

export function tradingViewLocale(locale: string): string {
  return LOCALES[locale.trim().slice(0, 2).toLowerCase()] ?? "en";
}

export interface TradingViewSymbol {
  /** The vendor's ticker, e.g. `FX:EURUSD`. */
  name: string;
  /** What the row prints, e.g. `EUR/USD`. */
  displayName: string;
}

export interface MarketQuotesSettings {
  /** One group's title and symbols. The board shows one group at a time, behind our own chips. */
  group: { name: string; symbols: readonly TradingViewSymbol[] };
  showSymbolLogo?: boolean;
}

export interface TimelineSettings {
  /** `all_symbols` is the reference's feed: every provider, every market. */
  feedMode?: "all_symbols" | "market";
  market?: "forex" | "crypto" | "stock" | "index" | "futures" | "cfd";
  displayMode?: "regular" | "compact" | "adaptive";
}

/**
 * The economic-calendar widget (ADR-137).
 *
 * Both filters are the vendor's own comma-joined strings, and both are built
 * HERE from closed lists rather than taken as text: the whole reason this file
 * exists is that a widget URL is assembled from constants, never from input
 * (security.md #9).
 */
export interface EventsSettings {
  /** Importance, as the vendor spells it: -1 low, 0 medium, 1 high. */
  importance?: readonly EventImportance[];
  /** ISO-ish country codes the vendor accepts. Empty ⇒ the widget's own default set. */
  countries?: readonly string[];
}

/** The vendor's three importance levels. `-1` is low, which is not a typo. */
export const EVENT_IMPORTANCE = [-1, 0, 1] as const;
export type EventImportance = (typeof EVENT_IMPORTANCE)[number];

type WidgetSettings = {
  "market-quotes": MarketQuotesSettings;
  timeline: TimelineSettings;
  events: EventsSettings;
};

export interface TradingViewWidgetOptions<W extends TradingViewWidget> {
  widget: W;
  locale: string;
  colorTheme: TradingViewColorTheme;
  settings: WidgetSettings[W];
}

function hashSettings(
  widget: TradingViewWidget,
  colorTheme: TradingViewColorTheme,
  settings: MarketQuotesSettings | TimelineSettings | EventsSettings,
): Record<string, unknown> {
  // The frame fills the box we give it; the vendor's own width/height
  // defaults are pixel sizes that would fight our layout.
  const base = { width: "100%", height: "100%", colorTheme, isTransparent: false };
  if (widget === "market-quotes") {
    const quotes = settings as MarketQuotesSettings;
    return {
      ...base,
      showSymbolLogo: quotes.showSymbolLogo ?? true,
      symbolsGroups: [
        {
          name: quotes.group.name,
          symbols: quotes.group.symbols.map((symbol) => ({
            name: symbol.name,
            displayName: symbol.displayName,
          })),
        },
      ],
    };
  }
  if (widget === "events") {
    const events = settings as EventsSettings;
    const importance = events.importance ?? EVENT_IMPORTANCE;
    return {
      ...base,
      // Joined here rather than at the call site so the shape the vendor wants
      // is stated once. An empty `countries` is OMITTED, not sent as "": the
      // widget reads an empty filter as "no country passes" and renders a
      // calendar with nothing in it.
      importanceFilter: importance.join(","),
      ...(events.countries && events.countries.length > 0
        ? { countryFilter: events.countries.join(",") }
        : {}),
    };
  }
  const timeline = settings as TimelineSettings;
  return {
    ...base,
    feedMode: timeline.feedMode ?? "all_symbols",
    ...(timeline.feedMode === "market" && timeline.market ? { market: timeline.market } : {}),
    displayMode: timeline.displayMode ?? "regular",
  };
}

/** The embeddable widget URL, which is what goes in the iframe `src`. */
export function tradingViewWidgetUrl<W extends TradingViewWidget>({
  widget,
  locale,
  colorTheme,
  settings,
}: TradingViewWidgetOptions<W>): string {
  if (!TRADINGVIEW_WIDGETS.includes(widget)) {
    throw new Error(`Unknown TradingView widget: ${String(widget)}`);
  }
  // The vendor's loader forces the Timeline to English whatever it is given,
  // so asking for Arabic would only make our URL disagree with what renders.
  const lang = widget === "timeline" ? "en" : tradingViewLocale(locale);
  const hash = encodeURIComponent(JSON.stringify(hashSettings(widget, colorTheme, settings)));
  return `${TRADINGVIEW_WIDGET_ORIGIN}/embed-widget/${widget}/?locale=${lang}#${hash}`;
}
