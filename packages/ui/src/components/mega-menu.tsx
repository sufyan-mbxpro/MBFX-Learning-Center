"use client";

// The mega-menu primitives (ADR-048, changes-09-plan.md §2/PR 3), modelled
// on the two reference panels the owner supplied: a left rail of gradient
// feature tiles, grouped columns of icon + title + description rows, an
// optional full-width promo strip, and a footer row with a "view all" pill.
//
// Built on Base UI's NavigationMenu (ADR-013), not hand-rolled. That buys
// the two things hand-rolled mega menus reliably get wrong — pointer
// diagonal tolerance when moving from trigger to panel, and correct
// focus/Escape/roving-tab behaviour — plus RTL through
// `direction-provider`, and the sliding viewport transition for free.
//
// Every part here is presentation only. WHICH links a panel contains is
// decided by the app's own registry (ADR-048: panels are code, hrefs come
// from the database menu), never by this file.
import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

function MegaMenu({ className, ...props }: NavigationMenu.Root.Props) {
  return <NavigationMenu.Root className={cn("min-w-max", className)} {...props} />;
}

function MegaMenuList({ className, ...props }: NavigationMenu.List.Props) {
  return (
    <NavigationMenu.List className={cn("relative flex items-center gap-1", className)} {...props} />
  );
}

const MegaMenuItem = NavigationMenu.Item;

function MegaMenuTrigger({ className, children, ...props }: NavigationMenu.Trigger.Props) {
  return (
    <NavigationMenu.Trigger
      className={cn(
        "flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors duration-(--duration-base) select-none hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none data-popup-open:bg-muted data-popup-open:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <NavigationMenu.Icon className="transition-transform duration-(--duration-base) ease-(--ease-out-quint) data-popup-open:rotate-180">
        <ChevronDown aria-hidden className="size-3.5" />
      </NavigationMenu.Icon>
    </NavigationMenu.Trigger>
  );
}

const MegaMenuContent = NavigationMenu.Content;

/**
 * Portal + Positioner + Popup + Viewport in one piece — four parts that
 * always appear together and whose only per-site variation is the offset.
 * Rendered once per menu, beside the list.
 */
function MegaMenuViewport({ sideOffset = 10 }: { sideOffset?: number }) {
  return (
    <NavigationMenu.Portal>
      <NavigationMenu.Positioner
        sideOffset={sideOffset}
        collisionPadding={{ top: 5, bottom: 5, left: 16, right: 16 }}
        collisionAvoidance={{ side: "none" }}
        // The ::before strip bridges the gap between trigger and popup so
        // the pointer can cross it without the menu closing underneath it.
        className="z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-(--duration-slow) ease-(--ease-out-quint) before:absolute before:inset-x-0 before:top-[-10px] before:h-2.5 before:content-[''] data-instant:transition-none"
      >
        <NavigationMenu.Popup className="relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 transition-[opacity,transform,width,height] duration-(--duration-slow) ease-(--ease-out-quint) data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <NavigationMenu.Viewport className="relative h-full w-full" />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  );
}

/** The panel body: an optional feature rail beside one or more columns. */
function MegaMenuPanel({
  features,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  /** The left rail of gradient tiles. Omitted, the columns take the full width. */
  features?: React.ReactNode;
}) {
  return (
    <div
      data-slot="mega-menu-panel"
      // An EXPLICIT width, not `w-max`. Base UI measures the popup from its
      // content, and a `1fr` grid inside a max-content box resolves each
      // column to min-content — which rendered the first build of this panel
      // one word per line. Fixed width, then the columns divide it.
      className={cn("flex w-[min(56rem,calc(100vw-2rem))] flex-col", className)}
      {...props}
    >
      {/* The rail column is added only when there IS a rail: applied
          unconditionally, the columns land in the 14rem track and every row
          wraps a word per line. */}
      <div
        className={cn("grid gap-8 p-6 lg:gap-10", features && "lg:grid-cols-[minmax(0,14rem)_1fr]")}
      >
        {features && <div className="flex flex-col gap-3">{features}</div>}
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      </div>
    </div>
  );
}

/** A gradient tile in the left rail — the reference's "Why FOREX.com?" blocks. */
function MegaMenuFeature({
  icon: Icon,
  title,
  description,
  className,
  ...props
}: NavigationMenu.Link.Props & {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <NavigationMenu.Link
      className={cn(
        // A large gradient FILL is the case ADR-018 rule 5 allows for
        // --primary; the label rides on its derived foreground.
        "sheen hover-lift group/feature flex items-start gap-3 rounded-xl bg-gradient-to-br from-primary to-primary-active p-4 text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        {description && <span className="text-xs opacity-80">{description}</span>}
      </span>
    </NavigationMenu.Link>
  );
}

/** One titled column of links. */
function MegaMenuColumn({
  title,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & { title?: React.ReactNode }) {
  return (
    <div data-slot="mega-menu-column" className={cn("flex flex-col gap-1", className)} {...props}>
      {title && (
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
      )}
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  );
}

/** One row: icon, bold label, one-line description — the mbx.co treatment. */
function MegaMenuLink({
  icon: Icon,
  title,
  description,
  className,
  ...props
}: NavigationMenu.Link.Props & {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <li>
      <NavigationMenu.Link
        className={cn(
          // The hover state is deliberately unmissable (ADR-051 §6). Four
          // things move together — surface, ring, icon fill, chevron — because
          // a panel row is a large target with a lot of empty space in it, and
          // a background tint alone reads as "something happened somewhere"
          // rather than "THIS row is under your pointer".
          //
          // `group/link` drives the children; `focus-visible` mirrors every
          // hover rule so the keyboard path is the same experience, not a
          // ring bolted onto an otherwise inert row.
          "group/link relative flex items-start gap-3 rounded-xl p-2.5 ring-1 ring-transparent transition-[background-color,box-shadow,transform] duration-(--duration-base) ease-(--ease-out-quint)",
          "hover:bg-muted hover:ring-primary/25 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          className,
        )}
        {...props}
      >
        {Icon && (
          // Tinted box + --primary-interactive glyph at rest — never raw
          // --primary on a 16px mark (ADR-018 rule 5). On hover the box
          // becomes a FILL and the glyph switches to the derived
          // --primary-foreground, which is the one pairing ADR-003
          // guarantees legible, so the mark inverts without a contrast risk.
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive transition-colors duration-(--duration-base) group-hover/link:bg-primary group-hover/link:text-primary-foreground group-focus-visible/link:bg-primary group-focus-visible/link:text-primary-foreground">
            <Icon aria-hidden className="size-4" />
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1 text-sm font-semibold text-foreground transition-colors duration-(--duration-base) group-hover/link:text-primary-interactive group-focus-visible/link:text-primary-interactive">
            {title}
            {/* Appears only on hover: an arrow on every row at rest is five
                arrows saying nothing. rtl:rotate-180 is the repo's existing
                idiom for a directional chevron. */}
            <ChevronRight
              aria-hidden
              className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-(--duration-base) ease-(--ease-out-quint) group-hover/link:translate-x-0 group-hover/link:opacity-100 group-focus-visible/link:translate-x-0 group-focus-visible/link:opacity-100 rtl:rotate-180 rtl:translate-x-1 rtl:group-hover/link:translate-x-0 rtl:group-focus-visible/link:translate-x-0"
            />
          </span>
          {description && (
            <span className="text-xs text-pretty text-muted-foreground">{description}</span>
          )}
        </span>
      </NavigationMenu.Link>
    </li>
  );
}

/** The full-width promo strip under the columns (payments, offers, hours). */
function MegaMenuStrip({
  title,
  description,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <div
      data-slot="mega-menu-strip"
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 border-t border-border/70 bg-muted/50 px-6 py-4",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

/** The footer row: section name at the start, a "view all" pill at the end. */
function MegaMenuFooter({
  label,
  actionLabel,
  className,
  ...props
}: NavigationMenu.Link.Props & {
  label: React.ReactNode;
  actionLabel: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border/70 px-6 py-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <NavigationMenu.Link
        className={cn(
          "group glow-on-hover inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          className,
        )}
        {...props}
      >
        {actionLabel}
        {/* rtl:rotate-180 is the repo's existing idiom for a directional
            chevron (see the header's ArrowRight); .hover-arrow supplies the
            nudge and flips its own translate under [dir="rtl"]. */}
        <ChevronRight aria-hidden className="hover-arrow size-3.5 rtl:rotate-180" />
      </NavigationMenu.Link>
    </div>
  );
}

export {
  MegaMenu,
  MegaMenuColumn,
  MegaMenuContent,
  MegaMenuFeature,
  MegaMenuFooter,
  MegaMenuItem,
  MegaMenuLink,
  MegaMenuList,
  MegaMenuPanel,
  MegaMenuStrip,
  MegaMenuTrigger,
  MegaMenuViewport,
};
