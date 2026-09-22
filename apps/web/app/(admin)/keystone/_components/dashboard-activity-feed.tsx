import { Activity } from "lucide-react";
import { formatDateTime, humanizeKey } from "@repo/utils";
import { Empty, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { cn } from "@repo/ui/lib/utils";
import type { RecentActivityItem } from "@repo/core";
import { activityKind } from "../_lib/dashboard-activity.ts";

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
  entityLabel,
}: {
  items: RecentActivityItem[];
  locale: string;
  emptyLabel: string;
  systemLabel: string;
  byLabel: string;
  /** "on {entity}", already formatted by the caller. */
  entityLabel: (entity: string) => string;
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
    // A timeline: a rule threads the markers, so eight entries read as one
    // sequence rather than eight unrelated lines.
    <ol className="flex flex-col">
      {items.map((item, index) => {
        const { icon: Icon, tone } = activityKind(item.action);
        const actor = item.actorName ?? item.actorEmail ?? systemLabel;
        const isLast = index === items.length - 1;
        return (
          <li key={item.id} className={cn("relative flex gap-3", !isLast && "pb-4")}>
            {!isLast && (
              <span className="absolute start-4 top-9 bottom-1 w-px bg-border" aria-hidden />
            )}
            <span
              className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", tone)}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium text-foreground">
                  {humanizeKey(item.action)}
                </span>
                <time
                  dateTime={item.createdAt.toISOString()}
                  title={formatDateTime(item.createdAt, locale)}
                  className="shrink-0 text-xs text-muted-foreground tabular-nums"
                >
                  {relativeTime(item.createdAt, locale, now)}
                </time>
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {byLabel} <span className="font-medium text-foreground">{actor}</span>
                {item.entityType && <> · {entityLabel(humanizeKey(item.entityType))}</>}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
