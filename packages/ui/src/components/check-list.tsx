// The reference's tick `bulleted-list` (changes-09-plan.md §2) — the shape
// every "what we do / what we never do" block on the About pages uses.
//
// An empty list renders NOTHING, not an empty <ul>: ADR-047 §2's rule, held
// at the primitive so no caller has to remember it.
import { Check } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

const COLUMNS_CLASS = {
  1: "",
  2: "sm:grid sm:grid-cols-2 sm:gap-x-8",
} as const;

function CheckList({
  items,
  columns = 1,
  className,
  ...props
}: Omit<React.ComponentProps<"ul">, "children"> & {
  items: readonly React.ReactNode[];
  columns?: keyof typeof COLUMNS_CLASS;
}) {
  if (items.length === 0) return null;

  return (
    <ul
      data-slot="check-list"
      className={cn("flex flex-col gap-3", COLUMNS_CLASS[columns], className)}
      {...props}
    >
      {items.map((item, index) => (
        // Index keys: the caller owns the order and these rows are static
        // copy, never reordered or filtered in place.
        <li key={index} className="flex items-start gap-3">
          {/* Tinted box + --primary-interactive glyph — a 14px icon is
              exactly the "small element" ADR-018 rule 5 keeps off --primary. */}
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-interactive">
            <Check aria-hidden className="size-3.5" />
          </span>
          <span className="text-pretty">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export { CheckList };
