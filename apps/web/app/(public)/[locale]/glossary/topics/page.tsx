import type { Metadata } from "next";
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
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import {
  GLOSSARY_PATH,
  GLOSSARY_TOPICS_PATH,
  GlossaryTabs,
} from "../_components/glossary-tabs.tsx";

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
    alternates: { canonical: GLOSSARY_TOPICS_PATH },
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
      <Section spacing="sm" tone="muted" className="relative isolate overflow-hidden">
        <AmbientMotif variant="learn" />
        <Container>
          <Reveal variant="up">
            <header className="flex flex-col gap-1.5">
              <h1 className="text-display-sm font-semibold tracking-tight">{t("topicsTitle")}</h1>
              <p className="max-w-2xl text-muted-foreground">{t("topicsIntro")}</p>
            </header>
          </Reveal>
        </Container>
      </Section>

      <GlossaryTabs
        ariaLabel={t("browseLabel")}
        items={[
          { href: GLOSSARY_PATH, label: t("browseAtoZ") },
          { href: GLOSSARY_TOPICS_PATH, label: t("browseTopics") },
        ]}
      />

      <Section spacing="md">
        <Container>
          {topics.length === 0 ? (
            <Empty>
              <EmptyTitle>{t("topicsEmptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("topicsEmptyBody")}</EmptyDescription>
            </Empty>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => (
                <li key={topic.id} className="flex">
                  {/* The design system's full hover vocabulary (changes-22).
                      It was `card-hover` and a border tint — correct, and
                      nearly imperceptible: the card did not move, nothing
                      inside it responded, and the chevron that promises a
                      destination sat still. Now it lifts, sweeps, tints its
                      ring, and the mark and the chevron both answer. Each of
                      these is an existing utility, not a new effect: `sheen`,
                      `hover-lift`, `card-hover` and `hover-arrow` are the same
                      four `CourseCard` and `QuizCard` already use, so the
                      glossary stops being the one index that feels dead. */}
                  <Link
                    href={`${ROUTE_PATHS.glossary}/topics/${topic.slug}`}
                    className="group card-hover hover-lift sheen flex h-full w-full flex-col gap-3 rounded-xl border bg-card p-5 ring-1 ring-transparent hover:border-primary/30 hover:ring-primary/15"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-3">
                        {/* A tinted mark, so a wall of text cards has
                            something to scan by. Tint + `-interactive` ink is
                            ADR-073's tonal pairing, the one combination the
                            engine derives readable in both modes. */}
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive transition-colors duration-(--duration-base) group-hover:bg-primary group-hover:text-primary-foreground">
                          <Tag aria-hidden className="size-4.5" />
                        </span>
                        <span className="min-w-0 font-semibold transition-colors duration-(--duration-base) group-hover:text-primary-interactive">
                          {topic.name}
                        </span>
                      </span>
                      {/* The reference's chevron. Mirrored in RTL, because a
                          chevron that points the wrong way in Arabic reads as
                          "back". */}
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
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </Section>
    </>
  );
}
