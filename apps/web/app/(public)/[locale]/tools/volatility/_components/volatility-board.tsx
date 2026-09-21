"use client";

// The volatility board (ADR-136 §3): group chips and timeframe chips over one
// card of per-instrument tiles, the reference's layout.
//
// **Every figure was computed on the server** from stored bars
// (`getVolatilityBoard`), for all three timeframes at once. The chips only
// choose what to show, so switching costs no request.
//
// **A figure below its window's length is a dash, never a number**
// (ADR-088 #3), and a screen reader hears why. Nothing on this board says
// "live" or "real-time": the bars move once a day (ADR-088 #7).
import { useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MarketBoardGroupKey } from "@repo/contracts";
import type { VolatilityGroupView, VolatilityRowView } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { Card } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/components/empty";
import { ViewChip, ViewChips } from "@repo/ui/components/view-chips";
import { VOLATILITY_WINDOWS, type VolatilityTimeframe } from "@repo/utils";
import { VOLATILITY_LEVEL_BADGE } from "./volatility-level.ts";

const TIMEFRAMES = Object.keys(VOLATILITY_WINDOWS) as VolatilityTimeframe[];

/** A trend inside ±0.01 percentage points reads as flat; a sign on noise is a claim. */
const FLAT = 0.01;

function Dash({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </>
  );
}

function InstrumentTile({
  row,
  timeframe,
}: {
  row: VolatilityRowView;
  timeframe: VolatilityTimeframe;
}) {
  const t = useTranslations("volatility");
  const locale = useLocale();
  const reading = row.profile.timeframes[timeframe];

  const percent = (value: number, signed = false) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...(signed ? { signDisplay: "exceptZero" as const } : {}),
    }).format(value / 100);
  const price = (value: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: Math.min(row.decimals, 5),
      maximumFractionDigits: Math.min(row.decimals, 5),
    }).format(value);

  const trend = reading.trend;
  const TrendIcon =
    trend === null ? null : trend > FLAT ? TrendingUp : trend < -FLAT ? TrendingDown : Minus;
  const trendLabel =
    trend === null
      ? null
      : trend > FLAT
        ? t("trendUp")
        : trend < -FLAT
          ? t("trendDown")
          : t("trendFlat");

  return (
    <div className="flex h-full flex-col gap-4 rounded-lg bg-muted/40 p-5 transition-shadow duration-(--duration-base) hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight">{row.symbol}</h3>
        {reading.level && (
          <Badge variant={VOLATILITY_LEVEL_BADGE[reading.level]}>
            {t(`levels.${reading.level}`)}
          </Badge>
        )}
      </div>

      <dl className="flex flex-col gap-2.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{t("current")}</dt>
          <dd className="font-semibold tabular-nums">
            {reading.current === null ? <Dash label={t("notEnough")} /> : percent(reading.current)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{t("average")}</dt>
          <dd className="tabular-nums">
            {reading.average === null ? <Dash label={t("notEnough")} /> : percent(reading.average)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{t("trend")}</dt>
          <dd className="flex items-center gap-1.5 tabular-nums">
            {trend === null || !TrendIcon ? (
              <Dash label={t("notEnough")} />
            ) : (
              <>
                <TrendIcon
                  aria-hidden
                  className={
                    trend > FLAT
                      ? "size-4 text-warning-interactive"
                      : trend < -FLAT
                        ? "size-4 text-success-interactive"
                        : "size-4 text-muted-foreground"
                  }
                />
                {percent(trend, true)}
                <span className="sr-only">{trendLabel}</span>
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">{t("ranges")}</p>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          {TIMEFRAMES.map((key) => {
            const value = row.profile.ranges[key];
            return (
              <div key={key} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-2xs text-muted-foreground">
                  {t(
                    key === "daily"
                      ? "rangeDaily"
                      : key === "weekly"
                        ? "rangeWeekly"
                        : "rangeMonthly",
                  )}
                </dt>
                <dd className="truncate tabular-nums">
                  {value === null ? <Dash label={t("notEnough")} /> : price(value)}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}

export function VolatilityBoard({
  groups,
  asOfLabel,
}: {
  groups: VolatilityGroupView[];
  asOfLabel: string | null;
}) {
  const t = useTranslations("volatility");
  const [groupKey, setGroupKey] = useState<MarketBoardGroupKey>(groups[0]?.key ?? "major");
  const [timeframe, setTimeframe] = useState<VolatilityTimeframe>("daily");
  const group = groups.find((entry) => entry.key === groupKey) ?? groups[0];
  if (!group) return null;

  const groupLabel = t(`groups.${group.key}`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ViewChips
          aria-label={t("groupsLabel")}
          value={group.key}
          onValueChange={(value) => setGroupKey(value as MarketBoardGroupKey)}
          className="lg:w-auto"
        >
          {groups.map((entry) => (
            <ViewChip key={entry.key} value={entry.key} className="py-2 text-sm">
              {t(`groups.${entry.key}`)}
            </ViewChip>
          ))}
        </ViewChips>
        <ViewChips
          aria-label={t("timeframesLabel")}
          value={timeframe}
          onValueChange={(value) => setTimeframe(value as VolatilityTimeframe)}
          className="lg:w-auto"
        >
          {TIMEFRAMES.map((key) => (
            <ViewChip key={key} value={key} className="py-2 text-sm">
              {t(`timeframes.${key}.label`)}
            </ViewChip>
          ))}
        </ViewChips>
      </div>

      <Card className="gap-0 overflow-hidden py-0 shadow-md">
        <div className="flex flex-col gap-1 border-b border-border p-6">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("boardTitle", { group: groupLabel })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(`timeframes.${timeframe}.description`)}
          </p>
        </div>

        <div className="flex flex-col gap-4 p-6">
          {group.rows.length === 0 ? (
            <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.rows.map((row) => (
                <li key={row.symbol} className="min-w-0">
                  <InstrumentTile row={row} timeframe={timeframe} />
                </li>
              ))}
            </ul>
          )}
          {group.rows.length > 0 && group.missing.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("missing", { symbols: group.missing.join(", ") })}
            </p>
          )}
        </div>
      </Card>

      {asOfLabel && <p className="text-sm text-muted-foreground">{asOfLabel}</p>}
    </div>
  );
}
