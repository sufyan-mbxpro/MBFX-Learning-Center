"use client";

// The calendar board (ADR-137): the reference's filter row over one framed
// widget.
//
// The chips are client state rather than links, for `LiveRatesBoard`'s reason
// (ADR-136 §2): a filter is a view of this page, not a page of its own, and
// every combination's URL is built here from two closed lists, so switching
// costs no request of ours and reaches no server.
//
// **The URL is built on the client and that is safe**, because neither half of
// it comes from the reader: `CALENDAR_IMPORTANCE` and `CALENDAR_REGIONS` are
// code registries, the widget id is a constant, and the origin is a constant
// (security.md #9). Precomputing all twenty combinations on the server would
// ship twenty URLs to render one.
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@repo/ui/components/card";
import { ViewChip, ViewChips } from "@repo/ui/components/view-chips";
import { TRADINGVIEW_ATTRIBUTION_URL, tradingViewWidgetUrl } from "@repo/utils";
import { TradingViewFrame } from "../../_components/tradingview-frame.tsx";
import {
  CALENDAR_IMPORTANCE,
  CALENDAR_IMPORTANCE_KEYS,
  CALENDAR_REGIONS,
  CALENDAR_REGION_KEYS,
  type CalendarImportanceKey,
  type CalendarRegionKey,
} from "../_content/calendar-filters.ts";

/** Where a reader goes for the vendor's full calendar, with its own tabs. */
const TRADINGVIEW_CALENDAR_URL = "https://www.tradingview.com/economic-calendar/";

export function CalendarBoard({ locale }: { locale: string }) {
  const t = useTranslations("economicCalendar");
  const [importance, setImportance] = useState<CalendarImportanceKey>("all");
  const [region, setRegion] = useState<CalendarRegionKey>("major");

  const url = (colorTheme: "light" | "dark") =>
    tradingViewWidgetUrl({
      widget: "events",
      locale,
      colorTheme,
      settings: {
        importance: CALENDAR_IMPORTANCE[importance],
        countries: CALENDAR_REGIONS[region],
      },
    });

  return (
    <div className="flex flex-col gap-6">
      {/* Two rows, each labelled. One row of ten mixed chips would make
          "High" and "Europe" look like alternatives to each other. */}
      <div className="flex flex-col gap-3">
        <ViewChips
          aria-label={t("filterImportanceLabel")}
          value={importance}
          onValueChange={(value) => setImportance(value as CalendarImportanceKey)}
        >
          {CALENDAR_IMPORTANCE_KEYS.map((key) => (
            <ViewChip key={key} value={key} className="py-2 text-sm">
              {t(`filterImportance.${key}`)}
            </ViewChip>
          ))}
        </ViewChips>
        <ViewChips
          aria-label={t("filterRegionLabel")}
          value={region}
          onValueChange={(value) => setRegion(value as CalendarRegionKey)}
        >
          {CALENDAR_REGION_KEYS.map((key) => (
            <ViewChip key={key} value={key} className="py-2 text-sm">
              {t(`filterRegion.${key}`)}
            </ViewChip>
          ))}
        </ViewChips>
      </div>

      <Card className="gap-0 overflow-hidden py-0 shadow-md">
        <TradingViewFrame
          urls={{ light: url("light"), dark: url("dark") }}
          title={t("frameTitle")}
          // Taller than the boards: a week of releases is a long list, and a
          // calendar that shows four rows and a scrollbar is a worse calendar.
          className="h-180 sm:h-208 lg:h-232"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 text-sm text-muted-foreground">
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
          <a
            href={TRADINGVIEW_CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline inline-flex items-center gap-1.5 hover:text-foreground"
          >
            {t("openLabel")}
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </div>
      </Card>
    </div>
  );
}
