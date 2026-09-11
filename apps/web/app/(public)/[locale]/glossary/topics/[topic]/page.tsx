import type { Metadata } from "next";
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
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import {
  GLOSSARY_PATH,
  GLOSSARY_TOPICS_PATH,
  GlossaryTabs,
} from "../../_components/glossary-tabs.tsx";

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
  const languages = Object.fromEntries(
    view.alternates.map((alt) => [alt.locale, topicPath(alt.locale, alt.slug)]),
  );

  return {
    title: (template ?? "%s").replace("%s", view.seoTitle ?? view.name),
    description: view.seoDescription ?? view.description ?? undefined,
    alternates: { canonical: topicPath(locale, view.slug), languages },
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
      {/* The masthead the design pass gave `/glossary` and `/learn`, applied to
          the page the owner actually landed on. Generated ambient art rather
          than a stock photograph (ADR-047 §3's system) — a topic has no cover
          column and is never getting one. */}
      <Section spacing="sm" tone="muted" className="relative isolate overflow-hidden">
        <AmbientMotif variant="learn" />
        <Container>
          <Reveal variant="up">
            <div className="flex flex-col gap-3">
              <nav
                aria-label={t("breadcrumbLabel")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Link
                  href={ROUTE_PATHS.glossary}
                  className="transition-colors duration-(--duration-base) hover:text-foreground"
                >
                  {t("title")}
                </Link>
                <ChevronRight aria-hidden className="size-3.5 shrink-0 rtl:rotate-180" />
                <Link
                  href={`${ROUTE_PATHS.glossary}/topics`}
                  className="transition-colors duration-(--duration-base) hover:text-foreground"
                >
                  {t("browseTopics")}
                </Link>
                {/* The current page is named but NOT linked — a breadcrumb
                    whose last crumb links to itself gives a reader a control
                    that does nothing. `ArchiveTaxonomy` on /news draws the
                    same line. */}
                <ChevronRight aria-hidden className="size-3.5 shrink-0 rtl:rotate-180" />
                <span aria-current="page" className="text-foreground">
                  {view.name}
                </span>
              </nav>

              <h1 className="text-display-sm font-semibold tracking-tight text-balance">
                {view.name}
              </h1>

              {/* Rich text since changes-18 PR 3, and rendered as prose here —
                  the ONE surface that does. Everywhere else reads the
                  flattened `description`. Sanitized server-side on save
                  (security.md #8); this renders already-clean HTML. */}
              {view.descriptionHtml && (
                <div
                  className={PROSE_CLASS}
                  dangerouslySetInnerHTML={{ __html: view.descriptionHtml }}
                />
              )}

              {/* The counted strip `/glossary` and `/learn` both open with. One
                  number, because a topic only has one worth stating. */}
              <dl className="flex flex-wrap gap-x-8 gap-y-2 pt-1">
                <div className="flex flex-col">
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                    {t("browseTopics")}
                  </dt>
                  <dd className="text-2xl font-semibold tabular-nums">{view.termCount}</dd>
                </div>
              </dl>
            </div>
          </Reveal>
        </Container>
      </Section>

      <GlossaryTabs
        ariaLabel={t("browseLabel")}
        current={GLOSSARY_TOPICS_PATH}
        items={[
          { href: GLOSSARY_PATH, label: t("browseAtoZ") },
          { href: GLOSSARY_TOPICS_PATH, label: t("browseTopics") },
        ]}
      />

      <Section spacing="md">
        <Container className="flex flex-col gap-10">
          {/* Cards rather than a divided list: the owner asked for the topic's
              terms to read as cards with real hover, and a term with a
              definition under it is a card's worth of content. `card-hover` is
              the design system's own treatment, the same one the topics index
              uses, so the two pages match. */}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.terms.map((term) => (
              <li key={term.termId}>
                <Link
                  href={`${ROUTE_PATHS.glossary}/${term.slug}`}
                  className="card-hover flex h-full flex-col gap-2 rounded-xl border bg-card p-5 transition-colors duration-(--duration-base) hover:border-primary/25"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{term.term}</span>
                    <ChevronRight
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground rtl:rotate-180"
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
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-(--duration-base) hover:border-primary/25 hover:bg-muted/60"
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
        </Container>
      </Section>
    </>
  );
}
