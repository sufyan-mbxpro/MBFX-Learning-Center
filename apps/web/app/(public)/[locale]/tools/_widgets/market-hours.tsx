"use client";

// Forex market hours (changes-25 T6, reshaped by ADR-114 #4).
//
// **The page leads with the clock and the overlaps.** It used to lead with two
// form controls and close with a 24-hour timeline, which was built when the
// reference's page had nothing else on it. A reader here wants three facts —
// the time where they are, what is open, and when the busy windows are — and a
// timeline is a picture that contains all three while stating none of them.
//
// Three things it does that a naive version gets wrong:
//
//   1. **DST is derived per instant**, never stored — `@repo/utils`'
//      `sessionState` reads each zone's offset at the moment being asked
//      about, so London shifts against Tokyo twice a year and Sydney shifts
//      the other way. `sessionOverlaps` inherits that: the London/New York
//      window is 13:00–17:00 UTC in January and 12:00–16:00 in July, and it is
//      four hours long in both.
//   2. **The weekend gap closes every session**, whatever its own clock says.
//      Without it, Tokyo reads "open" at 3am on a Saturday.
//   3. **It says how many sessions overlap, never how volatile that is.** The
//      count is arithmetic; "highest volatility, all major pairs active" is a
//      claim about the market (ADR-088, applied to the one tool that had
//      escaped it by carrying no market data at all).
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { sessionOverlaps, sessionState, timelineWindow, type SessionSpec } from "@repo/utils";
import { Badge } from "@repo/ui/components/badge";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Switch } from "@repo/ui/components/switch";
import { WidgetLayout } from "../_components/widget-layout.tsx";
import { ToolCombobox } from "../_components/tool-combobox.tsx";
import {
  useClientNow,
  useClientSecond,
  useClientTimeZone,
} from "../_components/use-client-clock.ts";

export interface MarketHoursConfig {
  sessions?: SessionSpec[];
  mediumVolumeFrom?: number;
  highVolumeFrom?: number;
}

/** A short, honest list — not every IANA zone, which is 400 rows of noise. */
const ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/**
 * The time, ticking, in its OWN component.
 *
 * It holds the second-resolution subscription alone, so the session
 * arithmetic and the overlap intersections above it keep running on the
 * minute. Hoisting `useClientSecond` into the widget would re-run all of that
 * sixty times a minute to move two digits.
 */
function LiveClock({ zone, hour12 }: { zone: string; hour12: boolean }) {
  const now = useClientSecond();
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hour12,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [zone, hour12],
  );
  // `min-h-10` rather than a placeholder glyph: the readout holds its line on
  // the server render and on the first paint, so the badges below it do not
  // jump when the clock arrives. A non-breaking space would do the same job
  // and would be an invisible character in the source, which is a worse thing
  // to leave for the next reader than one utility class.
  return (
    <span className="min-h-10 text-4xl font-semibold tabular-nums">
      {now ? formatter.format(now) : ""}
    </span>
  );
}

export function MarketHoursWidget({ config }: { config: MarketHoursConfig }) {
  const t = useTranslations("tools");
  const sessions = useMemo(() => config.sessions ?? [], [config.sessions]);

  // Both come from the BROWSER, through `useSyncExternalStore` — see
  // `use-client-clock.ts` for why that rather than an effect. The zone is a
  // default the reader can then override, which is why it is copied into
  // state rather than read on every render.
  const detectedZone = useClientTimeZone();
  const now = useClientNow();
  const [chosenZone, setChosenZone] = useState<string | null>(null);
  const zone = chosenZone ?? detectedZone;
  const setZone = setChosenZone;
  const [hour12, setHour12] = useState(false);

  const zoneOptions = useMemo(() => {
    const all = new Set([...ZONES, zone]);
    return [...all].sort().map((value) => ({ value, label: value.replace(/_/g, " ") }));
  }, [zone]);

  const state = useMemo(() => {
    if (!now || sessions.length === 0) return null;
    return sessionState(sessions, now, zone, {
      ...(config.mediumVolumeFrom ? { mediumVolumeFrom: config.mediumVolumeFrom } : {}),
      ...(config.highVolumeFrom ? { highVolumeFrom: config.highVolumeFrom } : {}),
      hour12,
    });
  }, [now, sessions, zone, hour12, config.mediumVolumeFrom, config.highVolumeFrom]);

  const overlaps = useMemo(() => {
    if (!now || !state) return [];
    return sessionOverlaps(state.sessions, timelineWindow(now, zone), now.getTime());
  }, [now, state, zone]);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hour12,
        hour: "2-digit",
        minute: "2-digit",
      }),
    [zone, hour12],
  );

  const durationLabel = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0
      ? t("marketHours.durationHours", { hours })
      : t("marketHours.durationHoursMinutes", { hours, minutes: rest });
  };

  return (
    <WidgetLayout
      inputs={
        <>
          <Field>
            <FieldLabel>{t("marketHours.timezone")}</FieldLabel>
            <ToolCombobox value={zone} onValueChange={setZone} options={zoneOptions} />
          </Field>
          <Field orientation="horizontal">
            <Switch checked={hour12} onCheckedChange={setHour12} />
            <FieldLabel>{t("marketHours.hour12")}</FieldLabel>
          </Field>

          {/* Which sessions are open, under the controls that frame them.
              A dot plus a name plus its window — the three things the timeline
              band drew and never labelled. */}
          {state && (
            <ul className="flex flex-col gap-2 border-t border-border/60 pt-4">
              {state.sessions.map((session) => (
                <li key={session.name} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`size-2.5 rounded-full ${session.isOpen ? "bg-success" : "bg-muted-foreground/40"}`}
                    />
                    <span className="text-sm font-medium">{session.name}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {session.localLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      }
      results={
        state === null ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-xs tracking-caps text-muted-foreground uppercase">
              {t("marketHours.currentTime")}
            </span>
            <LiveClock zone={zone} hour12={hour12} />
            <span className="text-sm text-muted-foreground">{zone.replace(/_/g, " ")}</span>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Badge variant={state.isMarketOpen ? "success" : "outline"}>
                {state.isMarketOpen ? t("marketHours.marketOpen") : t("marketHours.marketClosed")}
              </Badge>
              <Badge variant="outline">{t(`marketHours.volume.${state.volumeBand}`)}</Badge>
            </div>
          </div>
        )
      }
      wide={
        state ? (
          <div className="flex flex-col gap-3 border-t border-border/60 pt-6">
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold">{t("marketHours.overlapsTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("marketHours.overlapsLead")}</p>
            </div>
            {overlaps.length === 0 ? (
              // The honest answer for a session set that never overlaps, not a
              // reason to widen the search until something is found.
              <p className="text-sm text-muted-foreground">{t("marketHours.overlapsNone")}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {overlaps.map((overlap) => (
                  <li
                    key={`${overlap.names.join("-")}-${overlap.start}`}
                    className={`flex flex-col gap-1 rounded-lg p-4 ring-1 ${
                      overlap.isActive ? "bg-success/10 ring-success/40" : "bg-muted/40 ring-border"
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{overlap.names.join(" + ")}</span>
                      {overlap.isActive && (
                        <Badge variant="success" size="sm">
                          {t("marketHours.overlapNow")}
                        </Badge>
                      )}
                    </span>
                    <span className="tabular-nums">
                      {timeFormatter.format(new Date(overlap.start))} –{" "}
                      {timeFormatter.format(new Date(overlap.end))}
                    </span>
                    {/* How LONG, not how volatile. Two sessions being open is
                        a fact about the clock; what the market then does is
                        not ours to promise (ADR-088). */}
                    <span className="text-xs text-muted-foreground">
                      {durationLabel(overlap.durationMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null
      }
    />
  );
}
