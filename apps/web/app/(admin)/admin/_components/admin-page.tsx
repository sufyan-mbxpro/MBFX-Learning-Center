// The two layout primitives every admin screen composes. Extracted so the
// page-header rhythm and card treatment stay consistent across screens —
// and change in ONE place when the design evolves — instead of living as
// eight slightly-diverging copies of the same class strings.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";

export function AdminPage({
  title,
  description,
  meta,
  actions,
  backHref,
  backLabel,
  width = "md",
  children,
}: {
  title: string;
  /** Muted one-liner under the title (replaces the per-page -mt-4 hacks). */
  description?: string;
  /** Inline after the title — status badges and the like. */
  meta?: React.ReactNode;
  /** End-aligned action cluster — "New X" buttons and the like. */
  actions?: React.ReactNode;
  /** Renders the standard back link above the title. */
  backHref?: string;
  backLabel?: string;
  width?: "sm" | "md" | "lg" | "full";
  children: React.ReactNode;
}) {
  const widths = { sm: "max-w-2xl", md: "max-w-3xl", lg: "max-w-5xl", full: "" } as const;
  return (
    <div className={cn("flex flex-col gap-6", widths[width])}>
      <div className="flex flex-col gap-1.5">
        {backHref && backLabel && (
          <div>
            <Button variant="ghost" size="sm" className="-ms-2" render={<Link href={backHref} />}>
              <ArrowLeft data-icon="inline-start" aria-hidden className="rtl:rotate-180" />
              {backLabel}
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {meta}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function AdminSection({
  title,
  className,
  children,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("card-hover flex flex-col gap-4 rounded-lg border bg-card p-5", className)}>
      {title && <h2 className="text-lg font-semibold capitalize">{title}</h2>}
      {children}
    </section>
  );
}
