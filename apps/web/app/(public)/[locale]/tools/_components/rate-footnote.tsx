"use client";

// "As of", in words (ADR-087 #11, ADR-088 #7).
//
// **A rate says when it is from**, and **no copy anywhere in this area says
// "real-time" or "live"** — the numbers move once per daily sweep, and a
// disclaimer does not repair a word that was false.
//
// Every surface showing a figure derived from a rate renders this. It is one
// component rather than a line in each island precisely so that "we forgot the
// as-of on the converter" cannot happen.
//
// ─── The stale WARNING is gone (changes-40) ──────────────────────────────
//
// It read "Rates as of <date> — out of date, and shown for reference only",
// under a warning triangle, on every rate-backed tool. With the seeded MANUAL
// provider that is the NORMAL state of a fresh install, and a page whose every
// figure is prefaced by an alarm reads as broken rather than as careful. The
// owner asked for it gone.
//
// What is NOT gone is the date. ADR-088 #7's actual requirement is that a
// figure says when it is from, and the neutral sentence says exactly that: a
// reader who sees Tuesday's date on a Thursday knows what they have. Only the
// editorial judgement on top of it — "out of date", "for reference only" — was
// removed. `snapshot.stale` still travels from the service and is still what
// picks the glyph, so restoring the sentence is one branch here.
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, Clock } from "lucide-react";
import { DATE_FORMAT_OPTIONS } from "@repo/utils";

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

  const asOf = format.dateTime(new Date(snapshot.asOf), DATE_FORMAT_OPTIONS);

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock aria-hidden className="size-3.5" />
      {t("common.asOf", { date: asOf })}
    </p>
  );
}
