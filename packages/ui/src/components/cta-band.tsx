// changes-03-plan.md §4.1 — the reference's bold "Subscribe for latest
// update" band. `bg-primary` here is a large background FILL, exactly the
// case ADR-018 rule 5 allows (not thin, not text). Actions (typically a
// Button) are composed in via `children`, not a bespoke `cta` prop — same
// slot-composition idiom as Card's CardFooter.
import { cn } from "@repo/ui/lib/utils";

const CTA_VARIANT_CLASS = {
  default: "container-page rounded-2xl",
  "full-width": "w-full",
} as const;

function CtaBand({
  title,
  description,
  children,
  variant = "default",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  variant?: keyof typeof CTA_VARIANT_CLASS;
}) {
  return (
    <div
      data-slot="cta-band"
      data-variant={variant}
      className={cn(
        "flex flex-col items-center gap-4 bg-primary px-6 py-10 text-center text-primary-foreground sm:flex-row sm:justify-between sm:text-start",
        CTA_VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <p className="text-xl font-semibold text-balance">{title}</p>
        {description && (
          <p className="text-sm text-pretty text-primary-foreground/80">{description}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center gap-3">{children}</div>}
    </div>
  );
}

export { CtaBand };
