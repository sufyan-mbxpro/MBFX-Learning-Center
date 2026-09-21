"use client";

// The live-rates board (ADR-136 §2): the reference's group tabs over one card.
//
// The chips are client state, not links: a group is a view of one page, not
// a page of its own, and every group's frame URLs arrive with the page, so
// switching costs no request of ours.
//
// **No bid, ask or spread column is drawn.** TradingView's Market Quotes
// widget has none, and only a broker's feed could supply them. The page's
// Spread card says so instead of inventing a number.
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MarketBoardGroupKey } from "@repo/contracts";
import { Card } from "@repo/ui/components/card";
import { ViewChip, ViewChips } from "@repo/ui/components/view-chips";
import { TRADINGVIEW_ATTRIBUTION_URL } from "@repo/utils";
import { TradingViewFrame } from "../../../_components/tradingview-frame.tsx";

export interface LiveRatesGroup {
  key: MarketBoardGroupKey;
  /** How many rows the frame will draw, which is what its height is for. */
  rows: number;
  urls: { light: string; dark: string };
}

/**
 * The frame's height, from the number of rows in the group.
 *
 * The widget fills whatever box it is given and does not shrink to its own
 * content, so one fixed height left the three-row Commodities board with half
 * a card of white under it. A step from the scale per size, not a computed
 * pixel value (code-style.md #21): roughly 30px a row, plus the widget's own
 * header and its footer mark.
 */
function frameHeight(rows: number): string {
  if (rows <= 3) return "h-52";
  if (rows <= 5) return "h-68";
  return "h-88";
}

export function LiveRatesBoard({ groups }: { groups: LiveRatesGroup[] }) {
  const t = useTranslations("liveRates");
  const [selected, setSelected] = useState<MarketBoardGroupKey>(groups[0]?.key ?? "major");
  const group = groups.find((entry) => entry.key === selected) ?? groups[0];
  if (!group) return null;

  const label = t(`groups.${group.key}.label`);

  return (
    <div className="flex flex-col gap-6">
      <ViewChips
        aria-label={t("groupsLabel")}
        value={selected}
        onValueChange={(value) => setSelected(value as MarketBoardGroupKey)}
      >
        {groups.map((entry) => (
          <ViewChip key={entry.key} value={entry.key} className="py-2 text-sm">
            {t(`groups.${entry.key}.label`)}
          </ViewChip>
        ))}
      </ViewChips>

      <Card className="gap-0 overflow-hidden py-0 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">
              {t("boardTitle", { group: label })}
            </h2>
            <p className="text-sm text-muted-foreground">{t(`groups.${group.key}.description`)}</p>
          </div>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            {/* A dot is a circle, which is the one case `rounded-full` is for (ADR-107). */}
            <span
              aria-hidden
              className="size-2 rounded-full bg-primary motion-safe:animate-pulse"
            />
            {t("liveMarker")}
          </span>
        </div>

        <TradingViewFrame
          urls={group.urls}
          title={t("frameTitle", { group: label })}
          className={frameHeight(group.rows)}
        />

        <div className="flex flex-col gap-1 border-t border-border px-6 py-4 text-sm text-muted-foreground">
          <p>
            {t("attribution")}{" "}
            <a
              href={TRADINGVIEW_ATTRIBUTION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline inline-flex items-center gap-1 hover:text-foreground"
            >
              TradingView
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </p>
          <p>{t("delayNote")}</p>
        </div>
      </Card>
    </div>
  );
}
