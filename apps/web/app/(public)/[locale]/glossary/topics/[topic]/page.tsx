import type { Metadata } from "next";
import { alternatesFor, descriptionFrom } from "../../../../../_lib/seo.ts";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { getGlossaryTopicBySlug, getGlossaryTopics } from "@repo/core";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { routing } from "@repo/i18n/routing";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { Section } from "@repo/ui/components/section";
import {
  GLOSSARY_PATH,
  GLOSSARY_TOPICS_PATH,
  GlossaryTabs,
} from "../../_components/glossary-tabs.tsx";
import { TopicCover } from "../../_components/topic-cover.tsx";
import { GlossarySidebar } from "../../_components/glossary-sidebar.tsx";
import { INTERACTIVE_CARD, CHIP_LINK } from "@repo/ui/lib/surfaces";

// One topic and its terms (changes-11 Phase 10, D27).
//
// The terms are listed alphabetically by the loader, not by an editor's
// ordering: a topic page is a reference list, and a reader scanning it is
// looking for a word.
/** The term page's prose treatment, reused verbatim so the two cannot drift. */
const PROSE_CLASS =
  "flex flex-col gap-3 text-lg leading-relaxed text-pretty text-muted-foreground [&_a]:text-primary-interactive [&_a]:underline-offset-4 [&_a:hover]:underline [&_ol]:list-decimal [&_ol]:ps-5 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:ps-5";

function topicPath(locale: string, slug: string): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${prefix}${ROUTE_PATHS.glossary}/topics/${slug}`;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/glossary/topics/[topic]">): Promise<Metadata> {
  const { locale, topic: slug } = await params;
  setRequestLocale(locale);
  const [view, template] = await Promise.all([
    getGlossaryTopicBySlug(locale, slug),
    getSetting("seo.titleTemplate"),
  ]);
  if (!view) return {};

  // Every locale this topic actually HAS a translation in — not every active
  // locale. An hreflang pointing at a URL that 404s is worse than a missing
  // pair, the same rule the course and lesson pages follow.
  return {
    title: (template ?? "%s").replace("%s", view.seoTitle ?? view.name),
    ...descriptionFrom(view.seoDescription, view.description),
    alternates: await alternatesFor({
      canonical: topicPath(locale, view.slug),
      languages: view.alternates.map((alt) => ({
        locale: alt.locale,
        href: topicPath(alt.locale, alt.slug),
      })),
    }),
  };
}

export default async function GlossaryTopicPage({
  params,
}: PageProps<"/[locale]/glossary/topics/[topic]">) {
  const { locale, topic: slug } = await params;
  setRequestLocale(locale);

  if (!(await isFeatureVisible("glossary", null))) notFound();

  const view = await getGlossaryTopicBySlug(locale, slug);
  if (!view) notFound();

  const t = await getTranslations("glossary");

  // Every other topic, for the closing block. Fetched here rather than in a
  // component so the page stays one cached read tree; `getGlossaryTopics`
  // already omits topics with no published terms, so this cannot offer a link
  // to an empty page.
  const siblings = (await getGlossaryTopics(locale)).filter((topic) => topic.id !== view.id);

  return (
    <>
      {/* The term page's masthead (changes-39): a compact `PageHero` whose
          backdrop is the topic's own cover (ADR-133), or the glossary's topic
          artwork when it has none. The counted strip that used to close this
          band is gone — "Browse by topic 16" repeated the tab below it and a
          number the cards already say. */}
      <PageHero
        size="compact"
        backdrop={<TopicCover coverUrl={view.coverUrl} sizes="100vw" priority />}
        motif={<AmbientMotif variant="learn" intensity={0.7} />}
        breadcrumb={
          // On the `photo` tone the band is `--secondary`, so the trail rides
          // on `--secondary-foreground` (ADR-117), as on the term page.
          <nav aria-label={t("breadcrumbLabel")} className="min-w-0">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-secondary-foreground/70">
              <li className="flex items-center gap-1.5">
                <Link
                  href={ROUTE_PATHS.glossary}
                  className="transition-colors duration-(--duration-base) hover:text-secondary-foreground"
                >
                  {t("title")}
                </Link>
                <ChevronRight aria-hidden className="size-3.5 shrink-0 rtl:rotate-180" />
              </li>
              <li className="flex items-center gap-1.5">
                <Link
                  href={`${ROUTE_PATHS.glossary}/topics`}
                  className="transition-colors duration-(--duration-base) hover:text-secondary-foreground"
                >
                  {t("browseTopics")}
                </Link>
                <ChevronRight aria-hidden className="size-3.5 shrink-0 rtl:rotate-180" />
              </li>
              {/* Named, NOT linked — a last crumb that links to itself is a
                  control that does nothing. */}
              <li className="min-w-0">
                <span
                  aria-current="page"
                  className="truncate font-medium text-secondary-foreground"
                >
                  {view.name}
                </span>
              </li>
            </ol>
          </nav>
        }
        title={view.name}
      />

      <GlossaryTabs
        ariaLabel={t("browseLabel")}
        items={[
          { href: GLOSSARY_PATH, label: t("browseAtoZ") },
          { href: GLOSSARY_TOPICS_PATH, label: t("browseTopics") },
        ]}
      />

      <Section spacing="md">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-(--grid-main-aside) lg:items-start">
          <div className="flex min-w-0 flex-col gap-10">
            {/* Rich text since changes-18 PR 3, rendered as prose — the ONE
              surface that does. It moved out of the masthead because the hero's
              lead is a single `<p>`, and markup cannot sit inside one.
              Sanitized server-side on save (security.md #8). */}
            {view.descriptionHtml && (
              <div
                className={`${PROSE_CLASS} max-w-3xl`}
                dangerouslySetInnerHTML={{ __html: view.descriptionHtml }}
              />
            )}

            {/* Cards rather than a divided list: the owner asked for the topic's
              terms to read as cards with real hover, and a term with a
              definition under it is a card's worth of content. `card-hover` is
              the design system's own treatment, the same one the topics index
              uses, so the two pages match. */}
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {view.terms.map((term) => (
                <li key={term.termId}>
                  <Link
                    href={`${ROUTE_PATHS.glossary}/${term.slug}`}
                    className={`${INTERACTIVE_CARD} flex h-full flex-col gap-2 p-5`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-semibold transition-colors duration-(--duration-base) group-hover:text-primary-interactive">
                        {term.term}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="hover-arrow mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-primary-interactive rtl:rotate-180"
                      />
                    </span>
                    {term.definition && (
                      <span className="line-clamp-3 text-sm text-muted-foreground">
                        {term.definition}
                      </span>
                    )}
                    {/* "clearly show the category exists" — every card says which
                      topic it belongs to, so a term arriving here from search
                      carries its filing with it. */}
                    <span className="mt-auto pt-2">
                      <Badge variant="outline">{view.name}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Related topics. Not a recommender — the sibling list, ordered by
              the editor's own `sortOrder`, which is the `ArchiveTaxonomy`
              pattern from /news rather than a second thing to maintain. */}
            {siblings.length > 0 && (
              <section className="flex flex-col gap-4 border-t pt-8">
                <h2 className="text-xl font-semibold tracking-tight">{t("topicsTitle")}</h2>
                <ul className="flex flex-wrap gap-2">
                  {siblings.map((topic) => (
                    <li key={topic.id}>
                      <Link
                        href={`${ROUTE_PATHS.glossary}/topics/${topic.slug}`}
                        className={CHIP_LINK}
                      >
                        {topic.name}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {topic.termCount}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <GlossarySidebar locale={locale} />
        </Container>
      </Section>
    </>
  );
}
