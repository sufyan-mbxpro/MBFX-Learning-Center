// The market boards' instrument groups (Module 13, ADR-136 §4).
//
// `/tools/live-rates` and `/tools/volatility` both open on the reference's
// four groups: Major, Minor, Exotic, Commodities. Which pair belongs to which
// group is page COMPOSITION, not content, so it is code (ADR-042). The owner
// asked for these pages with no admin control.
//
// Each entry carries two names for one instrument:
//
// - `symbol` is OUR `MarketInstrument.symbol`. The volatility board matches
//   stored bars on it, so an instrument an admin has not created or has
//   deactivated simply does not report.
// - `tradingView` is the vendor's ticker for the live-rates frame. It is a
//   fixed string from this file, never input, which is half of what keeps
//   `tradingViewWidgetUrl` safe (security.md #9).

export const MARKET_BOARD_GROUP_KEYS = ["major", "minor", "exotic", "commodities"] as const;

export type MarketBoardGroupKey = (typeof MARKET_BOARD_GROUP_KEYS)[number];

export interface MarketBoardInstrument {
  symbol: string;
  tradingView: string;
}

export const MARKET_BOARD_GROUPS = {
  major: [
    { symbol: "EUR/USD", tradingView: "FX:EURUSD" },
    { symbol: "GBP/USD", tradingView: "FX:GBPUSD" },
    { symbol: "USD/JPY", tradingView: "FX:USDJPY" },
    { symbol: "USD/CHF", tradingView: "FX:USDCHF" },
    { symbol: "AUD/USD", tradingView: "FX:AUDUSD" },
    { symbol: "USD/CAD", tradingView: "FX:USDCAD" },
    { symbol: "NZD/USD", tradingView: "FX:NZDUSD" },
  ],
  minor: [
    { symbol: "EUR/GBP", tradingView: "FX:EURGBP" },
    { symbol: "EUR/JPY", tradingView: "FX:EURJPY" },
    { symbol: "GBP/JPY", tradingView: "FX:GBPJPY" },
    { symbol: "EUR/CHF", tradingView: "FX:EURCHF" },
    { symbol: "AUD/JPY", tradingView: "FX:AUDJPY" },
  ],
  exotic: [
    { symbol: "USD/TRY", tradingView: "FX:USDTRY" },
    { symbol: "USD/ZAR", tradingView: "FX:USDZAR" },
    { symbol: "USD/MXN", tradingView: "FX:USDMXN" },
  ],
  commodities: [
    { symbol: "XAU/USD", tradingView: "OANDA:XAUUSD" },
    { symbol: "XAG/USD", tradingView: "OANDA:XAGUSD" },
    { symbol: "WTI/USD", tradingView: "TVC:USOIL" },
  ],
} as const satisfies Record<MarketBoardGroupKey, readonly MarketBoardInstrument[]>;

/** Every symbol any group names, in group order. */
export const MARKET_BOARD_SYMBOLS: readonly string[] = MARKET_BOARD_GROUP_KEYS.flatMap((key) =>
  MARKET_BOARD_GROUPS[key].map((instrument) => instrument.symbol),
);
