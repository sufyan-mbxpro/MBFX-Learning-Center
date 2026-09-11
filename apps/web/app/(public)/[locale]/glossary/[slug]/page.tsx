import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getGlossaryTermBySlug,
  getPopularGlossaryTerms,
  getRedirect,
  getRelatedGlossaryTerms,
  glossaryTermPath,
} from "@repo/core";
import { ROUTE_PATHS } from "@repo/contracts";
import { LOCALE_DIRECTION, routing } from "@repo/i18n/routing";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { GlossaryBackdrop } from "../_components/glossary-art.tsx";
import { GlossaryFooterSearch } from "../_components/glossary-footer-search.tsx";

// One glossary term (design pass ADR-069).
//
// It was a bare `<main>` with a back-link, an `h1` and one body div — the only
// public page in the section that had never had a presentation pass. It now
// carries what the reference screen carries: a breadcrumb inside a masthead,
// the term's topic and difficulty as badges, the FOUR prose fields the editor
// writes, its FAQ, and a closing block with the A–Z rail and a Popular-terms
// list so a reader who looked up one term can look up the next.
//
// The prose sections are ABSENT when empty, never rendered as an empty
// heading: three of the four fields are optional and most terms will carry
// one or two.

/** The tone a difficulty reads in — `learn-labels.ts`'s rule, one section over. */
const DIFFICULTY_TONE: Record<string, "success" | "warning" | "info"> = {
  BEGINNER: "success",
  INTERMEDIATE: "info",
  ADVANCED: "warning",
};

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/glossary/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [view, template] = await Promise.all([
    getGlossaryTermBySlug(locale, slug),
    getSetting("seo.titleTemplate"),
  ]);
  if (!view) return {};

  // hreflang alternates: every locale that actually has a translation.
  const languages = Object.fromEntries(
    view.alternates.map((alt) => [
      alt.locale,
      glossaryTermPath(alt.locale, routing.defaultLocale, alt.slug),
    ]),
  );

  return {
    title: (template ?? "%s").replace("%s", view.seoTitle ?? view.term),
    description: view.seoDescription ?? undefined,
    alternates: { languages },
  };
}

/** The shared prose treatment — one place, so the four bodies cannot drift. */
const PROSE_CLASS =
  "flex flex-col gap-4 leading-relaxed [&_a]:text-primary-interactive [&_a]:underline-offset-4 [&_a:hover]:underline [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-semibold [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:ps-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted/40 [&_th]:p-2 [&_th]:text-start [&_ul]:list-disc [&_ul]:ps-5";

/**
 * One prose section, absent when its body is empty.
 *
 * Sanitized SERVER-SIDE ON SAVE (ADR-009 / security.md #8) — this renders
 * already-clean HTML; the save path is the boundary.
 */
function ProseSection({ heading, html }: { heading: string; html: string | null }) {
  if (!html || html.trim() === "") return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
      <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

export default async function GlossaryTermPage({ params }: PageProps<"/[locale]/glossary/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  if (!(await isFeatureVisible("glossary", null))) notFound();

  const view = await getGlossaryTermBySlug(locale, slug);

  if (!view) {
    // Old slug? content.ts wrote a 301 row when it changed.
    const target = await getRedirect(glossaryTermPath(locale, routing.defaultLocale, slug));
    if (target) permanentRedirect(target);
    notFound();
  }

  // Loaded only after the term resolves — two wasted queries on a 404 otherwise.
  const [t, notTranslated, popular, related] = await Promise.all([
    getTranslations("glossary"),
    // Its own public namespace since ADR-007 — reused rather than duplicated
    // into glossary.*, so the notice reads identically on every surface.
    getTranslations("notTranslated"),
    getPopularGlossaryTerms(locale),
    getRelatedGlossaryTerms(locale, view.termId),
  ]);

  return (
    <>
      <PageHero
        backdrop={<GlossaryBackdrop slot="termBanner" priority />}
        motif={<AmbientMotif variant="learn" intensity={0.7} />}
        breadcrumb={
          // A real `<nav>` with an ordered list, and the current page marked
          // `aria-current` and NOT linked — a breadcrumb whose last crumb
          // links to the page you are on is a control that does nothing.
          // The ink is the caller's job on a filled band (PageHero's rule).
          <nav aria-label={t("breadcrumbLabel")} className="min-w-0">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-primary-foreground/70">
              <li className="flex items-center gap-1.5">
                <Link
                  href={ROUTE_PATHS.glossary}
                  className="transition-colors duration-(--duration-base) hover:text-primary-foreground"
                >
                  {t("title")}
                </Link>
                {/* `rtl:rotate-180`: the separator points along the reading
                    direction, not rightwards (code-style.md #3). */}
                <span aria-hidden className="rtl:rotate-180">
                  /
                </span>
              </li>
              <li className="min-w-0">
                <span aria-current="page" className="truncate font-medium text-primary-foreground">
                  {view.term}
                </span>
              </li>
            </ol>
          </nav>
        }
        eyebrow={view.topicName ?? t("termEyebrow")}
        title={t("termHeading", { term: view.term })}
      />

      <Section spacing="md">
        {/* `size="narrow"` — NOT a max-w-* utility. `container.tsx` warns that
            an arbitrary max-width utility loses to `.container-page`'s own
            max-width at equal specificity, so the measure would silently stay
            full width and the prose would run past a comfortable line length. */}
        <Container size="narrow" className="flex flex-col gap-8">
          {view.requestedLocaleMissing ? (
            // ADR-007: an RTL locale with no translation gets the notice in
            // its own direction — never LTR English content inside this layout.
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="font-medium">{notTranslated("title")}</p>
              <p className="text-sm text-muted-foreground">{notTranslated("body")}</p>
            </div>
          ) : (
            <>
              <Reveal variant="up">
                <div className="flex flex-wrap items-center gap-2">
                  {view.topicName && view.topicSlug && (
                    <Badge
                      variant="outline"
                      render={<Link href={`${ROUTE_PATHS.glossary}/topics/${view.topicSlug}`} />}
                    >
                      {view.topicName}
                    </Badge>
                  )}
                  <Badge variant={DIFFICULTY_TONE[view.difficulty] ?? "info"}>
                    {t(`difficulty.${view.difficulty}` as "difficulty.BEGINNER")}
                  </Badge>
                  {view.locale !== locale &&
                    LOCALE_DIRECTION[locale as keyof typeof LOCALE_DIRECTION] === "ltr" && (
                      <span className="text-xs text-muted-foreground">({view.locale})</span>
                    )}
                </div>
              </Reveal>

              <Reveal variant="up" delay={80}>
                <div className="flex flex-col gap-8">
                  <div
                    className={PROSE_CLASS}
                    dangerouslySetInnerHTML={{ __html: view.simpleExplanation }}
                  />

                  <ProseSection heading={t("detailedHeading")} html={view.detailedExplanation} />
                  <ProseSection heading={t("advancedHeading")} html={view.advancedExplanation} />
                  <ProseSection heading={t("exampleHeading")} html={view.exampleScenario} />

                  {/* A formula is plain text read character by character, so
                      it keeps `font-mono` — the same narrow exception the
                      admin's formula field takes (ADR-044 #6). */}
                  {view.formula && (
                    <section className="flex flex-col gap-3">
                      <h2 className="text-2xl font-semibold tracking-tight">
                        {t("formulaHeading")}
                      </h2>
                      <p className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm">
                        {view.formula}
                      </p>
                    </section>
                  )}

                  {view.faq.length > 0 && (
                    <section className="flex flex-col gap-3">
                      <h2 className="text-2xl font-semibold tracking-tight">{t("faqHeading")}</h2>
                      <dl className="flex flex-col gap-4">
                        {view.faq.map((item) => (
                          <div key={item.question} className="flex flex-col gap-1.5">
                            <dt className="font-medium">{item.question}</dt>
                            {/* Text, not HTML: the FAQ answer is a plain
                                textarea in the editor and is stored unparsed. */}
                            <dd className="whitespace-pre-wrap text-muted-foreground">
                              {item.answer}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  )}
                </div>
              </Reveal>
            </>
          )}

          {related.length > 0 && (
            <section className="flex flex-col gap-3 border-t pt-6">
              <h2 className="text-lg font-semibold">{t("relatedTerms")}</h2>
              <ul className="flex flex-wrap gap-2">
                {related.map((entry) => (
                  <li key={entry.termId}>
                    <Link
                      href={`${ROUTE_PATHS.glossary}/${entry.slug}`}
                      className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm transition-colors duration-(--duration-fast) hover:border-primary/30 hover:bg-primary/10 hover:text-primary-interactive"
                    >
                      {entry.term}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </Container>
      </Section>

      <Section spacing="md" tone="muted">
        <Container>
          <GlossaryFooterSearch
            popular={popular}
            labels={{
              title: t("searchTitle"),
              lead: t("searchLead"),
              alphabetLabel: t("alphabetLabel"),
              popularTerms: t("popularTerms"),
            }}
          />
        </Container>
      </Section>
    </>
  );
}
