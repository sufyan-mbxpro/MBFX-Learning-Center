import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpen } from "lucide-react";
import { getPublishedGlossary } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Container } from "@repo/ui/components/container";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/glossary">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations("glossary"),
    getSetting("seo.titleTemplate"),
  ]);
  return { title: (template ?? "%s").replace("%s", t("title")) };
}

export default async function GlossaryPage({ params }: PageProps<"/[locale]/glossary">) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Disabled feature → 404, not a blank page (plan.md Module 12 test).
  if (!(await isFeatureVisible("glossary", null))) notFound();

  const [t, entries] = await Promise.all([
    getTranslations("glossary"),
    getPublishedGlossary(locale),
  ]);

  const byLetter = new Map<string, typeof entries>();
  for (const entry of entries) {
    const letter = entry.term[0]?.toLocaleUpperCase(locale) ?? "#";
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), entry]);
  }

  return (
    <>
      {/* `relative isolate overflow-hidden` is what `AmbientMotif` needs to
          anchor to, be clipped by, and not escape from — Section provides
          none of the three on its own. `learn` is the arrangement: the
          glossary is the teaching surface of the site, so the field is
          books and compasses with a little market vocabulary, not a
          trading floor. */}
      <Section spacing="sm" tone="muted" className="relative isolate overflow-hidden">
        <AmbientMotif variant="learn" />
        <Container>
          <Reveal variant="up">
            <header className="flex flex-col gap-1.5">
              <h1 className="text-display-sm font-semibold tracking-tight">{t("title")}</h1>
              <p className="text-muted-foreground">{t("intro")}</p>
            </header>
          </Reveal>
        </Container>
      </Section>

      <Section spacing="md">
        <Container className="flex flex-col gap-8">
          {entries.length === 0 && (
            <Empty>
              <EmptyMedia>
                <BookOpen aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("empty")}</EmptyTitle>
              <EmptyDescription>{t("intro")}</EmptyDescription>
            </Empty>
          )}

          {byLetter.size > 1 && (
            <nav
              aria-label={t("title")}
              className="sticky top-(--height-header) z-10 -mx-1 flex flex-wrap gap-1 bg-background/90 px-1 py-2 backdrop-blur-sm"
            >
              {[...byLetter.keys()].map((letter) => (
                <a
                  key={letter}
                  href={`#glossary-${letter}`}
                  className="flex size-7 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-[background-color,color,transform] duration-(--duration-fast) hover:scale-110 hover:bg-primary/10 hover:text-primary-interactive"
                >
                  {letter}
                </a>
              ))}
            </nav>
          )}

          {[...byLetter.entries()].map(([letter, letterEntries], index) => (
            <Reveal key={letter} variant="up" delay={Math.min(index, 4) * 40}>
              <section id={`glossary-${letter}`} className="flex flex-col gap-2">
                <h2 className="border-b pb-1 text-xl font-semibold">{letter}</h2>
                <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {letterEntries.map((entry) => (
                    <li key={entry.termId}>
                      <Link
                        href={`/glossary/${entry.slug}`}
                        className="link-underline inline-flex items-center rounded-md px-1.5 py-1 text-primary-interactive transition-colors duration-(--duration-fast) hover:bg-primary/5"
                      >
                        {entry.term}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ))}
        </Container>
      </Section>
    </>
  );
}
