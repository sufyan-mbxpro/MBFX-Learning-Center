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

const ACCENT_MEDIA: Record<SectionAccent, string> = {
  primary: "bg-primary/10 text-primary-interactive",
  success: "bg-success/10 text-success-interactive",
  warning: "bg-warning/10 text-warning-interactive",
  info: "bg-info/10 text-info-interactive",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
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
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b p-4">
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
