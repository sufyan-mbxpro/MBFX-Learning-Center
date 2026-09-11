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

function Progress({
  className,
  size = "default",
  ...props
}: ProgressPrimitive.Root.Props & { size?: keyof typeof TRACK_HEIGHT }) {
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
          className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-out data-[status=indeterminate]:w-1/3 data-[status=indeterminate]:animate-pulse"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
