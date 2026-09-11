import * as React from "react";
import { cloneElement } from "react";

import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  MoreHorizontalIcon,
} from "lucide-react";

// changes-20 / ADR-072 (tokens.md §6.10) — the reference's pager: outlined
// 36px Previous/Next (and First/Last) buttons around ghost page numbers with
// the current page outlined. The reference mixes 36px buttons with 40px page
// numbers in one row; the owner's Q11 decision unifies everything on 36px.
// Every visible string and accessible name arrives from the caller's catalog
// (code-style #2) — the English defaults remain only for the existing public
// call site, which passes its own.

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
  /**
   * The element to render as (added to the registry component). The stock
   * version hardcodes a plain <a>, which in this app would drop next-intl's
   * locale prefix and force a full page load — so the router element is the
   * caller's to supply, exactly like Button's own `render`. Defaults to a
   * plain <a> when omitted, so the stock usage still works.
   */
  render?: React.ReactElement<Record<string, unknown>>;
  /** Forces the outlined treatment (Previous/Next/First/Last always carry it). */
  outlined?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">;

function PaginationLink({
  className,
  isActive,
  outlined = false,
  size = "icon-sm",
  render,
  ...props
}: PaginationLinkProps) {
  // Children live on PaginationLink (the page number), not on the router
  // element, so they are part of what gets cloned onto it.
  const anchorProps = {
    "aria-current": isActive ? ("page" as const) : undefined,
    "data-slot": "pagination-link",
    "data-active": isActive,
    ...props,
  };
  return (
    <Button
      variant={isActive || outlined ? "outline" : "ghost"}
      size={size}
      className={cn("tabular-nums", className)}
      nativeButton={false}
      render={render ? cloneElement(render, anchorProps) : <a {...anchorProps} />}
    />
  );
}

function PaginationPrevious({
  className,
  text = "Previous",
  "aria-label": ariaLabel = "Go to previous page",
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  return (
    <PaginationLink aria-label={ariaLabel} size="sm" outlined className={className} {...props}>
      <ChevronLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
      <span className="hidden sm:inline">{text}</span>
    </PaginationLink>
  );
}

function PaginationNext({
  className,
  text = "Next",
  "aria-label": ariaLabel = "Go to next page",
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  return (
    <PaginationLink aria-label={ariaLabel} size="sm" outlined className={className} {...props}>
      <span className="hidden sm:inline">{text}</span>
      <ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
    </PaginationLink>
  );
}

/** Jump to the first page. Icon-only, so its accessible name is required. */
function PaginationFirst({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { "aria-label": string }) {
  return (
    <PaginationLink
      size="sm"
      outlined
      className={cn("hidden sm:inline-flex", className)}
      {...props}
    >
      <ChevronsLeftIcon className="rtl:rotate-180" />
    </PaginationLink>
  );
}

/** Jump to the last page. Icon-only, so its accessible name is required. */
function PaginationLast({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { "aria-label": string }) {
  return (
    <PaginationLink
      size="sm"
      outlined
      className={cn("hidden sm:inline-flex", className)}
      {...props}
    >
      <ChevronsRightIcon className="rtl:rotate-180" />
    </PaginationLink>
  );
}

function PaginationEllipsis({
  className,
  label = "More pages",
  ...props
}: React.ComponentProps<"span"> & { label?: string }) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-9 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * The reference's pager footer: "Showing 1 to 15 of 9,986 results" at the
 * start, the controls at the end, `px-4 py-3 border-t` under a table. The
 * text is the caller's (a catalog string); this owns only the placement.
 */
function PaginationBar({
  className,
  summary,
  children,
  ...props
}: React.ComponentProps<"div"> & { summary?: React.ReactNode }) {
  return (
    <div
      data-slot="pagination-bar"
      className={cn(
        "flex flex-col items-center gap-4 border-t px-4 py-3 sm:flex-row sm:justify-between",
        className,
      )}
      {...props}
    >
      {summary !== undefined && (
        <div className="text-sm text-muted-foreground" data-slot="pagination-summary">
          {summary}
        </div>
      )}
      {children}
    </div>
  );
}

export {
  Pagination,
  PaginationBar,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
