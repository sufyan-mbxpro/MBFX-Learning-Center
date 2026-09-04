// changes-03-plan.md §4.1 — the reference's numbered "How It Works" step,
// with the connector line between steps. `isLast` hides the connector on
// the final step in a row rather than the caller having to slice its array.
import { cn } from "@repo/ui/lib/utils";

function ProcessStep({
  step,
  title,
  children,
  isLast = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  step: number;
  title: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      data-slot="process-step"
      className={cn("relative flex flex-col gap-3", className)}
      {...props}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {String(step).padStart(2, "0")}
        </span>
        {!isLast && <span aria-hidden className="hidden h-px flex-1 bg-border sm:block" />}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

export { ProcessStep };
