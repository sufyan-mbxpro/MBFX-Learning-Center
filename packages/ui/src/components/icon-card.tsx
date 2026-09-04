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
  ...props
}: Omit<useRender.ComponentProps<"div">, "children"> & {
  icon: LucideIcon;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  const merged = mergeProps<"div">(
    {
      className: cn(
        "card-hover group/icon-card flex flex-col gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10",
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
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive">
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
