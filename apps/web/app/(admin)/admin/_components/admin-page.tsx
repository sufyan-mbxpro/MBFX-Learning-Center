// The two layout primitives every admin screen composes. Extracted so the
// page-header rhythm and card treatment stay consistent across screens —
// and change in ONE place when the design evolves — instead of living as
// eight slightly-diverging copies of the same class strings.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";

/**
 * The title / description / actions block, on its own so the settings
 * screens can render it INSIDE their content column rather than above the
 * whole page (changes-08 #4: the heading belongs over the cards it
 * describes, not over the settings sub-nav beside them).
 */
export function AdminPageHeading({
  title,
  description,
  meta,
  actions,
  backHref,
  backLabel,
  as: Tag = "h1",
}: {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  /** The heading level. Only ever one `h1` per screen. */
  as?: "h1" | "h2";
}) {
  return (
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
          <Tag className="text-2xl font-semibold tracking-tight">{title}</Tag>
          {meta}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function AdminPage({
  title,
  description,
  meta,
  actions,
  backHref,
  backLabel,
  className,
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
  className?: string;
  children: React.ReactNode;
}) {
  // ADR-040: every admin screen is full-width. The old `width` prop
  // ("sm"|"md"|"lg"|"full" → max-w-2xl/3xl/5xl) is REMOVED rather than
  // defaulted, so a leftover call site is a type error instead of a
  // silently-ignored request for a cap the design no longer honours.
  return (
    <div className={cn("flex w-full flex-col gap-6", className)}>
      <AdminPageHeading
        title={title}
        description={description}
        meta={meta}
        actions={actions}
        backHref={backHref}
        backLabel={backLabel}
      />
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
    <section
      className={cn("card-hover flex flex-col gap-4 rounded-lg border bg-card p-5", className)}
    >
      {title && <h2 className="text-lg font-semibold capitalize">{title}</h2>}
      {children}
    </section>
  );
}
