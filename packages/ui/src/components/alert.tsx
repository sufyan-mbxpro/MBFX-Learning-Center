// Inline (non-toast) messaging primitive (server-safe). Status variants
// use the brand-extension tokens so a rebrand recolors them.
//
// changes-20 / ADR-074 — the reference's alert (tokens.md §6.14,
// capture-2): a rounded-lg bordered block with 16px padding and the icon
// pinned at the top-start, its text indented past it. Two corrections:
// destructive text is --destructive-interactive (the raw red fails 4.5:1 on
// its own tint — ADR-074 §3), and the layout uses scale values instead of the
// previous arbitrary grid tracks.
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@repo/ui/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 text-sm [&>svg]:absolute [&>svg]:start-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg~*]:ps-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground [&>svg]:text-foreground",
        destructive:
          "border-destructive/50 bg-destructive/5 text-destructive-interactive [&>svg]:text-destructive-interactive",
        // Extensions beyond the reference, in the same tonal recipe. Their
        // /5 wash is inside ADR-073's /15 contract, so the ink holds.
        success:
          "border-success/30 bg-success/5 text-success-interactive [&>svg]:text-success-interactive",
        warning:
          "border-warning/30 bg-warning/5 text-warning-interactive [&>svg]:text-warning-interactive",
        info: "border-info/30 bg-info/5 text-info-interactive [&>svg]:text-info-interactive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("mb-1 leading-none font-medium tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-sm [&_p]:leading-relaxed", className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
