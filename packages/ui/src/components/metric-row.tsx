// Public design system, changes-31 (ADR-101 §4).
//
// The hairline-divided metric group the reference puts in a card's footer —
// three or four facts about the thing on the card, each a glyph and a short
// line, separated by rules rather than by boxes. It is the smallest instance
// of the reference's whole structural idea: a group is made by a line, not by
// a container.
//
// Why a component and not three spans at each call site: the divider, the
// leading rule, the icon size and the truncation behaviour all have to match
// across course, quiz, video and tool cards, and four hand-written copies is
// how ADR-076's stat strip ended up in four mastheads.
//
// Server component — nothing here is interactive.
import { cn } from "@repo/ui/lib/utils";

export interface Metric {
  /** A lucide glyph, already sized by the row. Optional: a metric can be text alone. */
  icon?: React.ReactNode;
  /** The short line — "12 lessons", "40 min". Already localized by the caller. */
  label: React.ReactNode;
}

function MetricRow({
  items,
  className,
  ...props
}: Omit<React.ComponentProps<"ul">, "children"> & { items: Metric[] }) {
  // An empty group renders nothing rather than a bare rule — the same rule
  // ADR-047 §2 sets for owner-supplied data, applied to a layout primitive.
  if (items.length === 0) return null;

  return (
    <ul
      data-slot="metric-row"
      className={cn(
        // `divide-x` is a border BETWEEN columns and flips with the writing
        // mode on its own — no [dir] rule needed, unlike a translateX.
        // `border-t` is the rule that separates the group from the card body
        // above it; both read the one --border token.
        // Not responsive, deliberately: `grid-cols-N` is
        // `repeat(N, minmax(0, 1fr))`, so the row cannot outgrow its card at
        // any width (code-style #23's concern), and each cell truncates. A
        // breakpoint here would be the VIEWPORT's, which says nothing about
        // how wide this particular card is.
        "grid w-full divide-x divide-border border-t border-border pt-3 text-2xs text-muted-foreground",
        items.length >= 4 ? "grid-cols-4" : "grid-cols-3",
        className,
      )}
      {...props}
    >
      {items.map((item, index) => (
        <li
          // The list is a fixed, ordered set of facts about one card, rendered
          // in one pass and never reordered — position is a stable identity
          // here, and the labels are not guaranteed unique ("40 min" twice).
          key={index}
          className="flex min-w-0 items-center justify-center gap-1.5 px-2 first:ps-0 last:pe-0 [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-primary-interactive"
        >
          {item.icon}
          <span className="truncate">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export { MetricRow };
