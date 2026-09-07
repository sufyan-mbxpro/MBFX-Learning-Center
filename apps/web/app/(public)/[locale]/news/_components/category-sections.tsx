// The news front, by section — one band per category, each carrying that
// category's newest stories.
//
// This is the newspaper reading the owner asked for: the general latest feed
// at the top, then "Market News", "Central Banks", "Technical Analysis" as
// their own blocks, so a reader who only follows one of them can find it
// without paging through everything else.
//
// Which categories appear, in what order, is DATA — `sortOrder` on the
// category, resolved by `getCategoryDigests`. What the band looks like is
// code (ADR-042). A category earns a band by having enough articles in it;
// that floor lives in the service, so this component renders what it is given
// and never second-guesses it.
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { CategoryDigest } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { cn } from "@repo/ui/lib/utils";

import { ArticleCards } from "./article-list.tsx";

export async function CategorySections({
  digests,
  locale,
  showAuthor,
}: {
  digests: CategoryDigest[];
  locale: string;
  showAuthor: boolean;
}) {
  const t = await getTranslations("news");
  if (digests.length === 0) return null;

  return (
    <>
      {digests.map((digest, index) => (
        <Section
          key={digest.category.id}
          spacing="md"
          // Alternating surfaces: with four bands in a row, an unbroken run of
          // one tone turns the whole lower page into a single scroll with
          // headings floating in it. The alternation starts on `default` so
          // the first band never abuts the muted listing above it.
          tone={index % 2 === 0 ? "default" : "muted"}
        >
          <Container className="flex flex-col gap-6">
            {/* Heading row rather than `SectionHeading`: these are section
                headers inside a page whose h2s are already spoken for by the
                page's own bands, and each carries a "view all" that belongs
                on the same line as the name it qualifies. */}
            <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl leading-tight font-semibold text-balance md:text-3xl">
                  <Link
                    href={`/news/category/${digest.category.slug}`}
                    className="link-underline transition-colors hover:text-primary-interactive"
                  >
                    {digest.category.name}
                  </Link>
                </h2>
                <Badge variant="pill">{t("topicsCount", { count: digest.category.count })}</Badge>
              </div>

              <Link
                href={`/news/category/${digest.category.slug}`}
                className={cn(
                  "group inline-flex items-center gap-1.5 text-sm font-medium text-primary-interactive",
                  "transition-opacity hover:opacity-80",
                )}
              >
                {t("categoryViewAll")}
                <ArrowRight aria-hidden className="hover-arrow size-4 rtl:rotate-180" />
              </Link>
            </div>

            <Reveal variant="up">
              <ArticleCards
                entries={digest.entries}
                locale={locale}
                variant="standard"
                showAuthor={showAuthor}
              />
            </Reveal>
          </Container>
        </Section>
      ))}
    </>
  );
}
