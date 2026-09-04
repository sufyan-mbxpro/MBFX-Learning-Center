// changes-03-plan.md §4.1 — wraps Counter with the label row every "150+
// Countries" style stat needs. Server component; Counter itself is the
// only client boundary.
import { Counter } from "@repo/ui/components/counter";
import { cn } from "@repo/ui/lib/utils";

function StatCard({
  value,
  prefix,
  suffix,
  label,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}) {
  return (
    <div
      data-slot="stat-card"
      className={cn("flex flex-col items-center gap-1 text-center", className)}
      {...props}
    >
      <p className="text-display-sm font-semibold text-foreground">
        <Counter value={value} prefix={prefix} suffix={suffix} />
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export { StatCard };
