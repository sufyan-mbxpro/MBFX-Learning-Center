// The admin RECORD page's building blocks (changes-45): the shape the owner's
// reference user page takes, shared by the three screens that show one
// person — a user, a newsletter subscriber and an employee — so the three read
// as one family rather than three screens that happen to be about people.
//
// Server components with no state: the stat row, the icon-headed card, and
// the label / value table inside it. The tab tray is `@repo/ui`'s `Tabs`,
// composed at each call site, because what the tabs ARE differs per record.
import type { ComponentType } from "react";
import { cn } from "@repo/ui/lib/utils";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/** A row of figures under the record's heading. Four across from `xl`. */
export function RecordStats({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function RecordStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: Icon;
  label: string;
  value: React.ReactNode;
  /** A finer line under the figure ("2 real accounts"). */
  detail?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          {/* A count at the figure size; a word or a date one step down, so
              "Sign-up checkbox" fits the tile instead of truncating. */}
          <span
            className={cn(
              "truncate font-bold tabular-nums",
              typeof value === "number" ? "text-2xl" : "text-lg",
            )}
          >
            {value}
          </span>
          {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

/** An icon-headed card: title, one-line description, an optional action. */
export function RecordCard({
  icon: Icon,
  title,
  description,
  action,
  className,
  children,
}: {
  icon?: Icon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            {Icon && <Icon aria-hidden className="size-5 shrink-0" />}
            {title}
          </h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export interface RecordFact {
  /**
   * The row's React key. Required in practice for any list built from
   * records: a label is only unique on a fixed form, and an activity log says
   * "Users Update" as many times as it happened.
   */
  id?: string;
  label: string;
  value: React.ReactNode;
}

/**
 * The label / value table inside a card. A `<dl>`, because that is what it
 * is; drawn as a bordered table with a rule between rows, as the reference
 * draws it. An empty value prints an em dash rather than a blank cell, so a
 * missing phone number reads as missing and not as a rendering fault.
 */
export function RecordFacts({ facts, className }: { facts: RecordFact[]; className?: string }) {
  return (
    <dl className={cn("overflow-hidden rounded-lg border text-sm", className)}>
      {facts.map((fact) => (
        <div
          key={fact.id ?? fact.label}
          className="grid grid-cols-1 gap-1 border-b px-4 py-3 last:border-b-0 even:bg-muted/30 sm:grid-cols-2 sm:gap-4"
        >
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="min-w-0 font-medium break-words">
            {fact.value === null || fact.value === undefined || fact.value === ""
              ? "—"
              : fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A tab's empty state: one quiet line, never a blank panel. */
export function RecordEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
