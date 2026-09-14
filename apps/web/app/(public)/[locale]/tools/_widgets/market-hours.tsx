"use client";

// Forex market hours (changes-25 T6).
//
// **The timeline is the page's main draw on the reference, so it ships with
// the tool rather than after it.** Four sessions drawn as bands across one
// day in the viewer's own timezone, with a now-marker.
//
// Three things it does that a naive version gets wrong:
//
//   1. **DST is derived per instant**, never stored — `@repo/utils`'
//      `sessionState` reads each zone's offset at the moment being asked
//      about, so London shifts against Tokyo twice a year and Sydney shifts
//      the other way.
//   2. **The weekend gap closes every session**, whatever its own clock says.
//      Without it, Tokyo reads "open" at 3am on a Saturday.
//   3. **It scrolls inside its own container** at 400px rather than pushing
//      the page sideways, and it reads in RTL because the bands are positioned
//      with logical offsets.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  nowFraction,
  sessionDaySegments,
  sessionState,
  timelineWindow,
  type SessionSpec,
} from "@repo/utils";
import { Badge } from "@repo/ui/components/badge";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Switch } from "@repo/ui/components/switch";
import { WidgetLayout } from "../_components/widget-layout.tsx";
import { ToolCombobox } from "../_components/tool-combobox.tsx";
import { useClientNow, useClientTimeZone } from "../_components/use-client-clock.ts";

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

const BAND_TONES = ["bg-primary/70", "bg-info/70", "bg-success/70", "bg-warning/70"];

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

  const window = useMemo(() => (now ? timelineWindow(now, zone) : null), [now, zone]);
  const marker = now && window ? nowFraction(now, window) : null;

  return (
    <WidgetLayout
      inputs={
        <>
          <Field>
            <FieldLabel>{t("marketHours.timezone")}</FieldLabel>
            <ToolCombobox value={zone} onValueChange={setZone} options={zoneOptions} />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel>{t("marketHours.hour12")}</FieldLabel>
            <Switch checked={hour12} onCheckedChange={setHour12} />
          </Field>
        </>
      }
      results={
        state === null ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Badge variant={state.isMarketOpen ? "success" : "outline"}>
                {state.isMarketOpen ? t("marketHours.marketOpen") : t("marketHours.marketClosed")}
              </Badge>
              <Badge variant="outline">{t(`marketHours.volume.${state.volumeBand}`)}</Badge>
            </div>
            <ul className="flex flex-col gap-2">
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
          </>
        )
      }
      wide={
        state && window ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("marketHours.timelineTitle")}</h3>
            {/* Its own scroll container (code-style.md's wide-content rule):
                at 400px this is the one band wider than the page, and it
                scrolls rather than pushing the whole page sideways. */}
            <div className="overflow-x-auto">
              <div className="relative min-w-160 pt-6 pb-2">
                {/* Hour ticks. `inset-inline-start` through a style property
                    rather than `left`, so the axis reverses under dir=rtl
                    with the rest of the page. */}
                {Array.from({ length: 25 }, (_, hour) => (
                  <span
                    key={hour}
                    aria-hidden
                    className="absolute top-0 text-3xs text-muted-foreground tabular-nums"
                    style={{ insetInlineStart: `${(hour / 24) * 100}%` }}
                  >
                    {hour % 3 === 0 ? hour : ""}
                  </span>
                ))}

                <div className="flex flex-col gap-1.5">
                  {state.sessions.map((session, index) => (
                    <div key={session.name} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 truncate text-xs">{session.name}</span>
                      <div className="relative h-5 flex-1 rounded bg-muted">
                        {sessionDaySegments(session, window).map((segment, i) => (
                          <span
                            key={i}
                            className={`absolute inset-y-0 rounded ${BAND_TONES[index % BAND_TONES.length]}`}
                            style={{
                              insetInlineStart: `${segment.startFraction * 100}%`,
                              inlineSize: `${(segment.endFraction - segment.startFraction) * 100}%`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {marker !== null && (
                  <span
                    aria-hidden
                    className="absolute inset-y-4 w-px bg-foreground"
                    style={{ insetInlineStart: `calc(5.5rem + ${marker} * (100% - 5.5rem))` }}
                  />
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("marketHours.timelineNote")}</p>
          </div>
        ) : null
      }
    />
  );
}
