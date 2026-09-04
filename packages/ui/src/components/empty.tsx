// Empty-state primitive (server-safe — no client runtime). Gives every
// "nothing here yet" the same shape: optional icon, title, supporting
// copy, optional CTA. All text arrives from the caller's catalog.
import { cn } from "@repo/ui/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-8 text-center",
        className,
      )}
      {...props}
    />
  );
}

function EmptyMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-media"
      className={cn(
        "mb-2 flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg:not([class*='size-'])]:size-5",
        className,
      )}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn("max-w-sm text-sm text-balance text-muted-foreground", className)}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("mt-3 flex flex-wrap items-center justify-center gap-2", className)}
      {...props}
    />
  );
}

export { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle };
