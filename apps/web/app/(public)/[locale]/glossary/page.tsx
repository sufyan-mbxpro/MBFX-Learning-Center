import type { Metadata } from "next";
import { localizedPath, titleTemplate, titleFrom } from "../../../_lib/seo.ts";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpen } from "lucide-react";
import {
  getGlossaryTopics,
  getPublishedGlossary,
  getTermOfTheDay,
  getTopicOfTheDay,
} from "@repo/core";
import { isFeatureVisible } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Section } from "@repo/ui/components/section";
import { GlossaryBrowser } from "./_components/glossary-browser.tsx";
import { GlossaryMasthead } from "./_components/glossary-masthead.tsx";
import { GlossarySidebar } from "./_components/glossary-sidebar.tsx";
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
// What ADR-069 added is the masthead the section front had never had (its
// counted stat strip was removed by ADR-076 §3), and the **Topic of the day** card that
// `term-of-the-day.tsx` explicitly deferred until topics were a real model.
// Both featured cards are ABSENT rather than empty when their loader returns
// nothing, so a database with no terms or no topics renders a shorter page
// rather than a card with a hole in it.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/glossary">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([getTranslations("glossary"), titleTemplate()]);
  return {
    title: titleFrom(template, t("title")),
    description: t("intro"),
    alternates: { canonical: localizedPath(locale, GLOSSARY_PATH) },
  };
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

  return (
    <>
      <GlossaryMasthead
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
        <Container
          id="glossary-browse"
          // The reading rail (changes-40). `grid-cols-1` until `lg`, so on a
          // phone the A–Z keeps the full width and the rail follows it —
          // which is the right order: someone who came to look a word up
          // should reach the word before the reading suggestions.
          className="grid grid-cols-1 gap-10 scroll-mt-(--height-header) lg:grid-cols-(--grid-main-aside) lg:items-start"
        >
          <div className="min-w-0">
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
          </div>
          <GlossarySidebar locale={locale} />
        </Container>
      </Section>
    </>
  );
}
