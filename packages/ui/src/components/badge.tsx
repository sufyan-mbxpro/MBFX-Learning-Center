import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@repo/ui/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Public design system (ADR-018). The small uppercase label above a
        // SectionHeading — "ACCOUNT", "TRADING PLATFORMS" in the reference.
        // Tinted background + --primary-interactive TEXT, never raw
        // --primary: ADR-018 rule 5 exists exactly because raw --primary is
        // 1.79:1 on white, invisible as small text.
        // bg-primary/10 (an alpha tint over whatever the current surface
        // is), NOT --primary-subtle: --primary-subtle is a fixed near-white
        // tint (shade toward white) that does not adapt to dark mode, while
        // --primary-interactive IS computed against --background. Pairing
        // the two broke in dark mode — the badge rendered light text on a
        // still-light "subtle" tint (Lighthouse caught this, 1.65:1 against
        // an expected 4.5:1). An alpha tint shifts WITH the background in
        // both modes, so the pairing stays self-consistent — same fix
        // Alert already uses for bg-destructive/5 etc.
        eyebrow:
          "h-auto gap-1.5 border-transparent bg-primary/10 px-2.5 py-1 font-semibold tracking-wide text-primary-interactive uppercase",
        // A larger, neutral chip for card metadata (the "Day Trading" /
        // "Economic" category tags on article cards) — distinct from the
        // default badge's compact size, not a shape change (both are
        // already the pill radius via rounded-4xl in the base classes).
        pill: "h-6 gap-1.5 border-transparent bg-muted px-3 font-medium text-foreground [a]:hover:bg-muted/70",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
