"use client";

// The shelves' top-level VIEW row (ADR-139 #5): All · Featured · Popular ·
// Newest, as the owner's reference heads its list with "Popular / Editors'
// picks". One component so the course, quiz and video shelves offer the same
// words, glyphs and order.
//
// Toggle buttons in a labelled group, like the shelves' other chips: nothing
// here changes the URL (D26), so `aria-pressed`, not `aria-current`.
import { Clock, Flame, LayoutGrid, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@repo/ui/lib/utils";
import type { ShelfView } from "../_lib/shelf-view.ts";

const ICONS: Record<ShelfView, typeof Clock> = {
  all: LayoutGrid,
  featured: Sparkles,
  popular: Flame,
  newest: Clock,
};

export function ShelfViewChips({
  views,
  value,
  onChange,
  className,
}: {
  /** From `availableShelfViews` — only what this shelf can honestly offer. */
  views: readonly ShelfView[];
  value: ShelfView;
  onChange: (view: ShelfView) => void;
  className?: string;
}) {
  const t = useTranslations("learn.views");
  // One view is not a choice.
  if (views.length <= 1) return null;

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {views.map((view) => {
        const Icon = ICONS[view];
        const active = view === value;
        return (
          <button
            key={view}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(view)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold ring-1 transition duration-(--duration-base) ease-(--ease-out-quint) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "bg-secondary text-secondary-foreground shadow-sm ring-secondary"
                : "bg-muted text-foreground ring-transparent hover:-translate-y-px hover:shadow-sm hover:ring-border",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {t(view)}
          </button>
        );
      })}
    </div>
  );
}
