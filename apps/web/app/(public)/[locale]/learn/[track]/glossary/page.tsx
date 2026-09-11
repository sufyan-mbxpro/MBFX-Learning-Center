import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpen } from "lucide-react";
import { getPublishedGlossary } from "@repo/core";
import { isLearnTrack, learnTrackGlossaryPath, LEARN_TRACKS, ROUTE_PATHS } from "@repo/contracts";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Link } from "@repo/i18n/navigation";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { GlossaryBrowser } from "../../../glossary/_components/glossary-browser.tsx";

// One school's glossary — `/learn/forex/glossary` (ADR-065 §2).
//
// **This is a VIEW, not a second glossary.** Terms keep their own URLs at
// `/glossary/<term>`; nothing moved, and `GlossaryBrowser` links to exactly
// the same pages the global A–Z does. What this page adds is the filter a
// learner mid-lesson actually wants: the vocabulary of the school they are in,
// under the same pinned bar as its courses and quizzes.
//
// A term with a NULL track is in every school's view (ADR-065 §3). That is
// what null means here — "leverage" is forex and crypto both, and duplicating
// it per track would give one concept two pages competing in search.
//
// The whole set arrives from `getPublishedGlossary`, the same cached,
// `content`-tagged loader `/glossary` uses, and is narrowed in memory. One
// cache entry for the glossary, three pages reading it.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn/[track]/glossary">): Promise<Metadata> {
  const { locale, track } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) return {};

  const [t, learn, template] = await Promise.all([
    getTranslations({ locale, namespace: "glossary" }),
    getTranslations({ locale, namespace: "learn" }),
    getSetting("seo.titleTemplate"),
  ]);
  const title = `${learn(LEARN_TRACKS[track].titleKey)} — ${t("title")}`;
  return {
    title: (template ?? "%s").replace("%s", title),
    description: t("intro"),
    alternates: { canonical: learnTrackGlossaryPath(track) },
  };
}

export default async function TrackGlossaryPage({
  params,
}: PageProps<"/[locale]/learn/[track]/glossary">) {
  const { locale, track } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) notFound();

  // The glossary flag, not the courses one: this page is the glossary wearing
  // the Learn area's chrome, and switching the glossary off must take it with
  // it — which is also why the section bar drops the tab (ADR-055 §7).
  if (!(await isFeatureVisible("glossary", null))) notFound();

  const [t, learn, entries] = await Promise.all([
    getTranslations({ locale, namespace: "glossary" }),
    getTranslations({ locale, namespace: "learn" }),
    getPublishedGlossary(locale),
  ]);

  const mine = entries.filter((entry) => entry.track === null || entry.track === track);

  return (
    <>
      <Section spacing="sm" tone="muted" className="relative isolate overflow-hidden">
        <AmbientMotif variant="learn" />
        <Container>
          <Reveal variant="up">
            <header className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-primary-interactive">
                {learn(LEARN_TRACKS[track].titleKey)}
              </p>
              <h1 className="text-display-sm font-semibold tracking-tight">{t("title")}</h1>
              <p className="text-muted-foreground">{t("intro")}</p>
            </header>
          </Reveal>
        </Container>
      </Section>

      <Section spacing="md">
        <Container className="flex flex-col gap-6">
          {mine.length === 0 ? (
            <Empty>
              <EmptyMedia>
                <BookOpen aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("empty")}</EmptyTitle>
              <EmptyDescription>{t("intro")}</EmptyDescription>
            </Empty>
          ) : (
            <GlossaryBrowser
              entries={mine.map((entry) => ({
                termId: entry.termId,
                term: entry.term,
                slug: entry.slug,
                simpleExplanation: entry.simpleExplanation,
              }))}
              locale={locale}
            />
          )}

          {/* The way back to everything. A track view is a subset by design,
              so the page says so rather than leaving a reader to wonder why a
              term they know is missing. */}
          <p className="text-sm text-muted-foreground">
            <Button variant="link" size="sm" render={<Link href={ROUTE_PATHS.glossary} />}>
              {t("browseAtoZ")}
            </Button>
          </p>
        </Container>
      </Section>
    </>
  );
}
