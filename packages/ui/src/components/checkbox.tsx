"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@repo/ui/lib/utils";
import { CheckIcon } from "lucide-react";

// changes-20 / ADR-074 — the reference's checkbox (tokens.md §6.14): a 16px
// rounded-sm box that fills with the brand when checked. One accessible
// deviation: the BOUNDARY is --primary-interactive in every state, because
// raw bronze on white is 2.9:1 and WCAG 1.4.11 asks 3:1 of a control's edge.
// The checked fill stays the brand --primary, so it still reads as the
// reference's bronze box.
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // `after:` enlarges the hit area without moving the box (the
        // existing Field integration relies on the box's own size).
        "peer relative grid size-4 shrink-0 place-content-center rounded-sm border border-primary-interactive transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 group-has-disabled/field:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-checked:bg-primary data-checked:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
