"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@repo/ui/lib/utils";

// Base UI's Indicator computes its own `width: {percentageValue}%` inline
// (logical `insetInlineStart`, so RTL is free) — no manual transform math
// needed here, unlike the classic Radix recipe.
function Progress({ className, ...props }: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root data-slot="progress" className={cn("w-full", className)} {...props}>
      <ProgressPrimitive.Track
        data-slot="progress-track"
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
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
