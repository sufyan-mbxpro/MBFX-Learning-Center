// "Browse by topic" — the category archive as a set of cards rather than as
// a list of links in a sidebar panel.
//
// The sidebar keeps its own compact list; this band is for the reader who
// arrived at the section front without a story in mind, which the sidebar
// (below the fold on a phone, beside the grid on a desktop) serves badly.
// Same destinations, same counts, same single `getArticleFacets` read — no
// second source of truth, so the two can never disagree.
//
// Categories are DATA (ADR-042: content is dynamic, design is code), so
// nothing here is keyed to a particular category. The accent rotates by
// POSITION, which means a new category added in the admin gets a colour
// without a code change, and no category is hard-coded to one.
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { ArticleFacetTerm } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { cn } from "@repo/ui/lib/utils";

import { NewsBackdrop } from "./news-art.tsx";

// Semantic tokens only, and the ink is always the `-interactive` derivation
// — ADR-018 rule 5: these are small text and thin rules, which is exactly
// what raw --primary is not for.
const ACCENT = [
  { bar: "bg-primary", ink: "text-primary-interactive", wash: "bg-primary/10" },
  { bar: "bg-info", ink: "text-info-interactive", wash: "bg-info/10" },
  { bar: "bg-success", ink: "text-success-interactive", wash: "bg-success/10" },
  { bar: "bg-warning", ink: "text-warning-interactive", wash: "bg-warning/10" },
] as const;

export async function NewsTopics({ categories }: { categories: ArticleFacetTerm[] }) {
  const t = await getTranslations("news");

  // A section with one topic is not a way to browse, it is a mislabelled
  // link. Two is the floor at which "browse by topic" is a true statement.
  const shown = categories.filter((category) => category.count > 0);
  if (shown.length < 2) return null;

  return (
    // `id` is the masthead's second action target. On the section, not on the
    // heading: an in-page jump should land above the band, not with its top
    // rule already scrolled past.
    <Section id="topics" tone="muted" spacing="lg" className="relative isolate overflow-hidden">
      {/* The backdrop is its own layer rather than a class on Section:
          Section composes its tone through `cn` (tailwind-merge), so a
          background passed in className REPLACES `bg-muted/40` instead of
          layering over it — the trap PageHero's header comment records. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14]">
        <NewsBackdrop slot="topics" />
      </div>

      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading eyebrow={t("topicsEyebrow")} title={t("topicsTitle")} lead={t("topicsLead")} />

        <Reveal variant="up">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((category, index) => {
              const accent = ACCENT[index % ACCENT.length]!;
              return (
                <li key={category.id}>
                  {/* The whole card IS the link here, unlike an article card:
                      a topic tile has exactly one destination and no nested
                      targets, so there is nothing for a second link to
                      compete with. `group` on the link is what makes the
                      arrow and the rule respond. */}
                  <Link
                    href={`/news/category/${category.slug}`}
                    className="group block h-full focus-visible:outline-none"
                  >
                    <article className="card-hover hover-lift sheen relative isolate flex h-full flex-col gap-3 overflow-hidden rounded-2xl bg-card p-5 ring-1 ring-foreground/10 group-hover:ring-primary/25 group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
                      <span
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute top-0 start-0 z-20 h-1 w-10 transition-[width] duration-(--duration-slow) ease-(--ease-out-quint) group-hover:w-full",
                          accent.bar,
                        )}
                      />

                      <span
                        className={cn(
                          "inline-flex w-fit items-center rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums",
                          accent.wash,
                          accent.ink,
                        )}
                      >
                        {t("topicsCount", { count: category.count })}
                      </span>

                      <h3 className="text-lg leading-snug font-semibold text-balance transition-colors group-hover:text-primary-interactive">
                        {category.name}
                      </h3>

                      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary-interactive">
                        {t("topicsCta")}
                        <ArrowRight aria-hidden className="hover-arrow size-4 rtl:rotate-180" />
                      </span>
                    </article>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}
