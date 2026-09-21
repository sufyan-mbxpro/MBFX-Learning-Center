// changes-21 Phase A — the one skeleton system.
//
// A skeleton stands in for content that is on its way, so its job is to hold
// the RIGHT space: a placeholder of the wrong height moves the page when the
// real thing lands. That is why these primitives are named after what they
// stand in for (a heading, a field, a card, a table) and carry that thing's
// design-system dimensions (tokens.md §2.3, §6.1, §6.9, §6.11), instead of
// every loading.tsx guessing `h-7` for a 36px title.
//
// Motion: every skeleton pulses AND carries the directional `shimmer` sweep
// (globals.css). Before this, half the app's skeletons swept and half only
// pulsed; now there is one look. Both motions sit inside the global
// reduced-motion reset, so a reader who asked for less motion gets still,
// tinted blocks.
//
// Accessibility is the CONTAINER's job, not a block's: a route-level skeleton
// is either `aria-hidden` (Next announces the navigation) or one labelled
// `role="status"` — never forty announced boxes. See page-skeletons.tsx.
import { cn } from "@repo/ui/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("shimmer animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** Ragged right edges, so a block reads as prose rather than as a table. */
const LINE_WIDTHS = ["w-full", "w-11/12", "w-full", "w-4/5", "w-full", "w-5/6"] as const;

/** Lines of body text. The last line is always short, the way a paragraph ends. */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div data-slot="skeleton-text" className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "h-4",
            index === lines - 1 && lines > 1 ? "w-3/5" : LINE_WIDTHS[index % LINE_WIDTHS.length],
          )}
        />
      ))}
    </div>
  );
}

/**
 * One heading line at a type role's line height (tokens.md §2.3): `page` is
 * PageTitle's 36px, `section` SectionTitle's 24px, `compact`
 * SectionTitleCompact's 20px.
 */
const HEADING_SIZE = {
  page: "h-9 w-64",
  section: "h-6 w-48",
  compact: "h-5 w-36",
} as const;

function SkeletonHeading({
  size = "section",
  className,
}: {
  size?: keyof typeof HEADING_SIZE;
  className?: string;
}) {
  return <Skeleton data-slot="skeleton-heading" className={cn(HEADING_SIZE[size], className)} />;
}

/** Avatar sizes from tokens.md §6.7: sm 32 · default 40 · lg 48. */
const AVATAR_SIZE = { sm: "size-8", default: "size-10", lg: "size-12" } as const;

function SkeletonAvatar({
  size = "default",
  shape = "circle",
  className,
}: {
  size?: keyof typeof AVATAR_SIZE;
  shape?: "circle" | "square";
  className?: string;
}) {
  return (
    <Skeleton
      data-slot="skeleton-avatar"
      className={cn(
        "shrink-0",
        AVATAR_SIZE[size],
        shape === "circle" ? "rounded-full" : "rounded-xl",
        className,
      )}
    />
  );
}

/** The aspect ratios covers, players and thumbnails actually use. */
const IMAGE_RATIO = {
  video: "aspect-video",
  square: "aspect-square",
  "4/3": "aspect-4/3",
  "16/6": "aspect-16/6",
} as const;

function SkeletonImage({
  ratio = "video",
  className,
}: {
  ratio?: keyof typeof IMAGE_RATIO;
  className?: string;
}) {
  return (
    <Skeleton
      data-slot="skeleton-image"
      className={cn("w-full rounded-lg", IMAGE_RATIO[ratio], className)}
    />
  );
}

/** Button heights from tokens.md §6.1 — the same size NAMES as Button. */
const BUTTON_SIZE = {
  default: "h-10 w-24",
  sm: "h-9 w-20",
  xs: "h-8 w-16",
  lg: "h-11 w-32",
  xl: "h-12 w-40",
  icon: "size-10",
  "icon-sm": "size-9",
} as const;

// ADR-107 #4: a skeleton's radius is its real component's radius. The `shape`
// prop went with `Button`'s pill — a placeholder in a shape the content will
// not arrive in is a layout shift, which is the one thing a skeleton exists to
// prevent.
function SkeletonButton({
  size = "default",
  className,
}: {
  size?: keyof typeof BUTTON_SIZE;
  className?: string;
}) {
  return (
    <Skeleton
      data-slot="skeleton-button"
      className={cn("shrink-0 rounded-md", BUTTON_SIZE[size], className)}
    />
  );
}

/** A form field: label (14px) → 8px → a 40px control (tokens.md §3.2, §6.2). */
function SkeletonField({ className }: { className?: string }) {
  return (
    <div data-slot="skeleton-field" className={cn("flex flex-col gap-2", className)}>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

/**
 * Card's own shell (ADR-075): rounded-lg, 1px border, shadow-sm, the 24px
 * rhythm (16px at `sm`). A `media` ratio draws a cover flush to the top, as
 * `Card` does for a `card-media` first child.
 */
function SkeletonCard({
  media,
  lines = 2,
  size = "default",
  className,
  children,
}: {
  media?: keyof typeof IMAGE_RATIO;
  lines?: number;
  size?: "default" | "sm";
  className?: string;
  /** Replaces the default heading + lines body. */
  children?: React.ReactNode;
}) {
  const pad = size === "sm" ? "px-4" : "px-6";
  return (
    <div
      data-slot="skeleton-card"
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm",
        size === "sm" ? "gap-4 py-4" : "gap-6 py-6",
        media && "pt-0",
        className,
      )}
    >
      {media && <SkeletonImage ratio={media} className="rounded-none" />}
      <div className={cn("flex flex-col gap-3", pad)}>
        {children ?? (
          <>
            <SkeletonHeading size="compact" />
            <SkeletonText lines={lines} />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One table row. `compact` is DataTable's density (px-2.5 py-2, tokens.md
 * §6.9); `default` is a plain Table's p-4.
 */
const CELL_WIDTHS = ["w-40", "w-28", "w-20", "w-24", "w-16", "w-32"] as const;

function SkeletonTableRow({
  columns = 5,
  density = "compact",
}: {
  columns?: number;
  density?: "compact" | "default";
}) {
  return (
    <div data-slot="skeleton-table-row" className="flex items-center border-b last:border-b-0">
      {Array.from({ length: columns }, (_, index) => (
        <div
          key={index}
          className={cn(
            "min-w-0 flex-1",
            density === "compact" ? "px-2.5 py-2" : "p-4",
            index === 0 && "flex-2",
          )}
        >
          <Skeleton className={cn("h-4 max-w-full", CELL_WIDTHS[index % CELL_WIDTHS.length])} />
        </div>
      ))}
    </div>
  );
}

/**
 * A DataTable block: the `bg-muted/50` 48px header band, the rows, and the
 * `px-4 py-3 border-t` pager footer — the same bordered box a list screen
 * renders, so the swap is a fill.
 */
function SkeletonTable({
  rows = 8,
  columns = 5,
  density = "compact",
  footer = true,
  className,
}: {
  rows?: number;
  columns?: number;
  density?: "compact" | "default";
  footer?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="skeleton-table" className={cn("overflow-hidden rounded-md border", className)}>
      <div
        className={cn("flex h-12 items-center border-b", density === "compact" && "bg-muted/50")}
      >
        {Array.from({ length: columns }, (_, index) => (
          <div
            key={index}
            className={cn(
              "min-w-0 flex-1",
              density === "compact" ? "px-2.5" : "px-4",
              index === 0 && "flex-2",
            )}
          >
            <Skeleton className="h-3 w-16 max-w-full" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonTableRow key={index} columns={columns} density={density} />
      ))}
      {footer && (
        <div className="flex flex-col items-center justify-between gap-4 border-t px-4 py-3 sm:flex-row">
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center gap-2">
            <SkeletonButton size="sm" />
            <SkeletonButton size="icon-sm" />
            <SkeletonButton size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}

export {
  Skeleton,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonField,
  SkeletonHeading,
  SkeletonImage,
  SkeletonTable,
  SkeletonTableRow,
  SkeletonText,
};
