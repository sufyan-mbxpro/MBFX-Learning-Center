// Empty-state primitive (server-safe — no client runtime). Gives every
// "nothing here yet" the same shape: optional icon, title, supporting
// copy, optional CTA. All text arrives from the caller's catalog.
import { TriangleAlert } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-8 text-center",
        className,
      )}
      {...props}
    />
  );
}

function EmptyMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-media"
      className={cn(
        "mb-2 flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg:not([class*='size-'])]:size-5",
        className,
      )}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn("max-w-sm text-sm text-balance text-muted-foreground", className)}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("mt-3 flex flex-wrap items-center justify-center gap-2", className)}
      {...props}
    />
  );
}

// ─── changes-21 Phase A: the two composed states ──────────────────────────
//
// tokens.md §6.9 keeps `Empty` as the empty state (Q12). These are the one
// way to compose it, so a call site passes content and never re-assembles
// the parts with its own padding and type:
//
//   · `EmptyState` — nothing here (yet). Neutral media tile.
//   · `ErrorState` — this failed. The same anatomy, a destructive tonal tile
//     (/10 behind `-interactive` ink, ADR-073) and `role="alert"`.
//
// Sizes: `sm` sits inside a panel or popover; `default` fills a table or a
// card body; `lg` is a route-level state (a 404, an error boundary) and
// drops the dashed border, because the page is the container.
const STATE_SIZE = {
  sm: {
    root: "gap-1 p-4",
    media: "mb-1 size-8 [&_svg:not([class*='size-'])]:size-4",
    title: "text-sm",
  },
  default: { root: "", media: "", title: "text-sm" },
  lg: {
    root: "min-h-(--height-half-screen) border-none p-8",
    media: "mb-3 size-12 rounded-lg [&_svg:not([class*='size-'])]:size-6",
    title: "text-xl font-semibold",
  },
} as const;

type StateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Buttons or links, laid out in `EmptyContent`. */
  action?: React.ReactNode;
  size?: keyof typeof STATE_SIZE;
  /** The title's tag. A route-level state that IS the page passes "h1". */
  titleAs?: "div" | "h1" | "h2" | "h3";
  className?: string;
};

function StateBody({
  icon,
  title,
  description,
  action,
  size = "default",
  titleAs: Title = "div",
  mediaClassName,
}: StateProps & { mediaClassName?: string }) {
  const s = STATE_SIZE[size];
  return (
    <>
      {icon && <EmptyMedia className={cn(s.media, mediaClassName)}>{icon}</EmptyMedia>}
      <Title data-slot="empty-title" className={cn("font-medium text-foreground", s.title)}>
        {title}
      </Title>
      {description && (
        <EmptyDescription className={cn(size === "lg" && "text-base")}>
          {description}
        </EmptyDescription>
      )}
      {action && <EmptyContent>{action}</EmptyContent>}
    </>
  );
}

function EmptyState({ className, size = "default", ...props }: StateProps) {
  return (
    <Empty data-state-kind="empty" className={cn(STATE_SIZE[size].root, className)}>
      <StateBody size={size} {...props} />
    </Empty>
  );
}

function ErrorState({ className, size = "default", icon, ...props }: StateProps) {
  return (
    <Empty role="alert" data-state-kind="error" className={cn(STATE_SIZE[size].root, className)}>
      <StateBody
        size={size}
        icon={icon ?? <TriangleAlert aria-hidden />}
        mediaClassName="bg-destructive/10 text-destructive-interactive"
        {...props}
      />
    </Empty>
  );
}

export { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyState, EmptyTitle, ErrorState };
