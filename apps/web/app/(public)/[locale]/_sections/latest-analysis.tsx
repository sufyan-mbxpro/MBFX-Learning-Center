// Latest analysis (changes-03-plan.md §6.2). Item count and grid variant
// are admin-set on the home.sections descriptor; the content itself comes
// from the same cached read the /analysis listing uses.
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { getPublishedArticles } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { isFeatureVisible } from "@repo/settings";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { ArticleCards } from "../news/_components/article-list.tsx";
import type { SectionProps } from "./registry.ts";

export async function LatestAnalysis({ locale, variant = "standard", limit }: SectionProps) {
  // Disabled features render nothing here; the /analysis ROUTE 404s
  // separately (public-site SKILL.md: disabled features 404, never blank).
  if (!(await isFeatureVisible("analysis", null))) return null;

  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getPublishedArticles(locale, {
      kinds: ["ANALYSIS", "TRADE_IDEA"],
      page: 0,
      perPage: limit ?? 3,
    }),
  ]);
  if (result.entries.length === 0) return null;

  return (
    <Section spacing="md">
      <Container className="flex flex-col gap-(--section-gap)">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow={t("latestAnalysisEyebrow")} title={t("latestAnalysis")} />
          <Button variant="ghost" render={<Link href="/analysis" />}>
            {t("latestAnalysisAll")}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
        </div>
        <Reveal variant="up">
          <ArticleCards entries={result.entries} locale={locale} variant={variant} />
        </Reveal>
      </Container>
    </Section>
  );
}
