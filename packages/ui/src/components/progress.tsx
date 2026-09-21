"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@repo/ui/lib/utils";

// Base UI's Indicator computes its own `width: {percentageValue}%` inline
// (logical `insetInlineStart`, so RTL is free) — no manual transform math
// needed here, unlike the classic Radix recipe.
//
// changes-20 (tokens.md §6.7): the track is `bg-muted` (Q15 — the reference's
// `bg-secondary` would be near-black with our brand secondary), and the
// reference's thin bars are sizes: `xs` 4px in a metric card, `sm` 6px in a
// list, `default` 8px.
const TRACK_HEIGHT = { xs: "h-1", sm: "h-1.5", default: "h-2" } as const;

/**
 * `aria-label` is REQUIRED, and that is the interesting part of this
 * component's API.
 *
 * A `role="progressbar"` with no accessible name is an axe
 * `aria-progressbar-name` violation every time — serious, so it fails the
 * gate — and unlike most a11y props there is nothing sensible the component
 * could default to: only the call site knows whether the bar measures a
 * budget, an upload, an SEO score or a quiz. Left optional, it was forgotten
 * on three real screens and five showcase blocks, and `/admin/ai` was the
 * page whose axe run finally said so.
 *
 * Pass a catalog string. `aria-labelledby` is the alternative for a bar whose
 * visible label is already on the page, and is accepted in its place.
 */
type ProgressLabel =
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never };

function Progress({
  className,
  size = "default",
  ...props
}: Omit<ProgressPrimitive.Root.Props, "aria-label" | "aria-labelledby"> & {
  size?: keyof typeof TRACK_HEIGHT;
} & ProgressLabel) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      data-size={size}
      className={cn("w-full", className)}
      {...props}
    >
      <ProgressPrimitive.Track
        data-slot="progress-track"
        className={cn("relative w-full overflow-hidden rounded-full bg-muted", TRACK_HEIGHT[size])}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="block h-full rounded-full bg-primary transition-(--transition-size) duration-300 ease-out data-[status=indeterminate]:w-1/3 data-[status=indeterminate]:animate-pulse"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
