// "External · YouTube" — the marker on any surface whose content lives on
// someone else's site (changes-11 D15/D16, §9.2).
//
// It exists as a component rather than a `<Badge>` per call site because the
// affordance has an accessibility contract attached: an external link must
// announce that it opens in a new tab. `newTabLabel` is rendered
// screen-reader-only beside the arrow, so the announcement travels with the
// badge instead of being remembered at each of the four places this appears.
//
// Both strings are required props — a public component carries no catalog
// (code-style.md #2), and an English default here would be a hardcoded
// user-facing string.
import { ExternalLink } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

export function ExternalBadge({
  label,
  newTabLabel,
  className,
}: {
  /** "External", or "External · YouTube" where the provider is known. */
  label: string;
  /** e.g. "opens in a new tab" — announced, never shown. */
  newTabLabel: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <ExternalLink aria-hidden className="size-3" />
      {label}
      <span className="sr-only"> — {newTabLabel}</span>
    </Badge>
  );
}
