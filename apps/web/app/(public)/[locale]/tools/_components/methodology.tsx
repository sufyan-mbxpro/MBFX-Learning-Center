"use client";

// The methodology panel (ADR-088 #7).
//
// **A number a reader cannot interrogate is worse than no number.** Both
// correlation and the risk meter print a figure that is the output of a
// choice — which statistic, over which window, of which series — and the
// reference discloses neither. This is where ours is stated, on the page that
// prints it, in the reader's words.
//
// Collapsed by default because it is reference rather than reading, and a
// `<details>` rather than a component with state because it works before
// hydration and needs no JavaScript to open.
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

export function Methodology({ points }: { points: string[] }) {
  const t = useTranslations("tools");
  return (
    <details className="group rounded-lg border border-border bg-muted/30 p-4">
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
        {t("methodology.title")}
        <ChevronDown
          aria-hidden
          className="size-4 transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
        {points.map((point) => (
          <li key={point} className="leading-relaxed">
            {point}
          </li>
        ))}
      </ul>
    </details>
  );
}
