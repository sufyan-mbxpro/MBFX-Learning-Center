// Dashboard content graphics (changes-26, ADR-085) — the pipeline bars, the
// publishing-output small multiples and the top-courses bars.
//
// **Server components, drawn in CSS, deliberately.** `dashboard-charts.tsx`
// next door is Recharts and stays that way: a growth curve over a continuous
// axis is what a charting library is for. These three are not that shape.
//
//   - The pipeline is six labelled rows of proportional segments. In a
//     one-third column Recharts' category axis gives each type ~70px and
//     truncates, and the counts can only be read by hovering.
//   - The output panels are six small multiples. Six `ResponsiveContainer`s
//     is six resize observers and six more client trees on a page that
//     already ships one.
//
// The rule this follows is `references/choosing-a-form.md`'s: pick the form
// from the data's job, and a proportion-of-a-whole bar is a `<div>` with a
// width. Nothing here needs an axis, a scale function or a hover layer that
// a `title` does not already give.
//
// Colour: every fill is a `var(--color-*)` reference, so the admin's own
// theme drives it (ADR-072 — a redesign changes `@repo/theme` defaults, and
// colour stays admin-dynamic). Labels arrive already translated, the
// convention `status-badge.tsx` states for every leaf component here.
import Link from "next/link";
import type { ContentEntityStats, ContentSeriesPoint, DashboardContentEntity } from "@repo/core";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { MetaText, SubText } from "@repo/ui/components/typography";
import { cn } from "@repo/ui/lib/utils";
import { PIPELINE_BUCKETS, type PipelineBucketKey } from "../_lib/dashboard-content.ts";

// ─── Pipeline ────────────────────────────────────────────────

function bucketCounts(row: ContentEntityStats): { key: PipelineBucketKey; count: number }[] {
  return PIPELINE_BUCKETS.map((bucket) => ({
    key: bucket.key,
    count: bucket.statuses.reduce(
      (sum, status) => sum + (row.byStatus[status as keyof typeof row.byStatus] ?? 0),
      0,
    ),
  }));
}

export function DashboardPipelineBars({
  rows,
  entityLabels,
  bucketLabels,
  totalLabel,
  emptyTitle,
  emptyDescription,
}: {
  rows: ContentEntityStats[];
  entityLabels: Record<DashboardContentEntity, string>;
  bucketLabels: Record<PipelineBucketKey, string>;
  /** "{count} total", already formatted by the caller. */
  totalLabel: (count: number) => string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const populated = rows.filter((row) => row.total > 0);
  if (populated.length === 0) {
    return (
      <Empty className="border-none">
        <EmptyTitle>{emptyTitle}</EmptyTitle>
        <EmptyDescription>{emptyDescription}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {populated.map((row) => {
          const segments = bucketCounts(row).filter((segment) => segment.count > 0);
          return (
            <li key={row.entity} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <SubText className="font-medium text-foreground">
                  {entityLabels[row.entity]}
                </SubText>
                <MetaText render={<span />} className="tabular-nums">
                  {totalLabel(row.total)}
                </MetaText>
              </div>
              {/* `gap` rather than a border between segments: the 2px spacer
                  in marks-and-anatomy.md, and it never eats a 1-item bar. */}
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                {segments.map((segment) => (
                  <div
                    key={segment.key}
                    // A percentage width cannot be a utility class, and
                    // `w-[37%]` is forbidden anyway (code-style.md #21).
                    style={{
                      width: `${(segment.count / row.total) * 100}%`,
                      backgroundColor: PIPELINE_BUCKETS.find((b) => b.key === segment.key)!.color,
                    }}
                    title={`${bucketLabels[segment.key]}: ${segment.count}`}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <PipelineLegend rows={populated} bucketLabels={bucketLabels} />
    </div>
  );
}

/**
 * Always rendered, because the bars are identified by colour alone without
 * it. Every bucket appears even at zero: the legend is the key to the whole
 * card, and a key that changes length as content moves is harder to read
 * than one that does not.
 */
function PipelineLegend({
  rows,
  bucketLabels,
}: {
  rows: ContentEntityStats[];
  bucketLabels: Record<PipelineBucketKey, string>;
}) {
  const totals = PIPELINE_BUCKETS.map((bucket) => ({
    key: bucket.key,
    color: bucket.color,
    count: rows.reduce(
      (sum, row) =>
        sum +
        bucket.statuses.reduce(
          (inner, status) => inner + (row.byStatus[status as keyof typeof row.byStatus] ?? 0),
          0,
        ),
      0,
    ),
  }));

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-3">
      {totals.map((bucket) => (
        <li key={bucket.key} className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: bucket.color }}
            aria-hidden
          />
          <MetaText render={<span />}>{bucketLabels[bucket.key]}</MetaText>
          <span className="text-2xs font-medium tabular-nums">{bucket.count}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Publishing output (small multiples) ─────────────────────

/**
 * One mini column chart per content type.
 *
 * Small multiples rather than one stacked bar with six series, for a reason
 * the palette forces: this theme has six saturated hues and three of them
 * (warning, destructive, info) are the status colours the pipeline above
 * uses. Painting "videos" in the warning hue next to a card where that hue
 * means "archived" is the reserved-status-colour mistake. Six panels in ONE
 * hue says the same thing and needs no legend at all.
 *
 * **The one hue is `success`, the pipeline's PUBLISHED fill (changes-43).**
 * It had been `primary`, the brand bronze, which the pipeline spends on
 * SCHEDULED — so the same colour meant "published" here and "not yet" one
 * card up. Every bar in these panels counts a publish, so it takes the
 * colour a publish already has on this page: colour following meaning, and
 * a token, so an admin's palette change still reaches it (ADR-072).
 *
 * **Each panel is scaled to its own peak**, which the card's description
 * says out loud, and each prints that peak so the scale is readable. A
 * shared scale is the usual rule for small multiples and it is wrong here:
 * lessons outnumber courses by an order of magnitude, so a shared axis would
 * flatten five panels to answer a question the stat cards above already
 * answer.
 *
 * **The panels fill the card's height.** The card shares a grid row with
 * the learning card, which is taller; with fixed 40px plots this one ended
 * in an empty half. The plot is `flex-1` with a floor, so on its own row it
 * is as compact as before and beside a taller neighbour it grows instead.
 */
export function DashboardOutputPanels({
  series,
  entities,
  entityLabels,
  emptyLabel,
  peakLabel,
}: {
  series: ContentSeriesPoint[];
  entities: DashboardContentEntity[];
  entityLabels: Record<DashboardContentEntity, string>;
  emptyLabel: string;
  /** "Busiest: {count}", already formatted by the caller. */
  peakLabel: (count: number) => string;
}) {
  return (
    <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
      {entities.map((entity) => {
        const values = series.map((point) => point[entity]);
        const total = values.reduce((sum, value) => sum + value, 0);
        const peak = Math.max(...values, 0);

        return (
          <div key={entity} className="flex min-h-24 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <SubText className="font-medium text-foreground">{entityLabels[entity]}</SubText>
              <span className="text-sm font-semibold tabular-nums">{total.toLocaleString()}</span>
            </div>
            {total === 0 ? (
              <div className="flex flex-1 items-end border-b border-dashed">
                <MetaText render={<p />} className="pb-2">
                  {emptyLabel}
                </MetaText>
              </div>
            ) : (
              <>
                <div className="flex min-h-10 flex-1 items-end gap-px border-b" aria-hidden>
                  {values.map((value, i) => (
                    <div
                      key={series[i]!.date}
                      className={cn(
                        "min-h-px flex-1 rounded-t-xs",
                        value > 0 ? "bg-success" : "bg-border",
                      )}
                      // `peak` is > 0 here: total > 0 implies one bucket is.
                      style={{ height: value > 0 ? `${(value / peak) * 100}%` : undefined }}
                      title={`${series[i]!.date}: ${value}`}
                    />
                  ))}
                </div>
                <MetaText render={<p />} className="text-2xs tabular-nums">
                  {peakLabel(peak)}
                </MetaText>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Top courses ─────────────────────────────────────────────

export interface TopCourseRow {
  courseId: string;
  title: string;
  started: number;
  completed: number;
}

/**
 * Started vs completed per course, as one bar with the completed portion
 * filled over it — two measures on ONE scale (learners), which is what keeps
 * this out of dual-axis territory. The shared denominator is the most
 * started course, so the rows compare with each other rather than each
 * showing its own 100%.
 */
export function DashboardTopCourses({
  rows,
  startedLabel,
  completedLabel,
  href,
  emptyLabel,
}: {
  rows: TopCourseRow[];
  startedLabel: string;
  completedLabel: string;
  href: string;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <MetaText render={<p />}>{emptyLabel}</MetaText>;
  }
  const peak = Math.max(...rows.map((row) => row.started), 1);

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.courseId} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <SubText className="line-clamp-1 font-medium text-foreground">
              <Link href={href} className="hover:underline">
                {row.title}
              </Link>
            </SubText>
            <MetaText render={<span />} className="shrink-0 tabular-nums">
              {row.completed} / {row.started}
            </MetaText>
          </div>
          <div
            className="h-2 rounded-full bg-muted"
            title={`${startedLabel}: ${row.started} · ${completedLabel}: ${row.completed}`}
          >
            <div
              className="h-full rounded-full bg-primary/30"
              style={{ width: `${(row.started / peak) * 100}%` }}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: row.started === 0 ? "0%" : `${(row.completed / row.started) * 100}%`,
                }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
