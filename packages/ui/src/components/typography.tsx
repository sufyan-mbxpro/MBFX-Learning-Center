import type * as React from "react";
import { useRender } from "@base-ui/react/use-render";
import { mergeProps } from "@base-ui/react/merge-props";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-072 (tokens.md §2.3) — the reference's type roles as
// components (task constraint 7), so a page never re-types
// "text-3xl font-bold tracking-tight" and no two pages can drift. Each role
// owns its tag default and its recipe; `render` swaps the element (an <h2>
// that must be an <h3> in context) without restyling it.
//
// Sizes come from the one type scale (ADR-072 §7). Nothing here takes a
// colour beyond the semantic muted/foreground inks.

type RoleProps<T extends keyof React.JSX.IntrinsicElements> = useRender.ComponentProps<T>;

function role<T extends keyof React.JSX.IntrinsicElements>(tag: T, slot: string, recipe: string) {
  function Role({ className, render, ...props }: RoleProps<T>) {
    return useRender({
      defaultTagName: tag,
      render,
      props: mergeProps<T>(
        { className: cn(recipe, className), "data-slot": slot } as never,
        props as never,
      ),
    });
  }
  Role.displayName = slot;
  return Role;
}

/** The page's h1: "Users Directory". 30px bold, tight tracking. */
const PageTitle = role("h1", "page-title", "text-3xl font-bold tracking-tight");

/** The compact page h1 with a leading 24px icon: "System Announcements". */
const PageTitleCompact = role(
  "h1",
  "page-title",
  "flex items-center gap-2 text-2xl font-bold tracking-tight [&_svg]:size-6 [&_svg]:shrink-0",
);

/** The line under the page title: 16px muted. */
const PageDescription = role("p", "page-description", "text-base text-muted-foreground");

/** A section/card heading: "Live Activity Feed". 24px semibold. */
const SectionTitle = role(
  "h2",
  "section-title",
  "text-2xl leading-none font-semibold tracking-tight",
);

/** The compact section heading with a 16px muted icon: "Deposit vs Withdrawal Trends". */
const SectionTitleCompact = role(
  "h3",
  "section-title",
  "flex items-center gap-2 text-base font-bold tracking-tight [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
);

/** Supporting line under a section title or card title: 14px muted. */
const SubText = role("p", "sub-text", "text-sm text-muted-foreground");

/** A metric's name: "Total Users". 14px medium muted, tight tracking. */
const StatLabel = role(
  "h3",
  "stat-label",
  "text-sm font-medium tracking-tight text-muted-foreground",
);

/** A metric's figure: "1,328". 24px bold, tabular digits. */
const StatValue = role("div", "stat-value", "text-2xl font-bold tabular-nums");

/** The unit after a StatValue: "lots". */
const StatUnit = role("span", "stat-unit", "ms-1 text-sm font-medium text-muted-foreground");

/** Secondary facts: "new · Last month". 12px muted. */
const MetaText = role("p", "meta-text", "text-xs text-muted-foreground");

/** The uppercase micro-header of a dense table or list: 10px semibold, wide tracking. */
const MicroHeading = role(
  "span",
  "micro-heading",
  "text-3xs font-semibold tracking-wider text-muted-foreground uppercase",
);

export {
  MetaText,
  MicroHeading,
  PageDescription,
  PageTitle,
  PageTitleCompact,
  SectionTitle,
  SectionTitleCompact,
  StatLabel,
  StatUnit,
  StatValue,
  SubText,
};
