// The two layout primitives every admin screen composes. Extracted so the
// page-header rhythm and card treatment stay consistent across screens —
// and change in ONE place when the design evolves — instead of living as
// eight slightly-diverging copies of the same class strings.
//
// changes-20 Phase 5: both are now thin adapters over `@repo/ui` — the
// heading is `PageHeader` (the reference's 30px title + 16px description),
// the section is `Card`. What stays here is only what needs the app: the
// back link (`next/link`) and the full-width page stack (ADR-040).
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { PageHeader } from "@repo/ui/components/page-header";
import { SectionTitle } from "@repo/ui/components/typography";

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
  as = "h1",
}: {
  title: string;
  /**
   * Required on every live screen (ADR-044 #8, guarded by
   * `admin-page-conventions.test.ts`); optional in the type only for the
   * paused and cancelled surfaces (ADR-038/042), which are not brought up
   * to conventions.
   */
  description?: string;
  /** Status chips — rendered beside the description, as the reference does. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  /** The heading level. Only ever one `h1` per screen. */
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex flex-col gap-2">
      {backHref && backLabel && (
        <div>
          <Button variant="ghost" size="sm" className="-ms-3" render={<Link href={backHref} />}>
            <ArrowLeft data-icon="inline-start" aria-hidden className="rtl:rotate-180" />
            {backLabel}
          </Button>
        </div>
      )}
      <PageHeader
        title={title}
        description={description}
        status={meta}
        actions={actions}
        titleRender={as === "h2" ? <h2 /> : undefined}
      />
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
  /** Muted one-liner under the title — see AdminPageHeading. */
  description?: string;
  /** Status chips beside the description. */
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

/**
 * A titled block of a screen: the reference's card (ADR-075) — Card's own
 * 24px rhythm pads it, so nothing here pads by hand. `className` lands on
 * the content, which is where every call site's layout (`gap-3`,
 * `items-center`, `flex-row`) belongs; `cardClassName` sizes the card
 * itself in a row (`lg:w-72`, `flex-1`).
 */
export function AdminSection({
  title,
  className,
  cardClassName,
  children,
}: {
  title?: string;
  className?: string;
  cardClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cardClassName}>
      {title && (
        // SectionTitle is CardTitle's recipe as an <h2>: a screen's
        // sections are headings in its outline, which CardTitle's <div>
        // is not.
        <CardHeader>
          <SectionTitle>{title}</SectionTitle>
        </CardHeader>
      )}
      <CardContent className={cn("flex flex-col gap-4", className)}>{children}</CardContent>
    </Card>
  );
}
