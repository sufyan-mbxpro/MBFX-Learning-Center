import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpen } from "lucide-react";
import {
  getGlossaryTopics,
  getPublishedGlossary,
  getTermOfTheDay,
  getTopicOfTheDay,
} from "@repo/core";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Section } from "@repo/ui/components/section";
import { GlossaryBrowser } from "./_components/glossary-browser.tsx";
import { GlossaryMasthead } from "./_components/glossary-masthead.tsx";
import { GLOSSARY_PATH, GLOSSARY_TOPICS_PATH, GlossaryTabs } from "./_components/glossary-tabs.tsx";
import { TermOfTheDay } from "./_components/term-of-the-day.tsx";
import { TopicOfTheDay } from "./_components/topic-of-the-day.tsx";

// The glossary A–Z (changes-11 PR 4.5; design pass ADR-069).
//
// D26's chip bar (anchors, empty letters disabled), a client-side search over
// the already-loaded set, the inline `simpleExplanation` §9.5 asks for, and
// D29's deterministic term of the day. None of that changed here — the
// browser below is byte-for-byte the component it was.
//
// What ADR-069 added is the masthead the section front had never had, the
// counted stat strip, and the **Topic of the day** card that
// `term-of-the-day.tsx` explicitly deferred until topics were a real model.
// Both featured cards are ABSENT rather than empty when their loader returns
// nothing, so a database with no terms or no topics renders a shorter page
// rather than a card with a hole in it.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/glossary">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations("glossary"),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("title")),
    description: t("intro"),
    alternates: { canonical: GLOSSARY_PATH },
  };
}

/** The A–Z initial, matching `GlossaryBrowser`'s own rule so the counted
 * letters and the rendered sections cannot disagree. */
function initialOf(term: string, locale: string): string {
  const first = term[0]?.toLocaleUpperCase(locale) ?? "#";
  return /^[A-Z]$/.test(first) ? first : "#";
}

export default async function GlossaryPage({ params }: PageProps<"/[locale]/glossary">) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Disabled feature → 404, not a blank page (plan.md Module 12 test).
  if (!(await isFeatureVisible("glossary", null))) notFound();

  const [t, entries, featuredTerm, featuredTopic, topics] = await Promise.all([
    getTranslations("glossary"),
    getPublishedGlossary(locale),
    getTermOfTheDay(locale),
    getTopicOfTheDay(locale),
    getGlossaryTopics(locale),
  ]);

  const stats = {
    terms: entries.length,
    topics: topics.length,
    letters: new Set(entries.map((entry) => initialOf(entry.term, locale))).size,
  };

  return (
    <>
      <GlossaryMasthead
        stats={stats}
        featured={
          featuredTerm || featuredTopic ? (
            <>
              {featuredTerm && (
                <TermOfTheDay
                  term={featuredTerm.term}
                  slug={featuredTerm.slug}
                  explanation={featuredTerm.simpleExplanation}
                  labels={{ eyebrow: t("termOfTheDay"), readMore: t("readMore") }}
                />
              )}
              {featuredTopic && (
                <TopicOfTheDay
                  name={featuredTopic.name}
                  slug={featuredTopic.slug}
                  description={featuredTopic.description}
                  labels={{
                    eyebrow: t("topicOfTheDay"),
                    explore: t("startExploring"),
                    count: t("topicTermCount", { count: featuredTopic.termCount }),
                  }}
                />
              )}
            </>
          ) : undefined
        }
      />

      {/* Absent until at least one topic has published terms — GlossaryTabs
          hides a strip of one, so a database with no topics looks exactly as
          it did before Phase 10. */}
      <GlossaryTabs
        ariaLabel={t("browseLabel")}
        current={GLOSSARY_PATH}
        items={
          topics.length === 0
            ? []
            : [
                { href: GLOSSARY_PATH, label: t("browseAtoZ") },
                { href: GLOSSARY_TOPICS_PATH, label: t("browseTopics") },
              ]
        }
      />

      <Section spacing="md">
        {/* The masthead's action anchors here. On the section rather than on
            the browser, so the jump lands above the search field rather than
            scrolling it under the sticky chip bar. */}
        <Container id="glossary-browse" className="scroll-mt-(--height-header)">
          {entries.length === 0 ? (
            <Empty>
              <EmptyMedia>
                <BookOpen aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("empty")}</EmptyTitle>
              <EmptyDescription>{t("intro")}</EmptyDescription>
            </Empty>
          ) : (
            <GlossaryBrowser
              entries={entries.map((entry) => ({
                termId: entry.termId,
                term: entry.term,
                slug: entry.slug,
                simpleExplanation: entry.simpleExplanation,
              }))}
              locale={locale}
            />
          )}
        </Container>
      </Section>
    </>
  );
}
