"use client";

// The reference editor's stats strip + keyword-density panel (changes-07 §1.2).
// Everything here is derived from `@repo/utils`'s pure helpers and is ADVISORY:
// no value on this panel gates a save (plan §9 risk 5), however authoritative
// the reference tool makes its percentages look.
//
// changes-10 items 2–3 restyled both halves. The four counts were flat
// numbers on one grey wash and read as a single undifferentiated block; each
// is now a card carrying its own tinted icon, so "how long is this piece" and
// "how many keywords am I targeting" are separable at a glance. The keyword
// strip was the same muted grey as everything around it despite being the
// one part of the panel the author is meant to act on — it now sits on its
// own tinted surface with per-keyword verdicts.

import { useMemo } from "react";
import type { ComponentType } from "react";
import { Clock, FileText, Tags, Type } from "lucide-react";
import { OPTIMAL_DENSITY, analyzeContent, keywordDensity, parseKeywords } from "@repo/utils";
import { cn } from "@repo/ui/lib/utils";

export interface ContentStatsLabels {
  words: string;
  characters: string;
  readingTime: string;
  minutesSuffix: string;
  keywords: string;
  densityTitle: string;
  densityHint: string;
  densityEmpty: string;
}

type Accent = "primary" | "info" | "warning" | "success";

const TILE_ACCENT: Record<Accent, { card: string; media: string }> = {
  primary: {
    card: "border-primary/20 bg-primary/5",
    media: "bg-primary/10 text-primary-interactive",
  },
  info: { card: "border-info/20 bg-info/5", media: "bg-info/10 text-info-interactive" },
  warning: {
    card: "border-warning/20 bg-warning/5",
    media: "bg-warning/10 text-warning-interactive",
  },
  success: {
    card: "border-success/20 bg-success/5",
    media: "bg-success/10 text-success-interactive",
  },
};

function Tile({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  accent: Accent;
}) {
  const tone = TILE_ACCENT[accent];
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5 rounded-lg border p-2.5", tone.card)}>
      <span
        aria-hidden
        className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tone.media)}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-base font-semibold tabular-nums">{value}</span>
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

export function ContentStats({
  body,
  focusKeywords,
  labels,
}: {
  body: string;
  focusKeywords: string;
  labels: ContentStatsLabels;
}) {
  const keywords = useMemo(() => parseKeywords(focusKeywords), [focusKeywords]);
  const stats = useMemo(() => analyzeContent(body), [body]);
  const density = useMemo(() => keywordDensity(body, keywords), [body, keywords]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label={labels.words}
          value={stats.words.toLocaleString()}
          icon={FileText}
          accent="primary"
        />
        <Tile
          label={labels.characters}
          value={stats.characters.toLocaleString()}
          icon={Type}
          accent="info"
        />
        <Tile
          label={labels.readingTime}
          value={`${stats.readingMinutes} ${labels.minutesSuffix}`}
          icon={Clock}
          accent="warning"
        />
        <Tile
          label={labels.keywords}
          value={String(keywords.length)}
          icon={Tags}
          accent="success"
        />
      </div>

      {/* The highlighted-keyword block (changes-10 item 3). Deliberately the
          only tinted surface in this panel that isn't a count: it is the one
          part an author is expected to read and respond to. */}
      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-warning/25 bg-warning/5 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-semibold">{labels.densityTitle}</span>
          <span className="text-xs text-muted-foreground">{labels.densityHint}</span>
        </div>
        {density.length === 0 ? (
          <p className="text-xs text-muted-foreground">{labels.densityEmpty}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {density.map((entry) => {
              const inBand =
                entry.density >= OPTIMAL_DENSITY.min && entry.density <= OPTIMAL_DENSITY.max;
              return (
                <span
                  key={entry.keyword}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs",
                    inBand ? "border-success/40" : "border-warning/40",
                  )}
                >
                  {/* Colour is never the only carrier: the dot has a tone AND
                      the percentage itself states the value (a11y gate). */}
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      inBand ? "bg-success" : "bg-warning",
                    )}
                  />
                  <span className="truncate font-medium">{entry.keyword}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {entry.density.toFixed(1)}%
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
