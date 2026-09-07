// changes-03-plan.md §4.1 — the reference's "Trading Accounts" / feature
// tile: icon, title, body, optional link. `render` (Base UI's polymorphism,
// same idiom as Badge) makes the WHOLE card a link when the caller passes
// one; omitted, it's a static div.
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { LucideIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

function IconCard({
  icon: Icon,
  title,
  children,
  className,
  render,
  interactive,
  ...props
}: Omit<useRender.ComponentProps<"div">, "children"> & {
  icon: LucideIcon;
  title: React.ReactNode;
  children?: React.ReactNode;
  /**
   * Adds the hover lift (ADR-051 §6). Defaults to "yes when `render` made
   * this a link" — a card that rises under the pointer but does nothing when
   * clicked promises an interaction it does not have, so the affordance
   * follows the behaviour rather than being a styling choice per call site.
   */
  interactive?: boolean;
}) {
  const lifts = interactive ?? render !== undefined;
  const merged = mergeProps<"div">(
    {
      className: cn(
        "card-hover group/icon-card flex flex-col gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10",
        lifts && "hover-lift hover:ring-primary/25",
        className,
      ),
    },
    props,
  );

  return useRender({
    defaultTagName: "div",
    props: {
      ...merged,
      // The icon box: tinted fill + --primary-interactive glyph, not raw
      // --primary — ADR-018 rule 5 (a 20px icon is a "small" element).
      // bg-primary/10, not --primary-subtle: see badge.tsx's eyebrow
      // variant for why the fixed near-white tint breaks in dark mode.
      children: (
        <>
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive transition-colors duration-(--duration-base)",
              // On hover the tint becomes a FILL and the glyph takes the
              // derived --primary-foreground — the one pairing ADR-003
              // guarantees legible, so inverting the mark carries no
              // contrast risk.
              lifts &&
                "group-hover/icon-card:bg-primary group-hover/icon-card:text-primary-foreground",
            )}
          >
            <Icon aria-hidden className="size-5" />
          </span>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {children && <p className="text-sm text-muted-foreground">{children}</p>}
        </>
      ),
    },
    render,
    state: { slot: "icon-card" },
  });
}

export { IconCard };
