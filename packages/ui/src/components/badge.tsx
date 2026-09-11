import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-072 — the reference's badge (tokens.md §6.6): a pill,
// semibold, in three sizes. The status language is TONAL (hue at /10, its
// own ink) exactly as the reference draws it, with one correction under
// ADR-072 §1 / ADR-073: the ink is the hue's *-interactive derivation, which
// holds 4.5:1 inside its own /10–/15 tint. The reference's raw-hue ink
// measured 3.95–4.41:1 there.
const badgeVariants = cva(
  // `items-center justify-center` centres the label in every size (ADR-044's
  // "Badge centres its own text"); the fixed-height sizes add `leading-none`
  // so the glyph box cannot push the pill off its height.
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    // `size` is declared BEFORE `variant` on purpose: cva emits classes in
    // key order and tailwind-merge keeps the last, so a variant that owns its
    // own geometry (`eyebrow`, `pill`) overrides the size's padding.
    variants: {
      size: {
        default: "px-2.5 py-0.5 text-xs",
        // Inline status beside a page description.
        sm: "h-5 px-1.5 text-3xs leading-none font-medium",
        // Status in a compact table row. The reference's 9px is folded into
        // 10px (ADR-072 §7 — nothing renders below 10px).
        xs: "h-4 px-1.5 text-3xs leading-none",
      },
      variant: {
        default: "border-transparent bg-primary text-primary-foreground [a]:hover:bg-primary-hover",
        // The reference's dark country/metadata pills ("N/A", "PK").
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        outline: "border-border text-foreground [a]:hover:bg-accent",
        // Solid, like the reference's count and alert pills. A destructive
        // STATUS ("rejected", "failed") is `danger`, the tonal one.
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a]:hover:bg-destructive/90",
        // Tonal status (ADR-073): /10 tint, /20 hairline, tint-safe ink.
        success: "border-success/20 bg-success/10 text-success-interactive",
        warning: "border-warning/20 bg-warning/10 text-warning-interactive",
        info: "border-info/20 bg-info/10 text-info-interactive",
        danger: "border-destructive/20 bg-destructive/10 text-destructive-interactive",
        // Outlined status ("Market Live", "Net $4.6M"). The line is the
        // *-interactive value too: raw --warning is 2.0:1 on white, below the
        // 3:1 floor a 1px border must clear (ADR-018 rule 5).
        "outline-success": "border-success-interactive text-success-interactive",
        "outline-warning": "border-warning-interactive text-warning-interactive",
        "outline-info": "border-info-interactive text-info-interactive",
        "outline-danger": "border-destructive-interactive text-destructive-interactive",
        ghost: "border-transparent hover:bg-muted hover:text-muted-foreground",
        link: "border-transparent text-primary-interactive underline-offset-4 hover:underline",
        // Public design system (ADR-018). The small uppercase label above a
        // SectionHeading. Tint + --primary-interactive, never raw --primary,
        // and an ALPHA tint (not --primary-subtle, a fixed near-white) so the
        // pairing holds in dark mode — the Lighthouse catch at 1.65:1.
        eyebrow:
          "h-auto gap-1.5 border-transparent bg-primary/10 px-2.5 py-1 tracking-wide text-primary-interactive uppercase",
        // A larger neutral chip for card metadata (article category tags).
        pill: "h-6 gap-1.5 border-transparent bg-muted px-3 font-medium text-foreground [a]:hover:bg-muted/70",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  },
);

type BadgeProps = useRender.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /**
     * A pulsing dot before the label — the reference's "Live" / "Market
     * Live" marker. Drawn in the badge's own ink (`bg-current`), so it
     * matches any variant without a colour prop.
     */
    live?: boolean;
  };

function Badge({
  className,
  variant = "default",
  size = "default",
  live = false,
  render,
  children,
  ...props
}: BadgeProps) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ size, variant }), className),
        children: live ? (
          <>
            <span
              aria-hidden
              data-slot="badge-live-dot"
              className={cn(
                "shrink-0 animate-pulse rounded-full bg-current",
                size === "default" ? "me-1 size-2" : "size-1.5",
              )}
            />
            {children}
          </>
        ) : (
          children
        ),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
      size,
    },
  });
}

export { Badge, badgeVariants };
export type { BadgeProps };
