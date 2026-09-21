// Learning-progress graphics (changes-44 #4): the rings, bars and diverging
// rows that sit above each table on /admin/learn/progress.
//
// Server components drawn in CSS, for the reason `dashboard-content-charts.tsx`
// gives: every figure here is a proportion of a whole or a count against the
// longest row, which is a `<div>` with a width. Nothing needs an axis, a scale
// function or a client tree. The tables below each chart stay — they are the
// chart's table view, and the exact numbers.
//
// Colour is by JOB, from theme tokens only (code-style.md #1):
//   - completed / helpful → `success`; dropped off → `warning`; not helpful →
//     `destructive`; the untaken rest of a whole → `muted`.
//   - a quiz's pass-rate bar takes a status tone by band (PASS_RATE_BANDS), and
//     its percentage is always printed beside it, so the colour is never the
//     only carrier of the value.
// Every row carries a `title` with its exact figures as the hover layer.
import { cn } from "@repo/ui/lib/utils";
import { MetaText } from "@repo/ui/components/typography";

type Tone = "success" | "warning" | "destructive" | "info" | "primary";

const FILL: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  primary: "bg-primary",
};

const RING: Record<Tone, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  destructive: "var(--color-destructive)",
  info: "var(--color-info)",
  primary: "var(--color-primary)",
};

/** A quiz pass rate's tone. Ordered high → low; the first band it clears wins. */
export const PASS_RATE_BANDS: { min: number; tone: Tone }[] = [
  { min: 70, tone: "success" },
  { min: 40, tone: "warning" },
  { min: 0, tone: "destructive" },
];

export function passRateTone(rate: number): Tone {
  return PASS_RATE_BANDS.find((band) => rate >= band.min)?.tone ?? "destructive";
}

/** Share of `whole`, as a 0–100 percentage safe for a width. */
export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

function Swatch({ tone, label }: { tone: Tone | "muted"; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={cn("size-2.5 rounded-sm", tone === "muted" ? "bg-muted" : FILL[tone])}
      />
      {label}
    </span>
  );
}

export function ChartLegend({ items }: { items: { tone: Tone | "muted"; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <Swatch key={item.label} {...item} />
      ))}
    </div>
  );
}

/** One headline percentage as a donut: the number in the middle, the ring its share. */
export function RateRing({
  value,
  label,
  detail,
  tone,
}: {
  /** 0–100. */
  value: number;
  label: string;
  /** One line under the label — what the percentage is OF. */
  detail: string;
  tone: Tone;
}) {
  const rounded = Math.round(value);
  return (
    <div className="flex items-center gap-4" title={`${label}: ${rounded}% — ${detail}`}>
      <div
        aria-hidden
        className="relative size-24 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${RING[tone]} ${rounded}%, var(--color-muted) 0)`,
        }}
      >
        <div className="absolute inset-2.5 flex items-center justify-center rounded-full bg-card">
          <span className="text-xl font-bold tabular-nums">{rounded}%</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        {/* The number is aria-hidden in the ring, so it is read here. */}
        <span className="text-sm font-semibold">
          {label}
          <span className="sr-only">: {rounded}%</span>
        </span>
        <MetaText>{detail}</MetaText>
      </div>
    </div>
  );
}

/**
 * A row per item: a label, a readout, and a track divided into up to two
 * coloured segments with the rest muted. `scale` is the value the full track
 * stands for — the row's own total for a proportion, the longest row's total
 * when rows should be compared by size.
 */
export function StackedBars({
  rows,
}: {
  rows: {
    key: string;
    label: string;
    /** Right-aligned figure, already formatted. */
    readout: string;
    /** Hover text with the exact counts. */
    title: string;
    scale: number;
    segments: { value: number; tone: Tone }[];
  }[];
}) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1" title={row.title}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{row.label}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{row.readout}</span>
          </div>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-sm bg-muted">
            {row.segments
              .filter((segment) => segment.value > 0)
              .map((segment, index) => (
                <div
                  key={index}
                  className={cn("h-full first:rounded-s-sm last:rounded-e-sm", FILL[segment.tone])}
                  style={{ width: `${percentOf(segment.value, row.scale)}%` }}
                />
              ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Helpful to the inline end, not-helpful to the inline start, from a shared
 * centre line — the feedback reads as a balance, which is what "net" means.
 * Both halves share one scale (the largest single count), so a long bar on
 * either side is the same number of votes.
 */
export function DivergingBars({
  rows,
  positiveLabel,
  negativeLabel,
}: {
  rows: { key: string; label: string; positive: number; negative: number }[];
  positiveLabel: string;
  negativeLabel: string;
}) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.positive, row.negative]));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li
          key={row.key}
          className="grid grid-cols-1 items-center gap-1 sm:grid-cols-(--grid-diverging-row) sm:gap-3"
          title={`${row.label} — ${positiveLabel}: ${row.positive}, ${negativeLabel}: ${row.negative}`}
        >
          <span className="truncate text-sm font-medium">{row.label}</span>
          <div className="grid grid-cols-2 items-center">
            <div className="flex items-center justify-end gap-2 border-e pe-0.5">
              <span className="text-xs text-muted-foreground tabular-nums">{row.negative}</span>
              <div
                className="h-2.5 rounded-s-sm bg-destructive"
                style={{ width: `${percentOf(row.negative, max)}%` }}
              />
            </div>
            <div className="flex items-center gap-2 ps-0.5">
              <div
                className="h-2.5 rounded-e-sm bg-success"
                style={{ width: `${percentOf(row.positive, max)}%` }}
              />
              <span className="text-xs text-muted-foreground tabular-nums">{row.positive}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
