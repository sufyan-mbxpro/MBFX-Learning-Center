"use client";

// The market-news feed behind a row of market chips (changes-42).
//
// The owner's reference heads its news with a row of PROVIDER chips. The
// Timeline embed cannot filter by provider — its only filter is the MARKET
// (`feedMode: "market"`) — so the row offers what the embed can actually do,
// the same call ADR-137 made for the calendar's tabs: a chip that promised
// "Reuters" and showed every provider would be a broken promise.
//
// Client state, not links, for `CalendarBoard`'s reason: a filter is a view of
// this band, and every URL is built from the closed `MARKET_NEWS_FILTERS`
// list and constants, never from input (security.md #9).
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ViewChip, ViewChips } from "@repo/ui/components/view-chips";
import { tradingViewWidgetUrl, type TimelineSettings } from "@repo/utils";
import { TradingViewFrame } from "../../_components/tradingview-frame.tsx";

/** The chips, in order, and the embed settings each one means. */
export const MARKET_NEWS_FILTERS = {
  all: { feedMode: "all_symbols" },
  forex: { feedMode: "market", market: "forex" },
  crypto: { feedMode: "market", market: "crypto" },
  stock: { feedMode: "market", market: "stock" },
  index: { feedMode: "market", market: "index" },
  futures: { feedMode: "market", market: "futures" },
  cfd: { feedMode: "market", market: "cfd" },
} as const satisfies Record<string, TimelineSettings>;

export type MarketNewsFilter = keyof typeof MARKET_NEWS_FILTERS;
const FILTER_KEYS = Object.keys(MARKET_NEWS_FILTERS) as MarketNewsFilter[];

export function MarketNewsBoard({ locale }: { locale: string }) {
  const t = useTranslations("news");
  const [filter, setFilter] = useState<MarketNewsFilter>("all");

  const url = (colorTheme: "light" | "dark") =>
    tradingViewWidgetUrl({
      widget: "timeline",
      locale,
      colorTheme,
      settings: MARKET_NEWS_FILTERS[filter],
    });

  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <ViewChips
          aria-label={t("marketNewsFilterLabel")}
          value={filter}
          onValueChange={(value) => setFilter(value as MarketNewsFilter)}
        >
          {FILTER_KEYS.map((key) => (
            <ViewChip key={key} value={key} className="py-2 text-sm">
              {t(`marketNewsFilter.${key}`)}
            </ViewChip>
          ))}
        </ViewChips>
      </div>
      <TradingViewFrame
        urls={{ light: url("light"), dark: url("dark") }}
        title={t("marketNewsFrameTitle")}
        className="h-150"
      />
    </>
  );
}
