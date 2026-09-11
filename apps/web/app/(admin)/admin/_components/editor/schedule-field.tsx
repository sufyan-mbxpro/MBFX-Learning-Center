"use client";

// The "publish it later" control, shared by BOTH publishing panels.
//
// It was `publish-panel.tsx`'s alone while articles were the only entity with
// a `scheduledFor` column. ADR-071 gave the other five entities one, so
// `ContentStatusPanel` needs the identical field — and a second copy of a
// `datetime-local` input plus three clock-reading preset helpers is exactly
// the kind of duplication this repo has already paid for once (four copies of
// one FNV-1a hash, collapsed in changes-18).
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

export interface ScheduleFieldLabels {
  scheduleFor: string;
  presetPlusHour: string;
  presetTomorrow9: string;
  presetNextWeek: string;
  presetClear: string;
}

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in LOCAL time, not an ISO string. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Module scope, not the component body: these read the clock, and doing that
// during render is exactly what react-hooks/purity forbids. They are only ever
// CALLED from a click handler.
function plusHour(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

function atNineAmIn(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * `value` is the raw `datetime-local` string — local time, no zone. The
 * caller converts it to an instant at the boundary (`new Date(v).toISOString()`),
 * which is why there is no timezone picker here: the editor's own clock is the
 * zone, and ADR-071 lists a picker under "deliberately not built".
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
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  labels: ScheduleFieldLabels;
}) {
  const preset = (fn: () => Date) => () => onChange(toLocalInput(fn()));

  return (
    <div className="flex flex-col gap-1.5 border-t pt-3">
      <Label htmlFor={id}>{labels.scheduleFor}</Label>
      <Input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
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
    </div>
  );
}
