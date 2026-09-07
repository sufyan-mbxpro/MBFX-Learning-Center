// The reference's centre-spine `timeline` with its Show / Close toggle
// (changes-09-plan.md §2), built as a SERVER component on <details>.
//
// Why <details> and not a client component with state: ADR-018 rule 2 says
// animated/collapsible content must be present and reachable when JS never
// runs. A useState toggle can only satisfy that by rendering everything
// expanded on the server and collapsing after mount — a visible jump on
// every page load. <details> collapses natively, keeps every entry in the
// DOM for crawlers, brings its own keyboard and screen-reader behaviour,
// and adds no client island at all.
//
// The spine is a flex column of dot + connector, never an absolutely
// positioned pseudo-element: absolute positioning here would need a
// translate on the inline axis, which does not mirror in RTL.
import { cn } from "@repo/ui/lib/utils";

export interface TimelineItem {
  id: string;
  /** Rendered as-is — a year, a quarter, a date; the caller formats it. */
  marker: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
}

function TimelineRow({
  item,
  index,
  isLast,
}: {
  item: TimelineItem;
  /** Position within its own list, used only to stagger the entrance. */
  index: number;
  isLast: boolean;
}) {
  return (
    // The reveal classes go on the <li> itself rather than a <Reveal> wrapper:
    // a <div> between <ol> and <li> is invalid HTML, and `display: contents`
    // — the usual escape — cannot be transformed, so the animation would
    // silently do nothing. The classes are the same ones Reveal applies.
    //
    // `group` + hover on the whole ROW, not on the dot: a 12px target is not
    // something anyone aims at, and the thing being emphasised is the entry.
    <li
      className="reveal reveal-up group/entry flex gap-4"
      // Capped at the fifth row: past it the delay stops growing, or the last
      // entry of a long timeline waits most of a second after the first for
      // no reason a reader can perceive.
      style={{
        animationDelay: `${Math.min(index, 5) * 70}ms`,
        transitionDelay: `${Math.min(index, 5) * 70}ms`,
      }}
    >
      <div className="flex flex-col items-center pt-1.5">
        <span
          aria-hidden
          className="relative size-3 shrink-0 rounded-full bg-primary transition-transform duration-(--duration-base) ease-(--ease-out-quint) group-hover/entry:scale-150"
        >
          {/* A halo that only exists on hover — nine permanent halos down a
              spine is a decorated list, not a timeline. */}
          <span className="absolute -inset-1.5 rounded-full bg-primary/20 opacity-0 transition-opacity duration-(--duration-base) group-hover/entry:opacity-100" />
        </span>
        {!isLast && <span aria-hidden className="w-px flex-1 bg-border" />}
      </div>
      <div className={cn("flex flex-col gap-1", !isLast && "pb-8")}>
        <p className="text-sm font-semibold text-primary-interactive">{item.marker}</p>
        <h3 className="font-semibold text-foreground">{item.title}</h3>
        {item.body && <p className="text-sm text-pretty text-muted-foreground">{item.body}</p>}
      </div>
    </li>
  );
}

function Timeline({
  items,
  collapsedCount = 6,
  expandLabel,
  collapseLabel,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  items: readonly TimelineItem[];
  /** How many entries show before the toggle. Everything else lives in the <details>. */
  collapsedCount?: number;
  expandLabel: string;
  collapseLabel: string;
}) {
  // ADR-047 §2 — no entries, no section furniture.
  if (items.length === 0) return null;

  const visible = items.slice(0, collapsedCount);
  const hidden = items.slice(collapsedCount);

  return (
    <div data-slot="timeline" className={cn("flex flex-col gap-6", className)} {...props}>
      <ol className="flex flex-col">
        {visible.map((item, index) => (
          <TimelineRow
            key={item.id}
            item={item}
            index={index}
            isLast={hidden.length === 0 && index === visible.length - 1}
          />
        ))}
      </ol>

      {hidden.length > 0 && (
        <details className="group/timeline">
          <summary className="link-underline inline-flex w-fit cursor-pointer list-none items-center gap-2 text-sm font-semibold text-primary-interactive marker:content-none">
            <span className="group-open/timeline:hidden">{expandLabel}</span>
            <span className="hidden group-open/timeline:inline">{collapseLabel}</span>
          </summary>
          <ol className="mt-6 flex flex-col">
            {hidden.map((item, index) => (
              <TimelineRow
                key={item.id}
                item={item}
                index={index}
                isLast={index === hidden.length - 1}
              />
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

export { Timeline };
