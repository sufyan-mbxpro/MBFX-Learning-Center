"use client";

// The "publish it later" control, shared by BOTH publishing panels.
//
// It was `publish-panel.tsx`'s alone while articles were the only entity with
// a `scheduledFor` column. ADR-071 gave the other five entities one, so
// `ContentStatusPanel` needs the identical field — and a second copy of a
// date-time control plus three clock-reading preset helpers is exactly the
// kind of duplication this repo has already paid for once (four copies of one
// FNV-1a hash, collapsed in changes-18).
//
// The control itself stopped being `<Input type="datetime-local">` in
// changes-32: the box was themed and the picker it opened was Chrome's own
// blue one, which no stylesheet reaches. `@repo/ui`'s `DateTimePicker` keeps
// the same "YYYY-MM-DDTHH:mm" local-time string, so nothing below this
// component moved.
import { useTranslations } from "next-intl";

import { Button } from "@repo/ui/components/button";
import { DateTimePicker } from "@repo/ui/components/date-time-picker";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { toZonedInput, zonedInputAtHour } from "@repo/utils";

export interface ScheduleFieldLabels {
  scheduleFor: string;
  presetPlusHour: string;
  presetTomorrow9: string;
  presetNextWeek: string;
  presetClear: string;
}

// Module scope, not the component body: these read the clock, and doing that
// during render is exactly what react-hooks/purity forbids. They are only ever
// CALLED from a click handler. ADR-182: both are read in the SITE's timezone,
// so "Tomorrow 9:00" is nine o'clock where the site says it is, not where the
// editor happens to be sitting.
function plusHour(): string {
  return toZonedInput(new Date(Date.now() + 60 * 60 * 1000));
}

function atNineAmIn(days: number): string {
  return zonedInputAtHour(days, 9);
}

/**
 * `value` is the raw `datetime-local` string — a wall clock, no zone. The
 * caller converts it to an instant at the boundary with `zonedInputToIso`
 * (`@repo/utils`), which reads it in the site's timezone (ADR-182) — so there
 * is still no timezone picker here; ADR-071 lists one under "deliberately not
 * built".
 *
 * Presets are hours and days rather than minutes on purpose. Punctuality is
 * bounded by the readers' five-minute `cacheLife`, so offering a to-the-minute
 * control would promise precision the system does not have (ADR-015 #6).
 */
export function ScheduleField({
  id,
  value,
  onChange,
  labels,
  required,
  error,
}: {
  /** Only when something outside the field needs the input's id. */
  id?: string;
  value: string;
  onChange: (next: string) => void;
  labels: ScheduleFieldLabels;
  /** ADR-077: a SCHEDULED move needs a date, so the panel marks it required. */
  required?: boolean;
  /** The inline message for this field, from the host's `useFieldErrors`. */
  error?: string;
}) {
  const preset = (fn: () => string) => () => onChange(fn());
  // The picker's own chrome, read here rather than threaded through the six
  // screens that build `labels` — the `AdminCombobox` arrangement, and the
  // reason those five keys are not in `ScheduleFieldLabels`.
  const t = useTranslations("admin");

  // Its own Field (ADR-077): the label, the asterisk and the error wire to
  // the input without the host threading an id pair through.
  return (
    <Field controlId={id} invalid={Boolean(error)} required={required} className="border-t pt-3">
      <FieldLabel>{labels.scheduleFor}</FieldLabel>
      <DateTimePicker
        value={value}
        onChange={onChange}
        labels={{
          placeholder: t("schedulePickerPlaceholder"),
          previousMonth: t("schedulePickerPreviousMonth"),
          nextMonth: t("schedulePickerNextMonth"),
          hour: t("schedulePickerHour"),
          minute: t("schedulePickerMinute"),
        }}
      />
      <FieldError>{error}</FieldError>
      <div className="flex flex-wrap gap-1.5">
        <Button variant="outline" size="xs" onClick={preset(plusHour)}>
          {labels.presetPlusHour}
        </Button>
        <Button variant="outline" size="xs" onClick={preset(() => atNineAmIn(1))}>
          {labels.presetTomorrow9}
        </Button>
        <Button variant="outline" size="xs" onClick={preset(() => atNineAmIn(7))}>
          {labels.presetNextWeek}
        </Button>
        <Button variant="ghost" size="xs" onClick={() => onChange("")}>
          {labels.presetClear}
        </Button>
      </div>
    </Field>
  );
}
