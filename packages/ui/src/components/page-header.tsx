import * as React from "react";

import { cn } from "@repo/ui/lib/utils";
import { PageDescription, PageTitle, PageTitleCompact } from "@repo/ui/components/typography";

// changes-20 / ADR-072 (tokens.md §6.12) — the reference's page header:
// title + description at the start, actions at the end, wrapping under the
// title on a narrow screen. ADR-044 #8's rule (every screen has a title AND
// a one-line description, Save at the inline end) is what this renders by
// construction: `description` is required.

function PageHeader({
  title,
  description,
  icon,
  status,
  actions,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  /** One line on what the screen is for — required (ADR-044 #8). */
  description: React.ReactNode;
  /** A leading 24px icon; switches to the reference's compact title. */
  icon?: React.ReactNode;
  /** An inline status beside the description (a `Badge size="sm" live`). */
  status?: React.ReactNode;
  /** Page actions — primary `Button` first, then outline icon buttons. */
  actions?: React.ReactNode;
}) {
  return (
    <div
      data-slot="page-header"
      className={cn("flex flex-wrap items-start justify-between gap-3", className)}
      {...props}
    >
      <div className="min-w-0">
        {icon ? (
          <PageTitleCompact>
            {icon}
            {title}
          </PageTitleCompact>
        ) : (
          <PageTitle>{title}</PageTitle>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <PageDescription className={icon ? "text-sm" : undefined}>{description}</PageDescription>
          {status}
        </div>
      </div>
      {actions && (
        <div data-slot="page-header-actions" className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

export { PageHeader };
