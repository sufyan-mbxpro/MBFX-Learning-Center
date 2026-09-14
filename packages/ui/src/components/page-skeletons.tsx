// changes-21 Phase A — route-level skeletons for the page ARCHETYPES a screen
// is built from: a list, a form, an editor, a record's detail, a dashboard.
// A loading.tsx picks the archetype its page renders and nothing else, so a
// navigation fills boxes that are already the right size instead of blanking
// to a spinner or jumping on arrival.
//
// They live here rather than in an app because they are pure compositions of
// the design system's own anatomy (PageHeader, Card, DataTable, MetricCard)
// with no routing or data — the same shapes a native admin would need.
//
// Announcement: pass `label` (a catalog string) and the skeleton is ONE
// `role="status"` region with that text for screen readers; omit it and the
// whole tree is `aria-hidden`, for surfaces where the navigation itself is
// already announced. Never both, never per block.
import { cn } from "@repo/ui/lib/utils";
import {
  Skeleton,
  SkeletonButton,
  SkeletonCard,
  SkeletonField,
  SkeletonHeading,
  SkeletonTable,
  SkeletonText,
} from "@repo/ui/components/skeleton";

function Frame({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="page-skeleton"
      {...(label
        ? { role: "status", "aria-live": "polite" as const, "aria-busy": true }
        : { "aria-hidden": true })}
      className={cn("flex w-full flex-col gap-6", className)}
    >
      {label && <span className="sr-only">{label}</span>}
      {children}
    </div>
  );
}

/**
 * PageHeader's shape (tokens.md §6.12): the 36px title line over the 24px
 * description, actions at the inline end.
 */
function PageHeaderSkeleton({
  actions = false,
  back = false,
}: {
  actions?: boolean;
  back?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {back && <SkeletonButton size="sm" className="w-24" />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <SkeletonHeading size="page" />
          <Skeleton className="h-6 w-96 max-w-full" />
        </div>
        {actions && <SkeletonButton />}
      </div>
    </div>
  );
}

/** A list screen: header, the 36px toolbar (search + filters), the table. */
function TablePageSkeleton({
  label,
  rows = 8,
  columns = 5,
  filters = 1,
  actions = true,
}: {
  label?: string;
  rows?: number;
  columns?: number;
  filters?: number;
  actions?: boolean;
}) {
  return (
    <Frame label={label}>
      <PageHeaderSkeleton actions={actions} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-full sm:w-64" />
          {Array.from({ length: filters }, (_, index) => (
            <Skeleton key={index} className="h-9 w-40" />
          ))}
          <Skeleton className="ms-auto h-9 w-24" />
        </div>
        <SkeletonTable rows={rows} columns={columns} />
      </div>
    </Frame>
  );
}

/**
 * A settings-style form: one card per section, 40px fields, the Save at the
 * inline end (code-style #8).
 */
function FormPageSkeleton({
  label,
  fields = 5,
  sections = 1,
}: {
  label?: string;
  fields?: number;
  sections?: number;
}) {
  return (
    <Frame label={label}>
      <PageHeaderSkeleton />
      {Array.from({ length: sections }, (_, section) => (
        <SkeletonCard key={section}>
          <SkeletonHeading size="section" />
          <div className="grid grid-cols-1 gap-4 pt-3 xl:grid-cols-2">
            {Array.from({ length: fields }, (_, index) => (
              <SkeletonField key={index} />
            ))}
          </div>
          <SkeletonButton className="ms-auto mt-2" />
        </SkeletonCard>
      ))}
    </Frame>
  );
}

/**
 * An editor: back link and header, the 40px tab tray, then the main column
 * beside the status/aside column on the shared `--grid-2-1` template.
 */
function EditorPageSkeleton({
  label,
  tabs = 4,
  fields = 4,
}: {
  label?: string;
  tabs?: number;
  fields?: number;
}) {
  return (
    <Frame label={label}>
      <PageHeaderSkeleton back actions />
      {tabs > 0 && (
        <div className="flex h-10 w-fit max-w-full items-center gap-1 rounded-md bg-muted p-1">
          {Array.from({ length: tabs }, (_, index) => (
            <Skeleton key={index} className="h-8 w-24 rounded-sm bg-background" />
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-(--grid-2-1)">
        <SkeletonCard>
          <div className="flex flex-col gap-4">
            {Array.from({ length: fields }, (_, index) => (
              <SkeletonField key={index} />
            ))}
            <Skeleton className="h-40 w-full" />
          </div>
        </SkeletonCard>
        <div className="flex flex-col gap-4">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </div>
      </div>
    </Frame>
  );
}

/** One record: header, then label/value cards two across. */
function DetailPageSkeleton({ label, cards = 2 }: { label?: string; cards?: number }) {
  return (
    <Frame label={label}>
      <PageHeaderSkeleton back actions />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: cards }, (_, card) => (
          <SkeletonCard key={card}>
            <SkeletonHeading size="section" />
            <div className="grid grid-cols-(--grid-label-value) gap-x-6 gap-y-3 pt-2">
              {Array.from({ length: 4 }, (_, row) => (
                <div key={row} className="contents">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-40 max-w-full" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>
    </Frame>
  );
}

/**
 * MetricCard's shape (tokens.md §6.11): label + icon over a 32px value and
 * a meta line.
 */
function MetricCardSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="size-4 rounded-sm" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-4 w-32" />
    </SkeletonCard>
  );
}

/** The dashboard: four metrics (§3.1's stat grid), then the chart grid. */
function DashboardSkeleton({ label }: { label?: string }) {
  return (
    <Frame label={label}>
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2">
          <SkeletonHeading size="compact" />
          <Skeleton className="h-64 w-full" />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonHeading size="compact" />
          <SkeletonText lines={5} />
        </SkeletonCard>
      </div>
    </Frame>
  );
}

export {
  DashboardSkeleton,
  DetailPageSkeleton,
  EditorPageSkeleton,
  FormPageSkeleton,
  MetricCardSkeleton,
  PageHeaderSkeleton,
  TablePageSkeleton,
};
