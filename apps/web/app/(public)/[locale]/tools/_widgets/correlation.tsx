"use client";

// Currency correlation (changes-25 T8, ADR-088 §1–§3).
//
// **Colour is never the only channel.** Every cell prints its coefficient as
// well as tinting; a reader with a colour vision deficiency, or one reading a
// printout, gets the same information. The bar behind the number encodes
// magnitude, and the sign decides the hue.
//
// **A cell below the minimum sample renders "—", not a number.** That decision
// is made in `correlationMatrix` (ADR-088 #3), so this component only reads it
// — the two cannot end up disagreeing about what "enough data" means.
//
// The matrix scrolls inside its own container: nine instruments square is
// wider than a phone, and pushing the page sideways is the alternative.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@repo/ui/lib/utils";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Methodology } from "../_components/methodology.tsx";
import { ToolCombobox } from "../_components/tool-combobox.tsx";

export interface CorrelationInstrument {
  id: string;
  symbol: string;
  displayName: string;
}

export interface CorrelationData {
  window: string;
  instruments: CorrelationInstrument[];
  matrix: Record<string, Record<string, number | null>>;
  excluded: CorrelationInstrument[];
  asOf: string | null;
}

/** Sign decides the hue; magnitude decides the weight. */
function cellTone(value: number | null): string {
  if (value === null) return "text-muted-foreground";
  const strong = Math.abs(value) >= 0.6;
  if (value > 0) return strong ? "text-success font-semibold" : "text-success";
  if (value < 0) return strong ? "text-destructive-interactive font-semibold" : "text-destructive-interactive";
  return "text-muted-foreground";
}

export function CorrelationWidget({
  data,
  windows,
  onWindowChange,
  asOfLabel,
}: {
  data: CorrelationData;
  windows: string[];
  /** A navigation, not a fetch — the window is a URL param on a cached page. */
  onWindowChange: (window: string) => void;
  asOfLabel: string | null;
}) {
  const t = useTranslations("tools");
  const [window, setWindow] = useState(data.window);

  const change = (next: string) => {
    setWindow(next);
    onWindowChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field className="w-40">
          <FieldLabel>{t("correlation.window")}</FieldLabel>
          <ToolCombobox
            value={window}
            onValueChange={change}
            options={windows.map((value) => ({
              value,
              label: t(`correlation.windows.${value}`),
            }))}
          />
        </Field>
        {asOfLabel && <p className="text-xs text-muted-foreground">{asOfLabel}</p>}
      </div>

      {data.instruments.length === 0 ? (
        <Alert variant="info">
          <AlertDescription>{t("correlation.empty")}</AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <caption className="sr-only">{t("correlation.caption", { window })}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 text-start font-medium">
                  {t("correlation.pair")}
                </th>
                {data.instruments.map((instrument) => (
                  <th key={instrument.id} scope="col" className="py-2 text-end font-medium">
                    {instrument.symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.instruments.map((row) => (
                <tr key={row.id} className="border-b border-border/50 last:border-0">
                  <th scope="row" className="py-1.5 text-start font-normal">
                    {row.symbol}
                  </th>
                  {data.instruments.map((column) => {
                    const value = data.matrix[row.id]?.[column.id] ?? null;
                    return (
                      <td
                        key={column.id}
                        className={cn("py-1.5 text-end tabular-nums", cellTone(value))}
                      >
                        {/* The NUMBER, always. Colour is a second channel, not
                            the only one (ADR-088's readability, and axe's). */}
                        {value === null ? "—" : value.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Named, not silently dropped: "we could not read gold" is a sentence a
          reader can act on, and an instrument vanishing from a grid is not. */}
      {data.excluded.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("correlation.excluded", {
            symbols: data.excluded.map((i) => i.symbol).join(", "),
          })}
        </p>
      )}

      <Methodology
        points={[
          t("correlation.method.statistic"),
          t("correlation.method.returns"),
          t("correlation.method.minimum"),
          t("correlation.method.cadence"),
          t("correlation.method.notAdvice"),
        ]}
      />
    </div>
  );
}
