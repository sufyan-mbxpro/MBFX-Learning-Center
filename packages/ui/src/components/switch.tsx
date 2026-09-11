"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-074 — the reference's switch (tokens.md §6.14): a 44×24
// track with a 20px thumb. The unchecked track is --input (the 3:1 slate
// line). One accessible deviation: the CHECKED track is --primary-interactive
// rather than raw bronze, which is 2.9:1 against the page — below the 3:1 a
// control needs — and leaves the white thumb at 2.9:1 against the track.
//
// The previous `size` prop had no call sites and the reference has one size,
// so it is gone rather than kept as an untested second geometry.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer group/switch relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-checked:bg-primary-interactive data-unchecked:bg-input data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        // translate-x has no logical axis, so the RTL direction is flipped by
        // hand, as the rest of @repo/ui does for translateX.
        className="pointer-events-none block size-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-checked:translate-x-5 data-unchecked:translate-x-0 rtl:data-checked:-translate-x-5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
