// The one section shell every panel on the article editor composes
// (changes-10 item 6).
//
// Before this, each panel was a bare `rounded-lg border bg-card p-4` with a
// 13px heading, so a screen with nine panels read as nine identical grey
// rectangles and the eye had nothing to navigate by. The shell adds the
// three things that turn a stack of boxes into a document: a tinted icon
// that identifies the section at a glance, a one-line description saying
// what belongs in it (ADR-044 #8 already requires this of screens — a
// section long enough to scroll past deserves the same), and a header rule
// separating chrome from fields.
//
// `accent` is an INTENT, not a decoration: it marks what the section is
// for, and the same six tones are used by the stat tiles and the intent
// buttons so one vocabulary runs through the whole screen.
import type { ComponentType } from "react";
import { cn } from "@repo/ui/lib/utils";

export type SectionAccent = "primary" | "success" | "warning" | "info" | "danger" | "neutral";

// The header band. The icon tile alone was carrying the accent, which is
// ~32px of colour on a card the width of the page — at a glance the nine
// panels still read as nine grey rectangles. Tinting the whole header row
// turns the accent into a band the eye can catch while scrolling, and gives
// the title and its description a surface of their own, so the chrome/field
// split the rule draws is reinforced by colour instead of resting on one
// hairline.
//
// The tint stays at /8 with a /15 rule: it has to sit UNDER foreground text
// at the body's contrast in BOTH modes, so it marks the section without
// becoming a second surface competing with the fields below it.
const ACCENT_HEADER: Record<SectionAccent, string> = {
  primary: "border-b-primary/15 bg-primary/8",
  success: "border-b-success/15 bg-success/8",
  warning: "border-b-warning/15 bg-warning/8",
  info: "border-b-info/15 bg-info/8",
  danger: "border-b-destructive/15 bg-destructive/8",
  neutral: "bg-muted/60",
};

// Tiles now sit ON the band, so they carry a ring and a heavier fill: at the
// old /10 against a /8 header the icon would have dissolved into it.
const ACCENT_MEDIA: Record<SectionAccent, string> = {
  primary: "bg-primary/15 text-primary-interactive ring-1 ring-primary/25",
  success: "bg-success/15 text-success-interactive ring-1 ring-success/25",
  warning: "bg-warning/15 text-warning-interactive ring-1 ring-warning/25",
  info: "bg-info/15 text-info-interactive ring-1 ring-info/25",
  danger: "bg-destructive/15 text-destructive ring-1 ring-destructive/25",
  neutral: "bg-background text-muted-foreground ring-1 ring-border",
};

export function EditorSection({
  title,
  description,
  icon: Icon,
  accent = "neutral",
  actions,
  footer,
  bodyClassName,
  className,
  children,
}: {
  title: string;
  /** One line on what belongs here. Required by intent, optional by type
   * only because two panels are self-evident from their heading alone. */
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  accent?: SectionAccent;
  /** Inline at the end of the header row — locale switchers, Add buttons. */
  actions?: React.ReactNode;
  /** Below the rule at the bottom — section-scoped settings. */
  footer?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        // `min-w-0` on the section itself, not just its children: this sits
        // in a grid track whose default `min-width: auto` is what let one
        // wide table inside a panel widen the entire page (changes-10 #9).
        "card-hover flex min-w-0 flex-col rounded-lg border bg-card",
        className,
      )}
    >
      <div
        className={cn(
          // `rounded-t-lg` matches the section's own radius: without it the
          // tint squares off the two corners the border rounds.
          "flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-t-lg border-b p-4",
          ACCENT_HEADER[accent],
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span
              aria-hidden
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                ACCENT_MEDIA[accent],
              )}
            >
              <Icon className="size-4" />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && (
              <p className="text-xs text-balance text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <div className={cn("flex min-w-0 flex-col gap-3 p-4", bodyClassName)}>{children}</div>

      {footer && <div className="flex min-w-0 flex-col gap-3 border-t p-4">{footer}</div>}
    </section>
  );
}

/**
 * A field group inside a section — a label row plus its control, with the
 * optional end-aligned adornment (character counts, hints) the editor uses
 * in a dozen places.
 */
export function Field({
  id,
  label,
  hint,
  adornment,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  adornment?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          className="text-sm leading-none font-medium select-none"
          {...(id ? { htmlFor: id } : {})}
        >
          {label}
        </label>
        {adornment}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
