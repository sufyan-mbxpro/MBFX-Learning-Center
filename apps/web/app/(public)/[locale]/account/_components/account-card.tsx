// One card on the account page (ADR-155): a tinted header with an icon tile,
// a title, a one-line description and an optional status, over the card's own
// content.
//
// The tone tells cards apart at a glance. It is not a status: status is the
// badge in the `status` slot, which says it in words. Every class comes from
// the theme's semantic tokens, following the calendar's `AccentCard`
// discipline. The tile is a solid fill with its engine-derived foreground,
// which is the pairing the theme contrast-checks. The wash stays at /10, the
// ceiling ADR-073 derives the ink against.
//
// No hooks, so both the server masthead and the client panels can render it.
import type { LucideIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

export const ACCOUNT_CARD_TONES = {
  primary: {
    stripe: "bg-primary",
    wash: "from-primary/10",
    tile: "bg-primary text-primary-foreground",
  },
  info: {
    stripe: "bg-info",
    wash: "from-info/10",
    tile: "bg-info text-info-foreground",
  },
  success: {
    stripe: "bg-success",
    wash: "from-success/10",
    tile: "bg-success text-success-foreground",
  },
  warning: {
    stripe: "bg-warning",
    wash: "from-warning/10",
    tile: "bg-warning text-warning-foreground",
  },
} as const;

export type AccountCardTone = keyof typeof ACCOUNT_CARD_TONES;

export function AccountCard({
  id,
  icon: Icon,
  tone,
  title,
  description,
  status,
  children,
  className,
  ...props
}: {
  /** The heading's id, and — suffixed `-card` — the card's own, for `#` links. */
  id: string;
  icon: LucideIcon;
  tone: AccountCardTone;
  title: React.ReactNode;
  description: React.ReactNode;
  status?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"section">, "title" | "id">) {
  const accent = ACCOUNT_CARD_TONES[tone];
  return (
    <section
      id={`${id}-card`}
      aria-labelledby={id}
      data-slot="account-card"
      data-tone={tone}
      className={cn(
        "flex scroll-mt-24 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    >
      <div aria-hidden className={cn("h-1", accent.stripe)} />
      <header
        className={cn(
          "flex flex-wrap items-center gap-4 border-b bg-gradient-to-r to-transparent px-6 py-4 rtl:bg-gradient-to-l",
          accent.wash,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg shadow-sm",
            accent.tile,
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={id} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {status && <div className="flex flex-wrap items-center gap-2">{status}</div>}
      </header>
      <div className="flex flex-1 flex-col gap-6 p-6">{children}</div>
    </section>
  );
}
