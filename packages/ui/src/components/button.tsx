import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-072 — the reference's button anatomy (docs/design-system/
// tokens.md §6.1). Size NAMES are unchanged so no call site has to move;
// their VALUES are the reference's, which is why every control grew one step
// (default 32 → 40px). The focus treatment is the reference's 2px ring with
// a 2px offset, in the primary-derived --ring (ADR-072 §5).
const buttonVariants = cva(
  // Trailing-icon slide (changes-03-plan.md §4.2): opt-in by PRESENCE, not
  // a prop — it only does anything when the caller marks a child
  // data-icon="inline-end" (the existing convention, see rtl.test.tsx's
  // sibling components). RTL-flipped the same way ArrowRight icons already
  // are at call sites (`rtl:rotate-180`); reduced-motion is handled by the
  // global transition-duration reset in globals.css, not repeated here.
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>[data-icon=inline-end]]:transition-transform [&>[data-icon=inline-end]]:duration-(--duration-base) group-hover/button:[&>[data-icon=inline-end]]:translate-x-0.5 group-focus-visible/button:[&>[data-icon=inline-end]]:translate-x-0.5 rtl:group-hover/button:[&>[data-icon=inline-end]]:-translate-x-0.5 rtl:group-focus-visible/button:[&>[data-icon=inline-end]]:-translate-x-0.5",
  {
    variants: {
      variant: {
        // Hover is the engine-derived --primary-hover (ADR-003), which is
        // what the reference's `hover:bg-primary/90` becomes here.
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // The reference's signature hover: the warm beige --accent (dark mode
        // resolves --accent to the muted surface, ADR-072 §4).
        outline:
          "border-input bg-background hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        // Solid, like the reference (ADR-072 §9) — a destructive action is
        // the one that should be unmistakable. Label ink is engine-derived.
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Intent variants (changes-10, ADR-046) — an extension beyond the
        // reference. Tonal: the hue at /10, its *-interactive ink, /15 on
        // hover. /15 is the ceiling ADR-073 contracts the ink against; a
        // stronger tint under this ink would fall below 4.5:1.
        //
        // These exist so an action's COLOUR carries its consequence: publish
        // is success, un-publishing is a warning. Do not reach for them
        // decoratively — a page where six buttons each shout a different
        // colour communicates less than one where only the consequential
        // ones do.
        success: "bg-success/10 text-success-interactive hover:bg-success/15",
        warning: "bg-warning/10 text-warning-interactive hover:bg-warning/15",
        info: "bg-info/10 text-info-interactive hover:bg-info/15",
        // --primary-interactive, never raw --primary: bronze text on white is
        // 2.9:1 (ADR-018 rule 5).
        link: "text-primary-interactive underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3",
        sm: "h-9 px-3 has-data-[icon=inline-end]:pe-2.5 has-data-[icon=inline-start]:ps-2.5",
        xs: "h-8 gap-1.5 px-3 text-xs has-data-[icon=inline-end]:pe-2.5 has-data-[icon=inline-start]:ps-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        "2xs":
          "h-7 gap-1.5 px-2 text-xs has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-8 has-data-[icon=inline-end]:pe-6 has-data-[icon=inline-start]:ps-6",
        // Public design system (ADR-018) — hero/CTA-band buttons, one step
        // above `lg` so the hierarchy survives the reference's larger scale.
        xl: "h-12 px-6 text-base has-data-[icon=inline-end]:pe-5 has-data-[icon=inline-start]:ps-5 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-10",
        "icon-sm": "size-9",
        // A row action in a default-density table: 32px box, 16px glyph.
        "icon-xs": "size-8",
        // A row action in a compact table: 24px box, 14px glyph.
        "icon-2xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11",
      },
      shape: {
        default: "",
        // Public design system (ADR-018) — pill-shaped CTAs. A separate axis
        // rather than folded into `size`, so any size can opt in. Comes after
        // `size` in this object so tailwind-merge lets `rounded-full` win.
        pill: "rounded-full",
      },
      // The reference's sign-in submit: a soft shadow and a primary ring, so
      // the one action on a page reads as THE action. A prop, not a class
      // string repeated at call sites.
      emphasis: {
        false: "",
        true: "shadow-md ring-1 ring-primary/40 hover:ring-primary/60",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
      emphasis: false,
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  shape = "default",
  emphasis = false,
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
      className={cn(buttonVariants({ variant, size, shape, emphasis, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
