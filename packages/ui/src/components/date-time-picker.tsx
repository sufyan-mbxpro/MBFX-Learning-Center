"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import { useFieldControl } from "@repo/ui/components/field";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  selectTriggerVariants,
  SelectValue,
} from "@repo/ui/components/select";

// changes-32 — the date-and-time control, in the site's own design language.
//
// It replaces `<Input type="datetime-local">`, which looked like a themed
// field and then opened Chrome's own picker: a blue calendar, blue selection
// chips and a blue clock column, none of it reachable by CSS. A native
// control's popup is browser UI — `::-webkit-calendar-picker-indicator` can
// be recoloured and nothing inside the panel can — so matching the theme
// means owning the panel. The same native box is also where the owner's
// "extra space on the right" came from: `datetime-local` lays out
// `mm/dd/yyyy --:-- --` and parks its indicator after it, so a full-width
// field showed a wide dead gap. Here the trigger is the value plus one glyph
// at the inline END, so the width is all used.
//
// Presentational, and deliberately so: `@repo/ui` carries no catalog
// (code-style.md #2), so every word arrives in `labels`. `AdminCombobox` is
// the precedent — one client wrapper reads `useTranslations` and every screen
// inherits it.
//
// The hour and minute dropdowns are the plain `Select`, not a searchable
// Combobox. ADR-057's threshold is about the ADMIN dropdown choosing its own
// branch, and it says outright that a call site knowing better may override
// in either direction: a search box over "00…23" is a worse control, and the
// lint rule that enforces `AdminCombobox` is scoped to `app/(admin)/**` for
// exactly this kind of composite.

/** Every word this control shows. */
export interface DateTimePickerLabels {
  /** Shown on the trigger when there is no value. */
  placeholder: string;
  previousMonth: string;
  nextMonth: string;
  hour: string;
  minute: string;
}

/**
 * Minute granularity. ADR-071 declined a to-the-minute promise the readers'
 * five-minute `cacheLife` cannot keep, so the list steps in fives — and an
 * existing value off the step is still offered, because a stored time must
 * never change just because its field was opened.
 */
const MINUTE_STEP = 5;

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** The `datetime-local` wire format this control keeps: local time, no zone. */
const VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function parseValue(value: string): Parts | null {
  const match = VALUE_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month) - 1,
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatValue(parts: Parts): string {
  return `${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/**
 * Every date the grid formats is built at UTC midnight and formatted with
 * `timeZone: "UTC"`. That is not a timezone decision — the VALUE is local
 * wall-clock throughout — it is what keeps "the 15th" from rendering as the
 * 14th for a reader west of Greenwich, and what makes the server's render and
 * the browser's agree character for character.
 */
function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * 2024-01-07 is a Sunday, so seven consecutive days from it name every
 * weekday in order with no hard-coded list to translate.
 */
function weekdayLabels(locale: string, weekStartsOn: number): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, index) =>
    format.format(utcDay(2024, 0, 7 + ((index + weekStartsOn) % 7))),
  );
}

/**
 * A cell carries everything the grid draws, so the JSX never reaches back for
 * the month it belongs to — which is also what keeps the browsed month
 * narrowed in one place instead of a non-null assertion per cell.
 */
interface Cell {
  day: number;
  label: string;
  isToday: boolean;
}

export function DateTimePicker({
  id,
  value,
  onChange,
  labels,
  locale = "en-US",
  weekStartsOn = 0,
  disabled,
  className,
  ...aria
}: {
  id?: string;
  /** `"YYYY-MM-DDTHH:mm"` in local time, or `""`. The `datetime-local` format. */
  value: string;
  onChange: (next: string) => void;
  labels: DateTimePickerLabels;
  /**
   * Fixed rather than the runtime default on purpose: `undefined` resolves to
   * the server's locale during SSR and the browser's after hydration, which
   * is a mismatch on a control whose whole content is formatted dates. The
   * admin is English by design (ADR-043 #2); a public caller passes its own.
   */
  locale?: string;
  /** 0 = Sunday. */
  weekStartsOn?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  required?: boolean;
  "aria-required"?: boolean;
}) {
  // The trigger is a button, so `required` becomes `aria-required` (ADR-077).
  const wired = useFieldControl({ id, ...aria }, { requiredAs: "aria" });
  const selected = parseValue(value);

  // Which month the grid shows. `null` until something says otherwise, so the
  // clock is never read during render — the purity rule `schedule-field.tsx`
  // documents. The effect below fills it in at mount, long before a click can
  // open the popover.
  const [view, setView] = React.useState<{ year: number; month: number } | null>(null);
  React.useEffect(() => {
    setView((current) => {
      if (current) return current;
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    });
  }, []);
  // Today's marker, for the same reason and by the same route.
  const [today, setToday] = React.useState<string | null>(null);
  React.useEffect(() => {
    const now = new Date();
    setToday(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  }, []);

  // A value always wins over the browsed month: re-opening the field lands on
  // the month the value is in, not wherever the last visit left off.
  const shown = selected ? { year: selected.year, month: selected.month } : view;

  const dateFormat = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const longDateFormat = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }),
    [locale],
  );
  const monthFormat = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }),
    [locale],
  );
  const weekdays = React.useMemo(() => weekdayLabels(locale, weekStartsOn), [locale, weekStartsOn]);

  const minutes = React.useMemo(() => {
    const steps = Array.from({ length: 60 / MINUTE_STEP }, (_, index) => index * MINUTE_STEP);
    if (selected && !steps.includes(selected.minute)) {
      steps.push(selected.minute);
      steps.sort((a, b) => a - b);
    }
    return steps;
  }, [selected]);

  function commit(next: Partial<Parts>) {
    // A day picked on an empty field lands at 09:00 — the same hour the
    // "Tomorrow" and "Next week" presets use, so the two agree.
    const base: Parts = selected ?? {
      year: shown?.year ?? 0,
      month: shown?.month ?? 0,
      day: 1,
      hour: 9,
      minute: 0,
    };
    onChange(formatValue({ ...base, ...next }));
  }

  function shiftMonth(delta: number) {
    const from = shown ?? { year: 0, month: 0 };
    const moved = new Date(Date.UTC(from.year, from.month + delta, 1));
    const next = { year: moved.getUTCFullYear(), month: moved.getUTCMonth() };
    setView(next);
    // With a value set, the grid follows the VALUE, so paging months has to
    // move the value too or the arrows would appear broken.
    if (selected) {
      commit({
        year: next.year,
        month: next.month,
        day: Math.min(selected.day, daysInMonth(next.year, next.month)),
      });
    }
  }

  const cells: (Cell | null)[] = React.useMemo(() => {
    if (!shown) return [];
    const firstWeekday = utcDay(shown.year, shown.month, 1).getUTCDay();
    const lead = (firstWeekday - weekStartsOn + 7) % 7;
    const total = daysInMonth(shown.year, shown.month);
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: total }, (_, index): Cell => {
        const day = index + 1;
        return {
          day,
          label: longDateFormat.format(utcDay(shown.year, shown.month, day)),
          isToday: today === `${shown.year}-${pad(shown.month + 1)}-${pad(day)}`,
        };
      }),
    ];
  }, [shown, weekStartsOn, longDateFormat, today]);

  return (
    <Popover>
      <PopoverTrigger
        nativeButton
        disabled={disabled}
        className={cn(
          selectTriggerVariants({ size: "default" }),
          "w-full",
          !selected && "text-muted-foreground",
          className,
        )}
        {...wired}
      >
        <span className="truncate">
          {selected
            ? `${dateFormat.format(utcDay(selected.year, selected.month, selected.day))}, ${pad(selected.hour)}:${pad(selected.minute)}`
            : labels.placeholder}
        </span>
        <CalendarDays aria-hidden className="size-4 shrink-0 opacity-60" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={labels.previousMonth}
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft aria-hidden className="rtl:rotate-180" />
            </Button>
            <span aria-live="polite" className="text-sm font-medium">
              {shown ? monthFormat.format(utcDay(shown.year, shown.month, 1)) : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={labels.nextMonth}
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight aria-hidden className="rtl:rotate-180" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {weekdays.map((weekday) => (
              <span
                key={weekday}
                aria-hidden
                className="flex size-9 items-center justify-center text-2xs font-medium text-muted-foreground"
              >
                {weekday}
              </span>
            ))}
            {cells.map((cell, index) =>
              cell === null ? (
                // A lead blank has no identity beyond its position, and the
                // positions are stable for a given month.
                <span key={`lead-${index}`} className="size-9" />
              ) : (
                <button
                  key={cell.day}
                  type="button"
                  aria-pressed={selected?.day === cell.day}
                  aria-label={cell.label}
                  onClick={() => commit({ day: cell.day })}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                    selected?.day === cell.day &&
                      "bg-primary-solid text-primary-solid-foreground hover:bg-primary-solid-hover hover:text-primary-solid-foreground",
                    selected?.day !== cell.day &&
                      cell.isToday &&
                      "font-semibold text-primary-interactive ring-1 ring-primary/40",
                  )}
                >
                  {cell.day}
                </button>
              ),
            )}
          </div>

          <div className="flex items-center gap-2 border-t pt-3">
            <Select
              value={selected ? pad(selected.hour) : ""}
              onValueChange={(next) => commit({ hour: Number(next) })}
            >
              <SelectTrigger size="sm" aria-label={labels.hour} className="w-full">
                <SelectValue>{selected ? pad(selected.hour) : "--"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, hour) => (
                  <SelectItem key={hour} value={pad(hour)}>
                    {pad(hour)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span aria-hidden className="text-sm text-muted-foreground">
              :
            </span>
            <Select
              value={selected ? pad(selected.minute) : ""}
              onValueChange={(next) => commit({ minute: Number(next) })}
            >
              <SelectTrigger size="sm" aria-label={labels.minute} className="w-full">
                <SelectValue>{selected ? pad(selected.minute) : "--"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {minutes.map((minute) => (
                  <SelectItem key={minute} value={pad(minute)}>
                    {pad(minute)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
