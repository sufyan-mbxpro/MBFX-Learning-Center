"use client";

import * as React from "react";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-072 (tokens.md §6.8) — the reference's view chips: the
// "Default / IB & Referrals / Admin Ownership …" row above its Users table.
// A horizontal, scrollable row of equal pills (min 110px, `flex-1`), the
// selected one filled with the brand. Semantically a single-select toggle
// group (Base UI's ToggleGroup: aria-pressed buttons, roving focus), which is
// what a "choose one column preset" control is — not tabs, because nothing
// here owns a panel.

function ViewChips({
  className,
  value,
  onValueChange,
  ...props
}: Omit<ToggleGroupPrimitive.Props, "value" | "onValueChange" | "multiple"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <ToggleGroupPrimitive
      data-slot="view-chips"
      value={[value]}
      // A view is always selected: ignore the empty array a toggle-off sends.
      onValueChange={(next) => {
        const chosen = next[0];
        if (chosen !== undefined) onValueChange(chosen);
      }}
      className={cn(
        "no-scrollbar flex w-full items-center gap-2 overflow-x-auto pb-0.5 whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

function ViewChip({ className, ...props }: TogglePrimitive.Props) {
  return (
    <TogglePrimitive
      data-slot="view-chip"
      className={cn(
        "inline-flex min-w-27.5 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-pressed:border-primary data-pressed:bg-primary data-pressed:font-medium data-pressed:text-primary-foreground [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export { ViewChip, ViewChips };
export type ViewChipsProps = React.ComponentProps<typeof ViewChips>;
