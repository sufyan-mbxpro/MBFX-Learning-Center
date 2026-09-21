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
  icon,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  /**
   * changes-31 (ADR-101): the glyph the reference puts above each figure.
   * Optional — About's facts band has never had one and does not gain one.
   */
  icon?: React.ReactNode;
}) {
  return (
    <div
      data-slot="stat-card"
      className={cn("flex flex-col items-center gap-1 text-center", className)}
      {...props}
    >
      {icon && (
        <span
          aria-hidden
          className="mb-1 flex text-primary-interactive [&>svg]:size-5 [&>svg]:shrink-0"
        >
          {icon}
        </span>
      )}
      {/* ADR-102: a figure is a statement, so it is set in the display face.
          `font-normal` for the same reason SectionHeading is — see there. */}
      <p className="font-display text-display-sm font-bold text-foreground">
        <Counter value={value} prefix={prefix} suffix={suffix} />
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export { StatCard };
