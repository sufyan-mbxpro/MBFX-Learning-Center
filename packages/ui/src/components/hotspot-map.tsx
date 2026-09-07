"use client";

// The reference's numbered world map + legend (changes-09-plan.md §2).
//
// Accessibility shape, deliberately: the PINS are decorative and
// non-focusable, and the LEGEND rows are the interactive controls. The
// alternative — making both interactive — doubles every tab stop and reads
// each destination twice to a screen reader for no added capability. Mouse
// users still get pin hover, because a hover handler on a non-focusable
// span is a visual enhancement, not a control.
//
// Positioning is PHYSICAL `left`, and that is not an oversight — it is the
// one place in this repo where the logical property is the wrong answer.
// A pin's x is a longitude. Under `inset-inline-start` an RTL page would
// mirror the pin field while the map artwork underneath stayed put, and New
// York would land in Asia. Reading order flips; geography does not.
//
// `calc(x% - half)` rather than `translateX(-50%)` for the centring, since
// the translate would fight the hover scale on the same property.
//
// Percentages resolve against the ABSOLUTE ancestor, so the pins and the map
// share an inner un-padded box: with the padding on the same element, every
// pin would drift by the padding's share of the width.
//
// No JS-driven motion at all — the highlight is a CSS transition and the
// active pin's halo is a CSS keyframe gated on prefers-reduced-motion in
// globals.css (.pulse-ring). Nothing here needs to short-circuit, because
// nothing here schedules a frame.
import { useState } from "react";

import { cn } from "@repo/ui/lib/utils";

export interface HotspotPoint {
  id: string;
  label: string;
  /** Secondary line — the authorities, offices or teams at this location. */
  detail?: React.ReactNode;
  /** Percentages of the map box, 0–100. */
  x: number;
  y: number;
}

/** Half the pin's rendered size (size-7 → 1.75rem), used to centre it on its anchor. */
const PIN_HALF = "0.875rem";

function HotspotMap({
  points,
  mapSlot,
  legendLabel,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  points: readonly HotspotPoint[];
  /** The map artwork (an inline SVG or an <Image>); decorative, so it is aria-hidden here. */
  mapSlot?: React.ReactNode;
  legendLabel: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // ADR-047 §2 — no jurisdictions, no map.
  if (points.length === 0) return null;

  return (
    <div
      data-slot="hotspot-map"
      className={cn("grid gap-8 lg:grid-cols-[3fr_2fr] lg:items-center", className)}
      {...props}
    >
      <div
        aria-hidden
        className="w-full overflow-hidden rounded-2xl bg-muted/60 p-4 ring-1 ring-foreground/5"
      >
        <div className="relative w-full">
          {mapSlot ?? <div className="aspect-[2/1] w-full" />}
          {points.map((point, index) => (
            <span
              key={point.id}
              data-active={point.id === activeId ? "" : undefined}
              onMouseEnter={() => setActiveId(point.id)}
              onMouseLeave={() => setActiveId(null)}
              className="pulse-ring absolute flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-md transition-transform duration-(--duration-base) ease-(--ease-out-quint) data-active:scale-125"
              style={{
                left: `calc(${point.x}% - ${PIN_HALF})`,
                top: `calc(${point.y}% - ${PIN_HALF})`,
              }}
            >
              <span className="relative">{index + 1}</span>
            </span>
          ))}
        </div>
      </div>

      <ol aria-label={legendLabel} className="flex flex-col gap-2">
        {points.map((point, index) => (
          <li key={point.id}>
            <button
              type="button"
              data-active={point.id === activeId ? "" : undefined}
              onMouseEnter={() => setActiveId(point.id)}
              onMouseLeave={() => setActiveId(null)}
              onFocus={() => setActiveId(point.id)}
              onBlur={() => setActiveId(null)}
              className="group/place flex w-full items-start gap-3 rounded-xl p-3 text-start ring-1 ring-transparent transition-[background-color,box-shadow] duration-(--duration-base) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none data-active:bg-muted data-active:ring-primary/25"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary-interactive transition-colors duration-(--duration-base) group-data-active/place:bg-primary group-data-active/place:text-primary-foreground">
                {index + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold text-foreground">{point.label}</span>
                {point.detail && (
                  <span className="text-sm text-muted-foreground">{point.detail}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export { HotspotMap };
