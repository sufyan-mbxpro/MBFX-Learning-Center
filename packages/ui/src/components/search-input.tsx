import * as React from "react";
import { SearchIcon } from "lucide-react";

import { Input, type InputProps } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-072 — ONE search field (tokens.md §6.2). The reference
// hand-positions a magnifier over an input at every call site, with the
// offsets drifting between pages (left-2 / left-2.5 / left-3, pl-7 / pl-8 /
// pl-10); here each size carries its own matched glyph size, inset and
// padding, so they cannot drift. Logical insets (`start-*`, `ps-*`) mirror
// under RTL with no extra rule.
const LAYOUT = {
  default: { icon: "start-3 size-4", input: "ps-10" },
  sm: { icon: "start-2.5 size-4", input: "ps-8" },
  xs: { icon: "start-2 size-3.5", input: "ps-7" },
} as const;

interface SearchInputProps extends InputProps {
  /** Classes for the wrapper — the element a toolbar sizes (`flex-1 min-w-60`, `w-50`). */
  wrapperClassName?: string;
}

function SearchInput({ size, className, wrapperClassName, type, ...props }: SearchInputProps) {
  const layout = LAYOUT[size ?? "default"];
  return (
    <div data-slot="search-input" className={cn("relative w-full min-w-0", wrapperClassName)}>
      {/* Decorative: the field's accessible name comes from the caller's
          aria-label or <label>, never from the icon. */}
      <SearchIcon
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          layout.icon,
        )}
      />
      <Input
        type={type ?? "search"}
        size={size}
        className={cn(layout.input, className)}
        {...props}
      />
    </div>
  );
}

export { SearchInput };
export type { SearchInputProps };
