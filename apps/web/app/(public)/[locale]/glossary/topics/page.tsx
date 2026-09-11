import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { getGlossaryTopics } from "@repo/core";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
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
        current={GLOSSARY_TOPICS_PATH}
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
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => (
                <li key={topic.id}>
                  <Link
                    href={`${ROUTE_PATHS.glossary}/topics/${topic.slug}`}
                    className="card-hover flex h-full flex-col gap-2 rounded-xl border bg-card p-5 transition-colors duration-(--duration-base) hover:border-primary/25"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{topic.name}</span>
                      {/* The reference's chevron. Mirrored in RTL, because a
                          chevron that points the wrong way in Arabic reads as
                          "back". */}
                      <ChevronRight
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
                      />
                    </span>
                    {topic.description && (
                      <span className="line-clamp-3 text-sm text-muted-foreground">
                        {topic.description}
                      </span>
                    )}
                    <span className="mt-auto pt-2 text-xs text-muted-foreground tabular-nums">
                      {t("topicTermCount", { count: topic.termCount })}
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
