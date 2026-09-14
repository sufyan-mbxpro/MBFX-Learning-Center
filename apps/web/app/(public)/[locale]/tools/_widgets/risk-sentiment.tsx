"use client";

// The risk-on / risk-off meter (changes-25 T8, ADR-088 §4–§7).
//
// **Nothing here says "real-time" or "live."** The score moves once per daily
// sweep, and a disclaimer does not repair a word that was false. The "as of"
// line and the methodology panel carry the cadence instead, and
// `tools-area.test.ts` fails on either word anywhere in this namespace.
//
// **A component that could not report is named and counted, never zero-filled**
// (ADR-088 #5). A zero-filled gauge is a claim that gold was flat; an absent
// one is the truth, which is that we do not know.
//
// The sparkline is hand-drawn SVG rather than a charting library: ADR-086's
// risk #4 puts a blocking Lighthouse budget on these routes, and sixty points
// on one path is not worth 40kB of recharts.
import { useTranslations } from "next-intl";
import { Badge } from "@repo/ui/components/badge";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Methodology } from "../_components/methodology.tsx";

export interface RiskComponentView {
  key: string;
  symbol: string;
  displayName: string;
  score: number;
  rank: number;
  weight: number;
  direction: "risk-on" | "risk-off";
}

export interface RiskSentimentData {
  score: number | null;
  band: "risk-off" | "neutral" | "risk-on" | null;
  components: RiskComponentView[];
  reporting: { reported: number; total: number; excluded: string[] };
  history: { date: string; score: number }[];
  lookbackDays: number;
  bands: { riskOffBelow: number; riskOnAbove: number };
}

const BAND_TONE = {
  "risk-off": "destructive",
  neutral: "outline",
  "risk-on": "success",
} as const;

/** Sixty points on one path — the whole reason no charting library is here. */
function Sparkline({ points }: { points: { date: string; score: number }[] }) {
  if (points.length < 2) return null;
  const width = 240;
  const height = 48;
  // The score is already 0–100, so the y-scale is fixed rather than fitted:
  // a fitted axis would make a flat week look like a rollercoaster.
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - (point.score / 100) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-12 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function RiskSentimentWidget({
  data,
  asOfLabel,
}: {
  data: RiskSentimentData;
  asOfLabel: string | null;
}) {
  const t = useTranslations("tools");

  if (data.score === null || data.band === null) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="info">
          <AlertDescription>{t("risk.empty", { total: data.reporting.total })}</AlertDescription>
        </Alert>
        <Methodology
          points={[
            t("risk.method.score"),
            t("risk.method.rank"),
            t("risk.method.direction"),
            t("risk.method.excluded"),
            t("risk.method.cadence"),
            t("risk.method.notAdvice"),
          ]}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border border-border p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-semibold tabular-nums">{data.score.toFixed(0)}</span>
            <Badge variant={BAND_TONE[data.band]}>{t(`risk.bands.${data.band}`)}</Badge>
          </div>
          {asOfLabel && <span className="text-xs text-muted-foreground">{asOfLabel}</span>}
        </div>

        {/* The 0–100 track, with both thresholds marked. A score with no scale
            behind it is a number nobody can place. */}
        <div className="relative h-3 rounded-full bg-muted">
          <span
            className="absolute inset-y-0 rounded-full bg-primary"
            style={{ inlineSize: `${data.score}%` }}
          />
          {[data.bands.riskOffBelow, data.bands.riskOnAbove].map((threshold) => (
            <span
              key={threshold}
              aria-hidden
              className="absolute inset-y-0 w-px bg-foreground/40"
              style={{ insetInlineStart: `${threshold}%` }}
            />
          ))}
        </div>

        {/* Said plainly, every time: how many of the basket actually spoke. */}
        <p className="text-sm text-muted-foreground">
          {t("risk.reporting", {
            reported: data.reporting.reported,
            total: data.reporting.total,
          })}
          {data.reporting.excluded.length > 0 &&
            ` ${t("risk.excluded", { symbols: data.reporting.excluded.join(", ") })}`}
        </p>
      </div>

      {data.history.length > 1 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {t("risk.historyTitle", { days: data.history.length })}
          </h3>
          <div className="text-primary">
            <Sparkline points={data.history} />
          </div>
          <p className="text-xs text-muted-foreground">{t("risk.historyNote")}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("risk.componentsTitle")}</h3>
        <ul className="flex flex-col gap-2">
          {data.components.map((component) => (
            <li key={component.key} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-sm">{component.symbol}</span>
              <span className="relative h-2.5 flex-1 rounded-full bg-muted">
                <span
                  className="absolute inset-y-0 start-0 rounded-full bg-primary/70"
                  style={{ inlineSize: `${component.score}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-end text-xs tabular-nums">
                {component.score.toFixed(0)}
              </span>
              <span className="w-20 shrink-0 text-end text-xs text-muted-foreground">
                {t(`risk.directions.${component.direction}`)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Methodology
        points={[
          t("risk.method.score"),
          t("risk.method.rank"),
          t("risk.method.direction"),
          t("risk.method.excluded"),
          t("risk.method.cadence"),
          t("risk.method.notAdvice"),
        ]}
      />
    </div>
  );
}
