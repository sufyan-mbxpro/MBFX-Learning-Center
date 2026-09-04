import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@repo/ui/lib/utils";

const buttonVariants = cva(
  // Trailing-icon slide (changes-03-plan.md §4.2): opt-in by PRESENCE, not
  // a prop — it only does anything when the caller marks a child
  // data-icon="inline-end" (the existing convention, see rtl.test.tsx's
  // sibling components). RTL-flipped the same way ArrowRight icons already
  // are at call sites (`rtl:rotate-180`); reduced-motion is handled by the
  // global transition-duration reset in globals.css, not repeated here.
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>[data-icon=inline-end]]:transition-transform [&>[data-icon=inline-end]]:duration-(--duration-base) group-hover/button:[&>[data-icon=inline-end]]:translate-x-0.5 group-focus-visible/button:[&>[data-icon=inline-end]]:translate-x-0.5 rtl:group-hover/button:[&>[data-icon=inline-end]]:-translate-x-0.5 rtl:group-focus-visible/button:[&>[data-icon=inline-end]]:-translate-x-0.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
        // Public design system (ADR-018) — the reference's hero/CTA-band
        // buttons are visibly larger than any existing admin-surface size.
        xl: "h-11 gap-2 px-6 text-base has-data-[icon=inline-end]:pe-5 has-data-[icon=inline-start]:ps-5 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
      shape: {
        default: "",
        // Public design system (ADR-018) — the reference's pill-shaped CTA
        // buttons. A separate axis rather than folding into `size`, so any
        // size can opt in independently. Comes after `size` in this object
        // so cva's generated class order lets `rounded-full` win over the
        // size/radius classes above it via twMerge (see the identical
        // technique documented on Container's wide/narrow classes).
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  shape = "default",
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      // Base UI defaults nativeButton to true, assuming `render` (when
      // given) still resolves to a real <button> — every call site in this
      // repo uses `render` to become a Next.js <Link> instead (an <a>), so
      // default to false whenever `render` is supplied. A call site that
      // genuinely renders a native <button> via `render` can still pass
      // nativeButton explicitly to override this.
      nativeButton={nativeButton ?? !props.render}
      className={cn(buttonVariants({ variant, size, shape, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
