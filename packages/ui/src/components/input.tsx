import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-072 — the reference's input (tokens.md §6.2): a 40px box
// on the page background, bordered in --input (the 3:1 slate border, not the
// reference's 1.23:1 divider colour — ADR-072 §4). `text-base` below `md`
// keeps iOS Safari from zooming the page when the field takes focus.
const inputVariants = cva(
  "flex w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base transition-colors outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm",
  {
    variants: {
      size: {
        // Forms.
        default: "h-10",
        // Table toolbars — the reference's filter row.
        sm: "h-9",
        // Compact search inside a card.
        xs: "h-8 text-xs md:text-xs",
      },
    },
    defaultVariants: { size: "default" },
  },
);

type InputProps = Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>;

// `size` is the visual size here. The native `size` attribute (a character
// count) is omitted on purpose — nothing in the repo uses it, and a numeric
// `size` silently widening a field would fight the width utilities.
function Input({ className, type, size = "default", ...props }: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };
export type { InputProps };
