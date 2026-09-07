import { Activity } from "lucide-react";
import { humanizeKey } from "@repo/utils";
import { Empty, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import type { RecentActivityItem } from "@repo/core";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function relativeTime(date: Date, locale: string, now: Date): string {
  const diff = date.getTime() - now.getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return formatter.format(Math.round(diff / 1000), "second");
}

export function DashboardActivityFeed({
  items,
  locale,
  emptyLabel,
  systemLabel,
  byLabel,
}: {
  items: RecentActivityItem[];
  locale: string;
  emptyLabel: string;
  systemLabel: string;
  byLabel: string;
}) {
  if (items.length === 0) {
    return (
      <Empty className="border-none py-6">
        <EmptyMedia>
          <Activity aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{emptyLabel}</EmptyTitle>
      </Empty>
    );
  }

  const now = new Date();

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm text-foreground">{humanizeKey(item.action)}</span>
            <span className="text-xs text-muted-foreground">
              {byLabel} {item.actorName ?? item.actorEmail ?? systemLabel} ·{" "}
              {relativeTime(item.createdAt, locale, now)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
