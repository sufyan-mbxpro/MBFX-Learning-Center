import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@repo/ui/lib/utils";

// No hardcoded label (code-style.md #2): pass `aria-label` from a message
// catalog to announce a standalone spinner; without one it renders as a
// purely decorative icon and the surrounding container owns the status text
// (the PageLoader/SectionLoader pattern). The mark itself is the branded
// loading animation (changes-05) — four rounded squares morphing/rotating,
// styled entirely in globals.css's brand-loader-* rules so every consumer
// here (buttons, PageLoader, SectionLoader, toasts) picks it up with no
// call-site changes.
//
// changes-21 Phase A — ONE spinner, sized by WHERE it sits rather than by
// pixels. The inline steps are tokens.md §5's icon sizes; `section`/`page`/
// `overlay` are the three loader scales that own a region. `inherit` emits no
// size at all, so inside a Button the button's own icon rule sizes it: a
// loading `xs` button gets a 14px mark and a default one 16px, with no call
// site knowing either number.
//
// `tone`: the brand mark is primary-filled, which vanishes on a primary fill —
// a loading default Button drew bronze on bronze, which is exactly what the
// three sign-in submits shipped. `current` follows the text colour, which is
// what a spinner INSIDE a control needs. Button's `loading` prop uses it.
const spinnerVariants = cva("shrink-0", {
  variants: {
    size: {
      inherit: "",
      xs: "size-3",
      sm: "size-3.5",
      default: "size-4",
      lg: "size-5",
      section: "size-10",
      page: "size-16",
      overlay: "size-20",
    },
  },
  defaultVariants: { size: "default" },
});

function Spinner({
  className,
  size,
  tone = "brand",
  ...props
}: React.ComponentProps<"svg"> &
  VariantProps<typeof spinnerVariants> & {
    /** `brand` = the primary-filled mark; `current` = the surrounding text colour. */
    tone?: "brand" | "current";
  }) {
  const labelled = "aria-label" in props && props["aria-label"];
  return (
    <svg
      data-slot="spinner"
      data-tone={tone}
      role={labelled ? "status" : undefined}
      aria-hidden={labelled ? undefined : true}
      viewBox="0 0 128 128"
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    >
      <g className={tone === "current" ? "fill-current" : "fill-primary"}>
        <g className="brand-loader__g">
          <g transform="translate(20,20) rotate(0,44,44)">
            <g>
              <rect height="40" width="40" ry="8" rx="8" className="brand-loader__rect" />
              <rect
                transform="translate(0,48)"
                height="40"
                width="40"
                ry="8"
                rx="8"
                className="brand-loader__rect"
              />
            </g>
            <g transform="rotate(180,44,44)">
              <rect height="40" width="40" ry="8" rx="8" className="brand-loader__rect" />
              <rect
                transform="translate(0,48)"
                height="40"
                width="40"
                ry="8"
                rx="8"
                className="brand-loader__rect"
              />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

export { Spinner, spinnerVariants };
