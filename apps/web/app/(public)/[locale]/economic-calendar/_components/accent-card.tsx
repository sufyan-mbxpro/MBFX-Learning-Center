// The calendar page's feature card (ADR-050).
//
// NOT `@repo/ui`'s IconCard: that card's icon box is always primary-tinted,
// and the whole job here is that COLOUR CARRIES MEANING — a high-impact
// release and a market holiday must not look alike. So the tone is a prop,
// drawn from the theme's own semantic tokens; there is no literal here and
// nothing for an author to hand-pick.
//
// Every animated property sits on a CHILD element, deliberately. `.card-hover`
// (globals.css) declares its own `transition-property` list and, living later
// in the same `@layer utilities`, it beats any transition utility written in
// the class attribute — so a `hover:-translate-y-1` on this card would jump
// rather than glide. Children are outside that rule and animate freely, which
// is how the sweep, the icon swap and the wash all move while the card keeps
// the one shared shadow/ring treatment every other surface in the app uses.
import type { LucideIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface AccentTone {
  /** Idle uses the `*-interactive` ink on a 10% wash — ADR-018 rule 5: a glyph is a "small" element and never takes raw --primary et al. Hover flips to the FILL with its derived foreground, which is the pairing the theme engine contrast-checks. */
  icon: string;
  /** The rule that sweeps across the top edge on hover. */
  bar: string;
  /** A barely-there gradient that warms the whole card. */
  wash: string;
}

export const ACCENT_TONES = {
  primary: {
    icon: "bg-primary/10 text-primary-interactive group-hover:bg-primary group-hover:text-primary-foreground",
    bar: "bg-primary",
    wash: "from-primary/8",
  },
  info: {
    icon: "bg-info/10 text-info-interactive group-hover:bg-info group-hover:text-info-foreground",
    bar: "bg-info",
    wash: "from-info/8",
  },
  success: {
    icon: "bg-success/10 text-success-interactive group-hover:bg-success group-hover:text-success-foreground",
    bar: "bg-success",
    wash: "from-success/8",
  },
  warning: {
    icon: "bg-warning/10 text-warning-interactive group-hover:bg-warning group-hover:text-warning-foreground",
    bar: "bg-warning",
    wash: "from-warning/8",
  },
  destructive: {
    icon: "bg-destructive/10 text-destructive-interactive group-hover:bg-destructive group-hover:text-destructive-foreground",
    bar: "bg-destructive",
    wash: "from-destructive/8",
  },
  // No `--muted-interactive` exists, and none is wanted: this tone is the
  // deliberately quiet one on a scale where the others shout.
  muted: {
    icon: "bg-muted-foreground/10 text-muted-foreground group-hover:bg-muted-foreground group-hover:text-background",
    bar: "bg-muted-foreground",
    wash: "from-muted-foreground/8",
  },
} as const satisfies Record<string, AccentTone>;

export type AccentToneKey = keyof typeof ACCENT_TONES;

export function AccentCard({
  icon: Icon,
  title,
  tone = "primary",
  children,
  className,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  tone?: AccentToneKey;
  children?: React.ReactNode;
  className?: string;
}) {
  const accent = ACCENT_TONES[tone];

  return (
    <div
      className={cn(
        "card-hover group relative isolate flex h-full flex-col gap-3 overflow-hidden rounded-xl bg-card p-6 ring-1 ring-foreground/10",
        className,
      )}
    >
      {/* Tone wash. `-z-10` keeps it under the copy without a stacking
          context fight — the card sets `isolate` for exactly that. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100",
          accent.wash,
        )}
      />

      {/* Top rule, sweeping from the inline start — `start-0` + `w-full` so
          it runs the correct way in RTL with no [dir] rule of its own. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 start-0 h-1 w-0 transition-[width] duration-300 ease-out group-hover:w-full",
          accent.bar,
        )}
      />

      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-xl transition-colors duration-300 ease-out",
          accent.icon,
        )}
      >
        <Icon
          aria-hidden
          className="size-6 transition-transform duration-300 ease-out group-hover:scale-110"
        />
      </span>

      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {children && <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>}
    </div>
  );
}
