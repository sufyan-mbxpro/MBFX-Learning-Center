import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-074 — the reference's textarea (tokens.md §6.14): the
// Input's box, border, background and focus ring, at an 80px minimum height.
// `field-sizing-content` keeps the existing grow-with-content behaviour,
// which the reference's fixed textarea lacks but which costs nothing to keep.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
