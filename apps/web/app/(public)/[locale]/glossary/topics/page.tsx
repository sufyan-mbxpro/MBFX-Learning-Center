import type { Metadata } from "next";
import { localizedPath } from "../../../../_lib/seo.ts";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronRight, Tag } from "lucide-react";
import { getGlossaryTopics } from "@repo/core";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { Section } from "@repo/ui/components/section";
import { GlossaryBackdrop } from "../_components/glossary-art.tsx";
import { GlossarySidebar } from "../_components/glossary-sidebar.tsx";
import {
  GLOSSARY_PATH,
  GLOSSARY_TOPICS_PATH,
  GlossaryTabs,
} from "../_components/glossary-tabs.tsx";
import { TopicCover } from "../_components/topic-cover.tsx";
import { INTERACTIVE_CARD } from "@repo/ui/lib/surfaces";

// Browse by topic (changes-11 Phase 10, D27).
//
// PR 4.5 left this deliberately absent, because a tab fed by
// `GlossaryTerm.category` free text would have rendered a raw identifier with
// no page behind it. `GlossaryTopic` is a real model now, so the tab has
// somewhere to go.
//
// A topic with no published terms is omitted by the loader, not filtered here —
// the same rule, in the same place, as an empty track band on `/learn`.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/glossary/topics">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations("glossary"),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("topicsTitle")),
    description: t("topicsIntro"),
    alternates: { canonical: localizedPath(locale, GLOSSARY_TOPICS_PATH) },
  };
}

export default async function GlossaryTopicsPage({
  params,
}: PageProps<"/[locale]/glossary/topics">) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!(await isFeatureVisible("glossary", null))) notFound();

  const [t, topics] = await Promise.all([getTranslations("glossary"), getGlossaryTopics(locale)]);

  return (
    <>
      {/* A masthead, not a muted strip with an h1 in it (changes-40). This is
          the second of the glossary's two browse surfaces and it sits in the
          header's own menus; opening on a band a third the height of /glossary
          made it read as a subsection of the A–Z rather than the other way
          into the same terms. `compact`, because the tabs and the first row of
          cards are what the reader came for and they belong above the fold.

          The picture is the owner's own piece for this page — the same file a
          coverless topic falls back to, so the index and the pages under it
          are recognisably one place (ADR-117's photo tone: `--secondary`, the
          photograph at full strength, the scrim carrying the contrast). */}
      <PageHero
        size="medium"
        backdrop={<GlossaryBackdrop slot="topicsBanner" priority />}
        motif={<AmbientMotif variant="learn" intensity={0.7} />}
        eyebrow={t("eyebrow")}
        title={t("topicsTitle")}
        lead={t("topicsIntro")}
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
          <div className="min-w-0">
            {topics.length === 0 ? (
              <Empty>
                <EmptyTitle>{t("topicsEmptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("topicsEmptyBody")}</EmptyDescription>
              </Empty>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {topics.map((topic) => (
                  <li key={topic.id} className="flex">
                    {/* The public site's one clickable-card recipe (changes-39):
                      `card-hover hover-lift sheen` on a `rounded-lg` ring
                      surface — the same four utilities and the same surface
                      `CourseCard`, `QuizCard` and `VideoCard` use, so every
                      index card on the site lifts, sweeps and tints alike. */}
                    <Link
                      href={`${ROUTE_PATHS.glossary}/topics/${topic.slug}`}
                      className={`${INTERACTIVE_CARD} flex h-full w-full flex-col overflow-hidden`}
                    >
                      {/* ADR-133 — the editor's cover, or the glossary's topic
                        artwork. Every card has the box, so a grid that mixes
                        the two stays one height. */}
                      <span className="relative block aspect-video w-full overflow-hidden bg-muted">
                        <TopicCover
                          coverUrl={topic.coverUrl}
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="media-zoom object-cover"
                        />
                      </span>
                      <span className="flex flex-1 flex-col gap-3 p-5">
                        <span className="flex items-start justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-3">
                            {/* Tint + `-interactive` ink is ADR-073's tonal
                              pairing, readable in both modes. */}
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive transition-colors duration-(--duration-base) group-hover:bg-primary group-hover:text-primary-foreground">
                              <Tag aria-hidden className="size-4.5" />
                            </span>
                            <span className="min-w-0 font-semibold transition-colors duration-(--duration-base) group-hover:text-primary-interactive">
                              {topic.name}
                            </span>
                          </span>
                          {/* Mirrored in RTL: a chevron pointing the wrong way
                            in Arabic reads as "back". */}
                          <ChevronRight
                            aria-hidden
                            className="hover-arrow mt-2 size-4 shrink-0 text-muted-foreground group-hover:text-primary-interactive rtl:rotate-180"
                          />
                        </span>
                        {topic.description && (
                          <span className="line-clamp-3 text-sm text-muted-foreground">
                            {topic.description}
                          </span>
                        )}
                        <span className="mt-auto pt-1">
                          <Badge variant="pill" className="text-xs tabular-nums">
                            {t("topicTermCount", { count: topic.termCount })}
                          </Badge>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <GlossarySidebar locale={locale} />
        </Container>
      </Section>
    </>
  );
}
