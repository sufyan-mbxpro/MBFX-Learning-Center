"use client";

// Added via `shadcn add accordion` against this package's base-nova
// registry (ADR-013, Module 07 SKILL.md) — not hand-copied. Fills the gap
// found re-verifying docs/changes/changes-03-plan.md §4.1: the reference's
// "Who we are / What we do / How it works" block and the homepage FAQ
// section both need one and @repo/ui had none.
//
// changes-20 (tokens.md §6.14, capture-2 method): the reference's recipe,
// shadcn `default` exactly — a divider under EVERY item, a 16px-padded
// trigger with centred text and ONE chevron that turns 180° when open, and
// `pb-4` content. `hover:underline` is the reference's own, not a leftover.
// The one addition is the focus ring the reference leaves to the browser:
// our 2px ring with a 2px offset in `--ring`, as on every other control.
// Base UI signals "open" on the trigger through `aria-expanded`, which is
// what the chevron keys off (Radix's `data-[state=open]` has no equivalent).
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";

import { cn } from "@repo/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b", className)}
      {...props}
    />
  );
}

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger flex flex-1 items-center justify-between gap-4 rounded-sm py-4 text-start font-medium transition-all outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:pointer-events-none aria-disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon
          data-slot="accordion-trigger-icon"
          aria-hidden
          className="pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up"
      {...props}
    >
      <div
        className={cn(
          "h-(--accordion-panel-height) pt-0 pb-4 data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
