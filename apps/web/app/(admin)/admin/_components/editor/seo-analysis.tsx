"use client";

// The "SEO Analysis" panel, one shape on every module (changes-46 #3, the
// owner's image-109): two stat cards (reading time, content length), one
// tinted card per concern with a verdict and a reason, then a tips card.
//
// The verdicts come from `@repo/utils`'s pure `seoReport`, which returns ids,
// reasons and numbers; every sentence lives in `admin.seoAnalysis.*`
// (code-style.md #2). The panel labels itself through `useTranslations` — the
// admin root layout mounts the client provider — so no host has to thread
// forty strings through its page for a panel that is the same everywhere.
//
// Colour is theme tokens only, and status is never colour alone: every card
// carries its glyph AND its words. Nothing here blocks a save; the report is
// advice (changes-07-plan §9 risk 5).
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, CircleX, Clock, FileText, Lightbulb } from "lucide-react";
import { parseKeywords, seoReport, type SeoRecommendation, type SeoTone } from "@repo/utils";
import { cn } from "@repo/ui/lib/utils";

const TONE_CLASS: Record<SeoTone, string> = {
  success: "border-success/30 bg-success/10 text-success-interactive",
  warning: "border-warning/30 bg-warning/10 text-warning-interactive",
  error: "border-destructive/30 bg-destructive/10 text-destructive-interactive",
};

const TONE_ICON: Record<SeoTone, typeof Check> = {
  success: Check,
  warning: AlertTriangle,
  error: CircleX,
};

const TIPS = ["keywords", "headings", "links", "images", "paragraphs"] as const;

export function SeoAnalysis({
  title,
  description,
  body,
  focusKeywords,
}: {
  title: string;
  description: string;
  /** The prose the page is about — HTML, stripped before counting. */
  body: string;
  /** Comma-separated; the FIRST is the focus keyword. */
  focusKeywords: string;
}) {
  const t = useTranslations("admin.seoAnalysis");
  const report = useMemo(
    () => seoReport({ title, description, body, keywords: parseKeywords(focusKeywords) }),
    [title, description, body, focusKeywords],
  );

  const message = (rec: SeoRecommendation) => {
    if (rec.missing) {
      const places = rec.missing.map((place) => t(`places.${place}`)).join(", ");
      return t(`messages.${rec.id}.${rec.reason}` as "messages.title.optimal", { places });
    }
    return t(`messages.${rec.id}.${rec.reason}` as "messages.title.optimal", rec.values);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-lg bg-muted p-4">
          <p className="flex items-center gap-2 text-base font-semibold">
            <Clock aria-hidden className="size-4 text-muted-foreground" />
            {t("readingTime")}
          </p>
          <p className="text-2xl font-bold tabular-nums">
            {t("minutes", { count: report.readingMinutes })}
          </p>
          <p className="text-sm text-muted-foreground">{t("words", { count: report.words })}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg bg-muted p-4">
          <p className="flex items-center gap-2 text-base font-semibold">
            <FileText aria-hidden className="size-4 text-muted-foreground" />
            {t("contentLength")}
          </p>
          <p className="text-2xl font-bold tabular-nums">{report.words}</p>
          <p className="text-sm text-muted-foreground">{t(`verdict.${report.lengthVerdict}`)}</p>
        </div>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="seo-recommendations">
        <h3 id="seo-recommendations" className="text-sm font-semibold">
          {t("recommendations")}
        </h3>
        <ul className="flex flex-col gap-2.5">
          {report.recommendations.map((rec) => {
            const Icon = TONE_ICON[rec.tone];
            return (
              <li
                key={rec.id}
                data-tone={rec.tone}
                className={cn("flex flex-col gap-1 rounded-lg border p-3", TONE_CLASS[rec.tone])}
              >
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Icon aria-hidden className="size-4 shrink-0" />
                  {t(`titles.${rec.id}`)}
                  <span className="sr-only">— {t(`tones.${rec.tone}`)}</span>
                </p>
                <p className="ps-6 text-sm">{message(rec)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-info/30 bg-info/10 p-4 text-info-interactive">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Lightbulb aria-hidden className="size-4" />
          {t("tipsTitle")}
        </h3>
        <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
          {TIPS.map((tip) => (
            <li key={tip}>{t(`tips.${tip}`)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
