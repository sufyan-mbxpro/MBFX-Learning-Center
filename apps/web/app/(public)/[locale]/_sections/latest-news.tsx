// Latest news — `latest-analysis.tsx`'s sibling for every variant but one,
// and deliberately built the same way: the same cached read the /news listing
// uses, the same `ArticleCards` renderer, the same feature gate.
//
// The one thing that differs is the KIND filter. `latest_analysis` asks for
// ANALYSIS + TRADE_IDEA; this asks for NEWS. Keeping the two readable apart is
// what lets the homepage show "what happened" and "what we make of it" as two
// distinct promises rather than one undifferentiated feed — which is the whole
// reason `ArticleKind` exists as an enum instead of a tag.
//
// ─── `desk` reads BOTH kinds (ADR-116 §2, reshaped by ADR-121 §1) ─────────
//
// ADR-116 drew the desk as a lead story beside a 2x2 analysis panel. The owner
// asked for every card on it to be the platform band's size, picture first,
// and for the band to be shorter (changes-37). So it is now ONE row of the
// same `standard` cards `/news` draws, four seats split between the two feeds
// by `deskEntries`. The two promises stay distinguishable the way a listing
// already distinguishes them — each card carries its KIND chip — and each
// keeps its own call to action in the heading row.
//
// `latest_analysis` keeps its component and every one of its variants and is
// seeded off on the HOME PAGE only. /analysis is untouched.
//
// changes-39 (owner): the row of four cards became the /news "Top stories"
// shape — a lead story beside a numbered rail — through the same
// `SpotlightGrid` /news draws, so the two cannot drift apart. The seats and
// the per-feed calls to action are unchanged.
//
// If nothing is published at all the section renders nothing. An empty "Latest
// news" heading is worse than no heading: it says the desk has stopped rather
// than that it has not started.
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { getPublishedArticles } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { cn } from "@repo/ui/lib/utils";
import { ArticleCards } from "../news/_components/article-list.tsx";
import { SpotlightGrid } from "../news/_components/news-spotlight.tsx";
import { DESK_SEATS, deskEntries } from "./desk-entries.ts";
import type { SectionProps } from "./registry.ts";

export async function LatestNews({ locale, variant = "split", limit }: SectionProps) {
  const isDesk = variant === "desk";

  // Both flags, because `desk` draws both kinds. A flag off does not make the
  // band vanish here — it makes that FEED vanish and the other one takes its
  // seats, which is the per-dataset degradation ADR-116 §3 asks for. The /news
  // and /analysis ROUTES 404 separately (public-site SKILL.md: disabled
  // features 404, never blank).
  const [newsVisible, analysisVisible] = await Promise.all([
    isFeatureVisible("news", null),
    isDesk ? isFeatureVisible("analysis", null) : Promise.resolve(false),
  ]);
  if (!newsVisible && !analysisVisible) return null;

  const [t, showAuthor, newsResult, analysisResult] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    isDesk ? getSetting("articles.showAuthor") : Promise.resolve(false),
    newsVisible
      ? getPublishedArticles(locale, {
          kinds: ["NEWS"],
          page: 0,
          // `desk` asks each feed for the whole row, so either can fill it
          // alone on a day the other is empty. `split` needs one lead plus a
          // short rail beside it, and five fills that column to roughly the
          // lead card's height.
          perPage: isDesk ? DESK_SEATS : (limit ?? 5),
        })
      : null,
    analysisVisible
      ? getPublishedArticles(locale, {
          kinds: ["ANALYSIS", "TRADE_IDEA"],
          page: 0,
          perPage: DESK_SEATS,
        })
      : null,
  ]);

  const news = newsResult?.entries ?? [];
  const analysis = analysisResult?.entries ?? [];
  if (news.length === 0 && analysis.length === 0) return null;

  if (isDesk) {
    const entries = deskEntries(news, analysis);

    return (
      // `sm`: every band pays its padding twice — its own bottom plus the next
      // band's top — and the owner asked for this one shorter twice.
      <Section spacing="sm">
        <Container className="flex flex-col gap-(--section-gap)">
          {/* The platform band's header: the heading at the inline start, the
              calls to action on the same baseline at the end. One per feed that
              is actually on the row — a "All analysis" button over a row with
              no analysis in it promises something the band did not show. */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow={t("deskEyebrow")} title={t("deskTitle")} />
            <div className="flex flex-wrap gap-2">
              {news.length > 0 && (
                <Button variant="outline" render={<Link href="/news" />}>
                  {t("deskNewsAll")}
                  <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
                </Button>
              )}
              {analysis.length > 0 && (
                <Button variant="outline" render={<Link href="/analysis" />}>
                  {t("deskAnalysisAll")}
                  <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
                </Button>
              )}
            </div>
          </div>

          {/* The /news "Top stories" shape (changes-39, owner): one lead story
              beside a numbered rail, rather than a row of four equal cards.
              Three in the rail, not /news's two, so the rail ends near the
              lead's bottom edge instead of leaving a tall empty column beside
              it. The lead is the newest news story when there is one —
              `deskEntries` puts news first. */}
          <SpotlightGrid
            entries={entries}
            locale={locale}
            showAuthor={showAuthor !== false}
            runnerCount={DESK_SEATS - 1}
            // The rail's bottom edge meets the lead's (owner, 2026-09-17):
            // the grid row is as tall as the taller column and the three
            // cards share it, so neither side overhangs the other.
            alignRail
          />
        </Container>
      </Section>
    );
  }

  // ── Every other variant: news only, exactly as before ────────────────────
  if (news.length === 0) return null;

  // `split` is the pre-changes-35 homepage layout: one lead article at half
  // width, the rest as a compact list beside it. The other three variants pass
  // straight through to ArticleCards, so the section can still be laid out as
  // a plain grid without a code change.
  const [lead, ...rest] = news;
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
              className={cn(
                "grid grid-cols-1 items-start gap-6",
                rest.length > 0 && "lg:grid-cols-2 lg:gap-8",
              )}
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
            <ArticleCards entries={news} locale={locale} variant={variant} />
          )}
        </Reveal>
      </Container>
    </Section>
  );
}
