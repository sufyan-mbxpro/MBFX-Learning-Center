"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-072 (tokens.md §6.8) — the reference's tabs, shadcn
// `default` exactly (capture-2): a 40px muted tray with a 4px inset, no
// border, rounded-sm triggers at px-3 py-1.5, and the active tab raised onto
// the page background with shadow-sm. The `line` variant is ours (an
// underline on top of the same tray) and is kept as an extension.

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  );
}

// `max-w-full overflow-x-auto no-scrollbar`: a tray with more tabs than the
// screen has room for SCROLLS instead of widening the page — the reference
// does the same at its call sites. Found in the admin phone-width pass: the
// article editor's four SEO tabs made a 414px tray on a 390px screen.
// `justify-start`, not `-center`: centred content that overflows spills off
// BOTH ends and its start becomes unreachable. While the tray fits, the two
// are identical (`w-fit` list, `flex-1` triggers). `p-1` leaves room for a
// trigger's focus ring inside the scroll container.
const tabsListVariants = cva(
  "group/tabs-list no-scrollbar inline-flex w-fit max-w-full items-center justify-start overflow-x-auto rounded-md bg-muted p-1 text-muted-foreground group-data-horizontal/tabs:h-10 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "",
        line: "gap-1",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "group/tabs-trigger relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all outline-none group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-active:bg-background data-active:text-foreground data-active:shadow-sm",
        // `line` only: an underline in the derived brand ink, hugging the
        // raised pill's inner edge.
        "after:absolute after:bg-primary-interactive after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-1.5 group-data-horizontal/tabs:after:bottom-0.5 group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-1.5 group-data-vertical/tabs:after:end-0.5 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The count a tab carries ("Account & security 4"). changes-61: every count
 * in a strip was the same solid dark chip, so five equal marks competed with
 * the one raised tab for attention. Only the ACTIVE tab's count is filled —
 * the same `--secondary` pair the chip always had — and the others are a
 * quiet muted chip in the tray's own ink, so the strip reads as one choice
 * plus four options. The state comes from the trigger (`data-active` on the
 * `group/tabs-trigger` above), so a call site cannot get it wrong.
 */
function TabsCount({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tabs-count"
      className={cn(
        "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm px-1.5 text-3xs leading-none font-semibold tabular-nums transition-colors",
        "bg-background/70 text-muted-foreground",
        "group-data-active/tabs-trigger:bg-secondary group-data-active/tabs-trigger:text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        "flex-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsCount, tabsListVariants };
