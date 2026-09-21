import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-075 — the reference's card (tokens.md §6.11, capture-2):
// rounded-lg, a 1px border, shadow-sm, and a 24px rhythm; no band on the
// header or the footer (superseding ADR-050's band).
//
// The rhythm lives in ONE variable, --card-spacing: the card's block
// padding, the gap between its parts, and each part's inline padding. That
// reproduces the reference's `p-6` header + `p-6 pt-0` content exactly, so a
// call site composes Header/Content/Footer and never pads a part by hand.
// `size="sm"` is the 16px rhythm for compact tiles. A full-bleed cover is
// the card's first child — a bare <img>, or any wrapper marked
// `data-slot="card-media"` (a linked cover, a figure with a badge) — and the
// card drops its top padding for it, so a media card never pads by hand.
//
// Public design system additions (changes-03-plan.md §4.2). "elevated"'s
// resting/hover shadow is a data-attribute rule in globals.css, not a
// `hover:shadow-card-hover` utility class here — that utility would compile
// ABOVE .card-hover's own hover rule in the stylesheet (Tailwind's
// generated layer sits at this file's `@import "tailwindcss"` line) and
// silently lose, the same reordering trap Container's wide/narrow classes
// document. "featured" uses the `border` property instead of `ring`,
// deliberately: card-hover's `:hover` rule already owns `--tw-ring-color`,
// so a variant-specific ring color would revert to the generic one on hover;
// `border` shares no custom property with it.
const CARD_VARIANT_CLASS = {
  default: "",
  elevated: "",
  // Kept for call-site compatibility; every card is bordered now.
  bordered: "",
  // bg-primary/10, not --primary-subtle: the card's own text still uses
  // text-card-foreground, computed for legibility against --card/
  // --background. --primary-subtle is a fixed near-white tint that stays
  // light even in dark mode, so pairing it with the dark-mode light ink
  // would fail contrast (the same bug Lighthouse caught on Badge's eyebrow
  // — see that file). An alpha tint shifts with the surface in both modes.
  featured: "border-2 border-primary-interactive bg-primary/10",
  // changes-31 / ADR-101 §4 — the PUBLIC card: separated by air, not by a box.
  // The white surface against the ivory ground (ADR-101 §2) is what makes it
  // read as a card; the gap between cards does the rest.
  //
  // `border-transparent`, not `border-0`: the 1px box stays, so a plain card
  // and a bordered one occupy exactly the same geometry and a page mixing the
  // two does not jump by a pixel per card. Hover is untouched — `.card-hover`
  // still lifts the ring and the shadow, which is the one moment elevation
  // earns its keep.
  plain: "border-transparent shadow-none",
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
        // like surface shares (changes-02); ADR-075 §4 keeps it.
        "group/card card-hover flex flex-col gap-(--card-spacing) overflow-hidden rounded-lg border bg-card py-(--card-spacing) text-sm text-card-foreground shadow-sm [--card-spacing:--spacing(6)] has-[>img:first-child]:pt-0 has-[>[data-slot=card-media]:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg",
        CARD_VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid grid-cols-1 auto-rows-min items-start gap-1.5 px-(--card-spacing) has-data-[slot=card-action]:grid-cols-(--grid-fill-auto) has-data-[slot=card-description]:grid-rows-(--grid-auto-auto)",
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
        "text-2xl leading-none font-semibold tracking-tight group-data-[size=sm]/card:text-base",
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
      className={cn(
        "col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-start justify-self-end",
        className,
      )}
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
      className={cn("flex items-center px-(--card-spacing)", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
