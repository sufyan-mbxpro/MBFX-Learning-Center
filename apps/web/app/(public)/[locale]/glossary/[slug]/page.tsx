import type { Metadata } from "next";
import { siteUrl } from "../../../../_lib/site-url.ts";
import { BreadcrumbJsonLd } from "../../_components/breadcrumb-json-ld.tsx";
import {
  alternatesFor,
  descriptionFrom,
  jsonLd,
  localizedPath,
  shareMetadata,
  titleTemplate,
  titleFrom,
  siteName,
} from "../../../../_lib/seo.ts";
import Image from "next/image";
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
import { htmlLead } from "@repo/utils";
import { getServableLocales } from "@repo/i18n";
import { LOCALE_DIRECTION, routing } from "@repo/i18n/routing";
import { Link } from "@repo/i18n/navigation";
import { isFeatureVisible } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { FaqPanel } from "@repo/ui/components/faq-panel";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { Waypoints } from "lucide-react";
import { GlossaryBackdrop } from "../_components/glossary-art.tsx";
import { GlossaryFooterSearch } from "../_components/glossary-footer-search.tsx";
import { GlossarySidebar } from "../_components/glossary-sidebar.tsx";
import { ReadingLanguageMenu } from "../../_components/reading-language-menu.tsx";
import { canOptimizeImage } from "../../_lib/image-optimizer.ts";
import { readingLanguageOptions, readingLocaleFrom } from "../../_lib/reading-language.ts";
import { CHIP_LINK } from "@repo/ui/lib/surfaces";

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
  searchParams,
}: PageProps<"/[locale]/glossary/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const readingLocale = readingLocaleFrom(await searchParams);
  const [view, template, brand] = await Promise.all([
    getGlossaryTermBySlug(locale, slug, readingLocale),
    titleTemplate(),
    siteName(),
  ]);
  if (!view) return {};

  const canonical = glossaryTermPath(locale, routing.defaultLocale, slug);
  const shareTitle = view.seoTitle?.trim() || view.term;
  // The LEAD, never the whole body: since changes-46 `simpleExplanation` is
  // the term's entire rich article, and a description is a snippet.
  const lead = htmlLead(view.simpleExplanation, 160);
  const shareDescription = view.seoDescription?.trim() || lead;

  return {
    title: titleFrom(template, shareTitle),
    // The plain-language line when no SEO description was written: most terms
    // never get one, and a term page with no meta description at all hands the
    // snippet to whatever the crawler picks.
    ...descriptionFrom(view.seoDescription, lead),
    // ADR-127 #4: a `?lang=` reading view is never indexed, and its canonical
    // is the term's own URL — which is every view's canonical.
    alternates: await alternatesFor({
      canonical,
      languages: view.alternates.map((alt) => ({
        locale: alt.locale,
        href: glossaryTermPath(alt.locale, routing.defaultLocale, alt.slug),
      })),
    }),
    ...(view.readingLocale ? { robots: { index: false, follow: true } } : {}),
    // changes-46 SEO check: the term page had no share card of its own, so
    // Open Graph fell through to the root layout's — no `og:url`, and a title
    // carrying the site template the other content pages leave off. The
    // card now names the term, its URL and its own words (the site's default
    // image, since a term has no picture).
    ...(await shareMetadata({
      locale,
      siteName: brand,
      url: canonical,
      title: shareTitle,
      description: shareDescription,
    })),
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
function ProseSection({
  heading,
  html,
  lang,
  dir,
}: {
  heading: string;
  html: string | null;
  /** The translation's, not the page's: the heading is interface, the body is not (ADR-127 #1). */
  lang: string;
  dir: "ltr" | "rtl";
}) {
  if (!html || html.trim() === "") return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
      <div
        lang={lang}
        dir={dir}
        className={PROSE_CLASS}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

export default async function GlossaryTermPage({
  params,
  searchParams,
}: PageProps<"/[locale]/glossary/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  if (!(await isFeatureVisible("glossary", null))) notFound();

  const readingLocale = readingLocaleFrom(await searchParams);
  const view = await getGlossaryTermBySlug(locale, slug, readingLocale);

  if (!view) {
    // Old slug? content.ts wrote a 301 row when it changed.
    const target = await getRedirect(glossaryTermPath(locale, routing.defaultLocale, slug));
    if (target) permanentRedirect(target);
    notFound();
  }

  // Loaded only after the term resolves — two wasted queries on a 404 otherwise.
  const [t, notTranslated, tPublic, servableLocales, popular, related] = await Promise.all([
    getTranslations("glossary"),
    // Its own public namespace since ADR-007 — reused rather than duplicated
    // into glossary.*, so the notice reads identically on every surface.
    getTranslations("notTranslated"),
    getTranslations("public"),
    getServableLocales(),
    getPopularGlossaryTerms(locale),
    getRelatedGlossaryTerms(locale, view.termId),
  ]);

  // ADR-127: the term's own words (name, explanations, FAQ) only.
  const readingOptions = readingLanguageOptions({
    languages: view.readingLanguages,
    contentLocale: view.contentLocale,
    interfaceLocale: locale,
    servable: servableLocales,
    currentPath: `${ROUTE_PATHS.glossary}/${view.slug}`,
    pathFor: (language) => `${ROUTE_PATHS.glossary}/${language.slug}`,
  });

  // `DefinedTerm` inside the site glossary's `DefinedTermSet`: the term, its
  // plain-language line and its own URL — all things the page prints.
  const origin = siteUrl();
  const termGraph = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: view.term,
    url: `${origin}${glossaryTermPath(locale, routing.defaultLocale, view.slug)}`,
    inLanguage: view.contentLocale,
    ...(htmlLead(view.simpleExplanation) ? { description: htmlLead(view.simpleExplanation) } : {}),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: t("title"),
      url: `${origin}${localizedPath(locale, ROUTE_PATHS.glossary)}`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(termGraph) }} />
      <BreadcrumbJsonLd
        locale={locale}
        crumbs={[{ label: t("title"), href: ROUTE_PATHS.glossary }, { label: view.term }]}
      />
      <PageHero
        // Shorter than the default masthead (changes-22). `PageHero` is built
        // for a SECTION front — About's five pages, /news, /learn — where a
        // tall band is the first thing on the site and has a job to do. A
        // glossary term is a leaf: the reader arrived to read two paragraphs,
        // and at `section-lg` the band pushed the definition itself below the
        // fold on a laptop. `compact` matches `/glossary/topics`, which is the
        // shape the owner pointed at. The fill is no longer the brand
        // gradient — a `backdrop` selects the `photo` tone (ADR-117) — but
        // that was never what was wrong here; the height was.
        size="compact"
        backdrop={<GlossaryBackdrop slot="termBanner" priority />}
        motif={<AmbientMotif variant="learn" intensity={0.7} />}
        breadcrumb={
          // A real `<nav>` with an ordered list, and the current page marked
          // `aria-current` and NOT linked — a breadcrumb whose last crumb
          // links to the page you are on is a control that does nothing.
          // The ink is the caller's job on a filled band (PageHero's rule),
          // and on the `photo` tone that band is `--secondary` — so the trail
          // rides on `--secondary-foreground`, the pair ADR-003 derives
          // readable on it, not on `--primary-foreground`, which is derived
          // against a fill that is no longer there (ADR-117).
          <nav aria-label={t("breadcrumbLabel")} className="min-w-0">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-secondary-foreground/70">
              <li className="flex items-center gap-1.5">
                <Link
                  href={ROUTE_PATHS.glossary}
                  className="transition-colors duration-(--duration-base) hover:text-secondary-foreground"
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
                <span
                  aria-current="page"
                  className="truncate font-medium text-secondary-foreground"
                >
                  {view.term}
                </span>
              </li>
            </ol>
          </nav>
        }
        eyebrow={view.topicName ?? t("termEyebrow")}
        // The term is the TRANSLATION's word inside the interface's sentence,
        // so it alone carries the translation's `lang`/`dir` (ADR-127 #1).
        title={t.rich("termHeading", {
          term: view.term,
          word: (chunks) => (
            <span lang={view.contentLocale} dir={view.contentDirection}>
              {chunks}
            </span>
          ),
        })}
      />

      <Section spacing="md">
        {/* The prose keeps the narrow measure and gains a rail (changes-40).
            NOT a `max-w-*` utility on the Container — `container.tsx` warns
            that one loses to `.container-page`'s own max-width at equal
            specificity, so the measure would silently stay full width. The
            cap lives in the GRID TRACK instead: `--grid-prose-aside` reads
            `--container-narrow`, which is the same 768px `size="narrow"`
            applies, so the column did not move when the rail arrived. */}
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-(--grid-prose-aside) lg:items-start lg:justify-center">
          <div className="flex min-w-0 flex-col gap-8">
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
                      !view.readingLocale &&
                      LOCALE_DIRECTION[locale as keyof typeof LOCALE_DIRECTION] === "ltr" && (
                        <span className="text-xs text-muted-foreground">({view.locale})</span>
                      )}
                    <div className="ms-auto">
                      <ReadingLanguageMenu
                        options={readingOptions}
                        label={tPublic("readingLanguage")}
                      />
                    </div>
                  </div>
                </Reveal>

                <Reveal variant="up" delay={80}>
                  <div className="flex flex-col gap-8">
                    {/* `lang`/`dir` follow the TRANSLATION on screen (ADR-127 #1). */}
                    <div
                      lang={view.contentLocale}
                      dir={view.contentDirection}
                      className={PROSE_CLASS}
                      dangerouslySetInnerHTML={{ __html: view.simpleExplanation }}
                    />

                    {/* The editor's Illustration. It was saved and served but read
                      by nothing (code-style.md #28). `object-contain`: a diagram
                      cropped to fit a box loses the part that explains it. */}
                    {view.imageUrl && (
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                        <Image
                          src={view.imageUrl}
                          alt=""
                          fill
                          unoptimized={!canOptimizeImage(view.imageUrl)}
                          sizes="(max-width: 768px) 100vw, 768px"
                          className="object-contain"
                        />
                      </div>
                    )}

                    <ProseSection
                      heading={t("detailedHeading")}
                      html={view.detailedExplanation}
                      lang={view.contentLocale}
                      dir={view.contentDirection}
                    />
                    <ProseSection
                      heading={t("advancedHeading")}
                      html={view.advancedExplanation}
                      lang={view.contentLocale}
                      dir={view.contentDirection}
                    />
                    <ProseSection
                      heading={t("exampleHeading")}
                      html={view.exampleScenario}
                      lang={view.contentLocale}
                      dir={view.contentDirection}
                    />

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
                  </div>
                </Reveal>

                {/* The FAQ leaves the prose stack. Inside it, it was a fifth h2
                  over a dl on the same background as the four explanations
                  above — nothing told the reader that the page had stopped
                  explaining the term and started answering questions about
                  it. `FaqPanel` is the surface /news already had;
                  `format="text"` because the editor's answer field is a plain
                  textarea and the value is stored unparsed. */}
                <Reveal
                  variant="up"
                  delay={120}
                  lang={view.contentLocale}
                  dir={view.contentDirection}
                >
                  <FaqPanel
                    title={t("faqHeading")}
                    lead={t("faqLead")}
                    items={view.faq}
                    format="text"
                  />
                </Reveal>
              </>
            )}

            {related.length > 0 && (
              /* Its own card, not a rule over a row of chips. A `border-t` is
               how a page separates two parts of the SAME thing;
               these are exits to other terms, so they take the card surface
               the glossary gives a destination everywhere else — and a card
               against the FAQ's tinted panel keeps the two blocks telling
               apart at a glance, which one shared surface would not. */
              <Reveal
                variant="up"
                className="flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  {/* bg-primary/10, never --primary-subtle — see faq-panel.tsx. */}
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive"
                  >
                    <Waypoints className="size-4.5" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h2 className="text-xl font-semibold tracking-tight">{t("relatedTerms")}</h2>
                    <p className="text-sm text-muted-foreground">{t("relatedLead")}</p>
                  </div>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {related.map((entry) => (
                    <li key={entry.termId}>
                      <Link href={`${ROUTE_PATHS.glossary}/${entry.slug}`} className={CHIP_LINK}>
                        {entry.term}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}
          </div>
          <GlossarySidebar locale={locale} />
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
