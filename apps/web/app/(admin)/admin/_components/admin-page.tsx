// The two layout primitives every admin screen composes. Extracted so the
// page-header rhythm and card treatment stay consistent across screens —
// and change in ONE place when the design evolves — instead of living as
// eight slightly-diverging copies of the same class strings.
//
// changes-20 Phase 5: both are now thin adapters over `@repo/ui` — the
// heading is `PageHeader` (the reference's 30px title + 16px description),
// the section is `Card`. What stays here is only what needs the app: the
// back link (`next/link`) and the full-width page stack (ADR-040).
import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { PageHeader } from "@repo/ui/components/page-header";
import { SectionTitle } from "@repo/ui/components/typography";
import { HeaderActionsProvider, HeaderActionsSlot } from "./header-actions.tsx";

// With a slot and nothing portaled into it yet (or ever), PageHeader still
// draws its actions wrapper, which wraps to a second line under a long
// description and adds a row gap of nothing. Hide the wrapper while the slot
// is its only, empty, child.
const HIDE_EMPTY_SLOT =
  "[&>[data-slot=page-header-actions]:has(>[data-slot=header-actions]:only-child:empty)]:hidden";

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
  actionsSlot = false,
  sticky = false,
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
  /**
   * Render a `HeaderActionsSlot` after `actions`, so a client component below
   * (a table's dialog manager, an editor's Save cluster) can portal its
   * buttons into this row (ADR-140 §3). Needs a `HeaderActionsProvider`
   * above; `AdminPage` supplies both.
   */
  actionsSlot?: boolean;
  /** Pin the title row under the shell's header — editors, whose Save must
   * stay reachable down a long form. The back link above it scrolls away. */
  sticky?: boolean;
  /** The heading level. Only ever one `h1` per screen. */
  as?: "h1" | "h2";
}) {
  // A sticky element sticks only within its PARENT, so a pinned title row
  // cannot sit inside this wrapper (it would scroll away with it). Sticky
  // drops the wrapper and lets the row stick within the page's own column;
  // `-mb-4` puts the back link back at this wrapper's 8px from it.
  const Wrapper = sticky ? Fragment : "div";
  return (
    <Wrapper {...(sticky ? {} : { className: "flex flex-col gap-2" })}>
      {backHref && backLabel && (
        <div className={sticky ? "-mb-4" : undefined}>
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
        actions={
          actionsSlot ? (
            <>
              {actions}
              <HeaderActionsSlot />
            </>
          ) : (
            actions
          )
        }
        className={cn(
          actionsSlot && HIDE_EMPTY_SLOT,
          sticky &&
            "sticky top-(--height-header) z-20 -mx-1 border-b bg-background/95 px-1 py-3 backdrop-blur",
        )}
        titleRender={as === "h2" ? <h2 /> : undefined}
      />
    </Wrapper>
  );
}

export function AdminPage({
  title,
  description,
  meta,
  actions,
  backHref,
  backLabel,
  sticky,
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
  /** Pin the title row — see AdminPageHeading. `EditorPage` sets it. */
  sticky?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  // ADR-040: every admin screen is full-width. The old `width` prop
  // ("sm"|"md"|"lg"|"full" → max-w-2xl/3xl/5xl) is REMOVED rather than
  // defaulted, so a leftover call site is a type error instead of a
  // silently-ignored request for a cap the design no longer honours.
  //
  // ADR-140 §3: every AdminPage owns a header-actions slot, so any client
  // component on the screen can put its button on the title row with
  // `<HeaderActions>` — the page does not have to know which one will.
  return (
    <HeaderActionsProvider>
      <div className={cn("flex w-full flex-col gap-6", className)}>
        <AdminPageHeading
          title={title}
          description={description}
          meta={meta}
          actions={actions}
          backHref={backHref}
          backLabel={backLabel}
          sticky={sticky}
          actionsSlot
        />
        {children}
      </div>
    </HeaderActionsProvider>
  );
}

/**
 * ADR-140 §3 — the one editor frame. The heading is STATIC ("Edit course",
 * "New provider"), never the record's title: the title is already the first
 * field on the page, and repeating it at page-title size pushed the editor's
 * actions onto a second row. The editor's Save / Preview / View-live cluster
 * portals into this row with `<HeaderActions>`, and the row is pinned under
 * the shell's header so Save stays reachable. The back link stays above.
 */
export function EditorPage(props: Omit<React.ComponentProps<typeof AdminPage>, "sticky">) {
  return <AdminPage {...props} sticky />;
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
