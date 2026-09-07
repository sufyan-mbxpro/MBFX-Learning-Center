import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

// Public design system additions (changes-03-plan.md §4.2). "elevated"'s
// resting/hover shadow is a data-attribute rule in globals.css, not a
// `hover:shadow-card-hover` utility class here — that utility would compile
// ABOVE .card-hover's own hover rule in the stylesheet (Tailwind's
// generated layer sits at this file's `@import "tailwindcss"` line) and
// silently lose, the same reordering trap Container's wide/narrow classes
// document. "bordered"/"featured" use the `border` property instead of
// `ring`, deliberately: card-hover's `:hover` rule already owns
// `--tw-ring-color`, so a variant-specific ring color would revert to the
// generic one on hover; `border` shares no custom property with it.
const CARD_VARIANT_CLASS = {
  default: "",
  elevated: "",
  bordered: "border border-border",
  // bg-primary/10, not --primary-subtle: the card's own text still uses
  // text-card-foreground, computed for legibility against --card/
  // --background. --primary-subtle is a fixed near-white tint that stays
  // light even in dark mode, so pairing it with the dark-mode light ink
  // would fail contrast (the same bug Lighthouse caught on Badge's eyebrow
  // — see that file). An alpha tint shifts with the surface in both modes.
  featured: "border-2 border-primary-interactive bg-primary/10",
} as const;

function Card({
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm";
  variant?: keyof typeof CARD_VARIANT_CLASS;
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn(
        // `card-hover` (globals.css) is THE one hover treatment every card-
        // like surface shares (changes-02) — AdminSection and the article
        // editor panels use the same utility, so a tweak lands everywhere.
        // `has-[>[data-slot=card-header]:not(:last-child)]:pt-0` is the
        // mirror of the footer's `has-data-[slot=card-footer]:pb-0`
        // (ADR-050): a header that carries a band must start at the card's
        // top edge, not float with a strip of card background above it.
        // The `:not(:last-child)` half matters — a header-only card (the
        // settings hub, the glossary spotlight grid) has no band and keeps
        // its normal top padding.
        "group/card card-hover flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 has-[>[data-slot=card-header]:not(:last-child)]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        CARD_VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    />
  );
}

// ADR-050: a header that has content under it is chrome, and reads as
// chrome — the same `border-b bg-muted/50` band CardFooter has always
// carried, mirrored. `not-last:` is the whole safety of making it the
// default: a card whose header IS the card (settings hub, glossary
// spotlight) would be entirely tinted otherwise, which distinguishes
// nothing. A band that covers everything is not a band.
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) not-last:border-b not-last:bg-muted/50 not-last:py-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
