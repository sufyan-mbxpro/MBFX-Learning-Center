// Latest news — `latest-analysis.tsx`'s sibling, and deliberately built the
// same way: the same cached read the /news listing uses, the same
// `ArticleCards` renderer, the same feature gate.
//
// The one thing that differs is the KIND filter. `latest_analysis` asks for
// ANALYSIS + TRADE_IDEA; this asks for NEWS. Splitting them is what lets the
// homepage show "what happened" and "what we make of it" as two distinct
// promises rather than one undifferentiated feed — which is the whole reason
// `ArticleKind` exists as an enum instead of a tag.
//
// If nothing is published under NEWS the section renders nothing at all. An
// empty "Latest news" heading is worse than no heading: it says the desk has
// stopped rather than that it has not started.
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
import { cn } from "@repo/ui/lib/utils";
import { ArticleCards } from "../news/_components/article-list.tsx";
import type { SectionProps } from "./registry.ts";

export async function LatestNews({ locale, variant = "split", limit }: SectionProps) {
  // Disabled features render nothing here; the /news ROUTE 404s separately
  // (public-site SKILL.md: disabled features 404, never blank).
  if (!(await isFeatureVisible("news", null))) return null;

  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getPublishedArticles(locale, {
      kinds: ["NEWS"],
      page: 0,
      // One lead plus a short rail beside it. Five is what fills the right
      // column to roughly the height of the lead card without scrolling it.
      perPage: limit ?? 5,
    }),
  ]);
  if (result.entries.length === 0) return null;

  // `split` is the homepage layout: one lead article at half width, the rest
  // as a compact list beside it. The other three variants stay available and
  // pass straight through to ArticleCards, so the section can still be laid
  // out as a plain grid without a code change.
  const [lead, ...rest] = result.entries;
  const isSplit = variant === "split";

  return (
    <Section spacing="md">
      <Container className="flex flex-col gap-(--section-gap)">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow={t("latestNewsEyebrow")}
            title={t("latestNews")}
            lead={t("latestNewsLead")}
          />
          <Button variant="ghost" render={<Link href="/news" />}>
            {t("latestNewsAll")}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
        </div>
        {/*
          `showKind` stays OFF throughout, unlike the /news listing. Every card
          in this section is the same kind by construction, so a row of
          identical "News" chips would be pure noise — the heading said it.
        */}
        <Reveal variant="up">
          {isSplit && lead ? (
            // Half and half. `items-start` matters: without it the right
            // column stretches to the lead card's height and its last item
            // floats away from the rest of the list.
            //
            // A single-article day collapses to just the lead at full width
            // rather than a half-empty grid with a hole beside it — which is
            // why the right column is conditional rather than always present.
            <div
              className={cn("grid items-start gap-6", rest.length > 0 && "lg:grid-cols-2 lg:gap-8")}
            >
              <ArticleCards entries={[lead]} locale={locale} variant="featured" />
              {rest.length > 0 && (
                // `compact` carries a 5rem square thumbnail rather than a
                // full cover (see article-list), which is what makes this
                // read as a listing beside the lead rather than a second,
                // smaller grid of cards competing with it for attention.
                <ArticleCards entries={rest} locale={locale} variant="compact" />
              )}
            </div>
          ) : (
            <ArticleCards entries={result.entries} locale={locale} variant={variant} />
          )}
        </Reveal>
      </Container>
    </Section>
  );
}
