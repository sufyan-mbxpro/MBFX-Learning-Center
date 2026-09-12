"use client";

// "As of", in words (ADR-087 #11, ADR-088 #7).
//
// **A stale rate is labelled, never hidden**, and **no copy anywhere in this
// area says "real-time" or "live"** — the numbers move once per daily sweep,
// and a disclaimer does not repair a word that was false.
//
// Every surface showing a figure derived from a rate renders this. It is one
// component rather than a line in each island precisely so that "we forgot the
// as-of on the converter" cannot happen.
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, Clock } from "lucide-react";

export interface RateSnapshotView {
  base: string;
  rates: Record<string, number>;
  asOf: string | null;
  stale: boolean;
  reporting: { reported: number; total: number };
}

export function RateFootnote({ snapshot }: { snapshot: RateSnapshotView | null }) {
  const t = useTranslations("tools");
  const format = useFormatter();

  if (!snapshot || snapshot.asOf === null) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle aria-hidden className="size-3.5" />
        {t("common.noRates")}
      </p>
    );
  }

  const asOf = format.dateTime(new Date(snapshot.asOf), { dateStyle: "medium" });

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {snapshot.stale ? (
        <AlertTriangle aria-hidden className="size-3.5" />
      ) : (
        <Clock aria-hidden className="size-3.5" />
      )}
      {snapshot.stale ? t("common.staleAsOf", { date: asOf }) : t("common.asOf", { date: asOf })}
    </p>
  );
}
