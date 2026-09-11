"use client";

// The reference editor's "SEO Analysis" tab (changes-07 §1.2). Rule ids come
// from `@repo/utils`'s pure `seoChecks`; the WORDING lives in the catalogs
// (code-style.md #2), which is why the helper returns ids and not sentences.

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { parseKeywords, seoChecks, seoScore, type SeoCheckId } from "@repo/utils";
import { Progress } from "@repo/ui/components/progress";

export interface SeoAnalysisLabels {
  score: string;
  checks: Record<SeoCheckId, string>;
}

export function SeoAnalysis({
  title,
  description,
  body,
  focusKeywords,
  labels,
}: {
  title: string;
  description: string;
  body: string;
  focusKeywords: string;
  labels: SeoAnalysisLabels;
}) {
  const checks = useMemo(
    () =>
      seoChecks({
        title,
        description,
        body,
        keywords: parseKeywords(focusKeywords),
      }),
    [title, description, body, focusKeywords],
  );
  const score = seoScore(checks);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{labels.score}</span>
        <Progress value={score} className="flex-1" />
        <span className="text-sm font-semibold tabular-nums">{score}%</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 text-sm">
            {check.passed ? (
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-interactive" />
            ) : (
              <X aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <span className={check.passed ? "" : "text-muted-foreground"}>
              {labels.checks[check.id]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
