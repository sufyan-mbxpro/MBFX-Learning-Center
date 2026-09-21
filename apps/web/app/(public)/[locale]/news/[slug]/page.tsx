import type { Metadata } from "next";
import { alternatesFor, descriptionFrom, shareMetadata } from "../../../../_lib/seo.ts";
import { siteUrl } from "../../../../_lib/site-url.ts";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  articlePath,
  getArticleBySlug,
  getArticleFacets,
  getRedirect,
  getRelatedArticles,
  type ArticleView,
} from "@repo/core";
import { formatDate, parseVideoUrl } from "@repo/utils";
import { getServableLocales } from "@repo/i18n";
import { LOCALE_DIRECTION, routing } from "@repo/i18n/routing";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { ArticleCards } from "../_components/article-list.tsx";
import { ArticleSidebar } from "../_components/article-sidebar.tsx";
import { FaqPanel } from "@repo/ui/components/faq-panel";
import { KeyTakeaways } from "@repo/ui/components/key-takeaways";
import { RichText } from "@repo/ui/components/rich-text";
import { ListingHeader } from "../_components/listing-header.tsx";
import { ReadBeacon } from "../_components/read-beacon.tsx";
import { ShareRow } from "../_components/share-row.tsx";
import { ReadingLanguageMenu } from "../../_components/reading-language-menu.tsx";
import { canOptimizeImage } from "../../_lib/image-optimizer.ts";
import { readingLanguageOptions, readingLocaleFrom } from "../../_lib/reading-language.ts";
import { VideoFacade } from "../../_components/video-facade.tsx";
import { CHIP_LINK } from "@repo/ui/lib/surfaces";

function featureKeyFor(view: ArticleView): "news" | "analysis" {
  return view.kind === "NEWS" ? "news" : "analysis";
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/news/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const readingLocale = readingLocaleFrom(await searchParams);
  const [view, template, tCommon] = await Promise.all([
    getArticleBySlug(locale, slug, readingLocale),
    getSetting("seo.titleTemplate"),
    getTranslations({ locale, namespace: "common" }),
  ]);
  if (!view) return {};

  // OG image fallback chain (ADR-015 #7): article OG → cover → site default,
  // the last step being `shareMetadata`'s.
  const ogImage = view.ogImageUrl ?? view.coverImageUrl ?? null;
  const ownPath = articlePath(locale, routing.defaultLocale, slug);
  // changes-07: OG/Twitter overrides fall back through the SEO fields to the
  // article itself — a null override means "inherit", never "render empty".
  const ogTitle = view.ogTitle ?? view.seoTitle ?? view.title;
  const ogDescription = view.ogDescription ?? view.seoDescription ?? view.excerpt ?? undefined;

  return {
    title: (template ?? "%s").replace("%s", view.seoTitle ?? view.title),
    ...descriptionFrom(view.seoDescription, view.excerpt),
    alternates: await alternatesFor({
      // ADR-127 #4: a reading view points back at the article's own URL. An
      // editor's canonical override wins otherwise, and the page's own URL is
      // the default — a page with no canonical invites every `?utm_` variant
      // to count as its own.
      canonical: view.readingLocale ? ownPath : (view.canonicalUrl ?? ownPath),
      languages: view.alternates.map((alt) => ({
        locale: alt.locale,
        href: articlePath(alt.locale, routing.defaultLocale, alt.slug),
      })),
    }),
    // index and follow are now INDEPENDENT (changes-07): the editor exposes
    // them as two checkboxes, so noIndex no longer implies nofollow.
    //
    // A conditional SPREAD, never `robots: … : undefined` (ADR-090): Next
    // merges parent and child metadata by iterating the child's PRESENT keys,
    // and `resolveRobots(undefined)` is null — so the key being there at all
    // erases the root layout's site-wide directive.
    //
    // ADR-127 #4: a `?lang=` reading view is never indexed — it is this
    // article's words under another language's chrome, and a language that
    // earns an index gets its own locale URL when it is activated.
    ...(view.readingLocale
      ? { robots: { index: false, follow: !view.noFollow } }
      : view.noIndex || view.noFollow
        ? { robots: { index: !view.noIndex, follow: !view.noFollow } }
        : {}),
    ...(await shareMetadata({
      locale,
      siteName: tCommon("siteName"),
      url: ownPath,
      type: "article",
      title: ogTitle,
      description: ogDescription,
      image: ogImage,
      ...(view.publishedAt ? { publishedTime: view.publishedAt.toISOString() } : {}),
      modifiedTime: view.updatedAt.toISOString(),
      twitterCard: view.twitterCard === "summary" ? "summary" : "summary_large_image",
      twitterImage: view.twitterImageUrl,
    })),
  };
}

export default async function ArticlePage({
  params,
  searchParams,
}: PageProps<"/[locale]/news/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const readingLocale = readingLocaleFrom(await searchParams);
  const view = await getArticleBySlug(locale, slug, readingLocale);

  if (!view) {
    // Old slug? articles.ts wrote a 301 row when it changed.
    const target = await getRedirect(articlePath(locale, routing.defaultLocale, slug));
    if (target) permanentRedirect(target);
    notFound();
  }

  if (!(await isFeatureVisible(featureKeyFor(view), null))) notFound();

  // No risk disclaimer under the article any more (ADR-119, changes-36): the
  // owner took it off every page.
  const [t, showAuthor, showReadingTime, relatedCount, servableLocales] = await Promise.all([
    getTranslations(),
    getSetting("articles.showAuthor"),
    getSetting("articles.showReadingTime"),
    getSetting("articles.relatedCount"),
    getServableLocales(),
  ]);
  const readingOptions = readingLanguageOptions({
    languages: view.readingLanguages,
    contentLocale: view.locale,
    interfaceLocale: locale,
    servable: servableLocales,
    currentPath: `/news/${slug}`,
    pathFor: (language) => `/news/${language.slug}`,
  });
  // Same kind grouping as the listing pages (ADR-015 #11: analysis + trade
  // ideas share one feed) — the sidebar facets match whichever feed this
  // article belongs to, not just its own single kind.
  const sidebarKinds =
    view.kind === "NEWS" ? (["NEWS"] as const) : (["ANALYSIS", "TRADE_IDEA"] as const);
  const [related, facets] = await Promise.all([
    // Per-article settings win over the site default (changes-07).
    view.showRelated
      ? getRelatedArticles(view.articleId, locale, view.relatedCount || (relatedCount ?? 3))
      : Promise.resolve([]),
    getArticleFacets(locale, { kinds: [...sidebarKinds] }),
  ]);
  const video = view.videoUrl ? parseVideoUrl(view.videoUrl) : null;
  const backHref = view.kind === "NEWS" ? "/news" : "/analysis";

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const origin = siteUrl();
  const absolute = (url: string) => (url.startsWith("http") ? url : `${origin}${url}`);
  const articleUrl = `${origin}${articlePath(locale, routing.defaultLocale, view.slug)}`;

  // JSON-LD (ADR-015 #11): NewsArticle for news, AnalysisNewsArticle for
  // analysis/trade ideas — values are our own sanitized/plain columns.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": view.kind === "NEWS" ? "NewsArticle" : "AnalysisNewsArticle",
    headline: view.title,
    ...descriptionFrom(view.seoDescription, view.excerpt),
    // The article's own address, and the page it is the main entity of — the
    // two fields Google's article guidance asks for first.
    url: articleUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    ...(view.publishedAt ? { datePublished: view.publishedAt.toISOString() } : {}),
    dateModified: view.updatedAt.toISOString(),
    // The share image first, like the card: OG override, then the cover.
    ...(view.ogImageUrl || view.coverImageUrl
      ? { image: [absolute(view.ogImageUrl ?? view.coverImageUrl ?? "")] }
      : {}),
    publisher: { "@type": "Organization", name: tCommon("siteName"), url: `${origin}/` },
    ...(showAuthor !== false && view.authorName
      ? { author: [{ "@type": "Person", name: view.authorName }] }
      : {}),
  };

  // changes-07: FAQPage structured data whenever the article HAS FAQ items.
  // No toggle — a switch whose only "off" state is "have structured data but
  // hide it" is a footgun (plan §2.4 #37). Answers are already sanitized HTML
  // (ADR-009); schema.org accepts HTML in acceptedAnswer.text.
  const faqJsonLd =
    view.faqItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: view.faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }
      : null;

  return (
    <main className="flex flex-col">
      {/* ADR-123: signed-in learners' "recent reading". A client island, so
          this page stays cached and reads no session. */}
      <ReadBeacon articleId={view.articleId} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      {/* changes-07: the article’s own page banner, distinct from the cover
          image (which is the card/OG image and renders below with the body). */}
      {view.headerImageUrl && (
        <div className="relative h-48 w-full overflow-hidden border-b bg-muted sm:h-64">
          <Image
            src={view.headerImageUrl}
            alt=""
            fill
            unoptimized={!canOptimizeImage(view.headerImageUrl)}
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
      )}
      <ListingHeader
        title={view.title}
        titleLang={view.locale}
        titleDir={view.contentDirection}
        crumbs={[{ label: view.title }]}
      />

      <Section spacing="md">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-(--grid-main-aside)">
          <div className="flex flex-col gap-6">
            <Reveal variant="scale">
              {video ? (
                <VideoFacade
                  embedUrl={video.embedUrl}
                  thumbnailUrl={video.thumbnailUrl}
                  title={view.title}
                  playLabel={t("news.playVideo")}
                />
              ) : (
                view.coverImageUrl && (
                  <div className="group relative aspect-video w-full overflow-hidden rounded-lg border bg-muted shadow-card">
                    <Image
                      src={view.coverImageUrl}
                      alt=""
                      fill
                      unoptimized={!canOptimizeImage(view.coverImageUrl)}
                      sizes="(max-width: 1024px) 100vw, 768px"
                      className="media-zoom object-cover"
                      priority
                    />
                  </div>
                )
              )}
            </Reveal>

            <Reveal variant="up" delay={60}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                {view.category && (
                  <Badge
                    variant="pill"
                    render={<Link href={`/news/category/${view.category.slug}`} />}
                  >
                    {view.category.name}
                  </Badge>
                )}
                {showAuthor !== false && view.authorName && (
                  <span className="flex items-center gap-1.5">
                    <UserRound aria-hidden className="size-3.5" />
                    {view.authorName}
                  </span>
                )}
                {view.publishedAt && <time>{formatDate(view.publishedAt, locale)}</time>}
                {showReadingTime !== false && view.readingMinutes > 0 && (
                  <span>{t("news.minRead", { minutes: view.readingMinutes })}</span>
                )}
                {/* ADR-127: the reading-language menu closes the meta row, at
                    its inline end, rather than taking a row of its own. */}
                <div className="ms-auto">
                  <ReadingLanguageMenu
                    options={readingOptions}
                    label={t("public.readingLanguage")}
                  />
                </div>
              </div>
            </Reveal>

            {/* `lang`/`dir` follow the TRANSLATION on screen, not the page:
                an Arabic reading view is RTL inside an LTR page (ADR-127 #1). */}
            <Reveal variant="up" delay={120} lang={view.locale} dir={view.contentDirection}>
              {view.requestedLocaleMissing ? (
                // ADR-007: an RTL locale with no translation gets the notice
                // in its own direction — never LTR English content inside
                // this layout.
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="font-medium">{t("notTranslated.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("notTranslated.body")}</p>
                </div>
              ) : (
                <>
                  {view.locale !== locale &&
                    !view.readingLocale &&
                    LOCALE_DIRECTION[locale as keyof typeof LOCALE_DIRECTION] === "ltr" && (
                      <p className="text-xs text-muted-foreground">({view.locale})</p>
                    )}
                  {view.body && (
                    /* Sanitized SERVER-SIDE ON SAVE (ADR-009/security.md #8) —
                       this renders already-clean HTML; the save path is the
                       boundary. */
                    <RichText html={view.body} />
                  )}
                </>
              )}
            </Reveal>

            {/* changes-29 B4. Between the body and the FAQ: a takeaways block
                is a summary of what was just read, not a new question. It is
                the SAME component whether an editor typed the list or AI
                filled it — which is the proof that no field here exists only
                because AI does (ADR-097 / §2.2 #8). */}
            {view.keyTakeaways.length > 0 && (
              <Reveal variant="up" lang={view.locale} dir={view.contentDirection}>
                <KeyTakeaways heading={t("news.keyTakeaways")} items={view.keyTakeaways} />
              </Reveal>
            )}

            {/* changes-07: the FAQ list, rendered as an accordion and mirrored
                into the FAQPage JSON-LD above. Answers are sanitized on save
                (ADR-009), same as the body — this renders already-clean HTML. */}
            {view.faqItems.length > 0 && (
              /* Its own SURFACE, not another block of prose under a rule
                 (changes-22). The FAQ answers questions the article did not
                 set out to answer, and on the same background as the body it
                 read as more article — the accordion's triggers were the only
                 sign that anything had changed.

                 That treatment moved into `FaqPanel` when the glossary term
                 page turned out to carry the identical block, unstyled, and
                 the owner reported the same thing twice. One component, so a
                 third detail page cannot invent a fourth shape. `format`
                 defaults to `"html"` — an article's answers are sanitized
                 rich text (ADR-009), the same as its body. */
              <Reveal variant="up" lang={view.locale} dir={view.contentDirection}>
                <FaqPanel
                  title={t("news.faqTitle")}
                  lead={t("news.faqLead")}
                  items={view.faqItems}
                />
              </Reveal>
            )}

            {/* Tags + share still close the body together — share doesn't
                depend on tags existing — but they are two ROWS with a rule
                between them now (changes-22). They had been one stack of
                identically-styled chips in which half navigated to an archive
                and half opened a share window; the tags keep the chip shape
                because they are links to pages, and the share controls became
                round tinted buttons because they are controls. */}
            <Reveal variant="up" className="flex flex-col gap-4 border-t pt-6">
              {view.tags.length > 0 && (
                <ul className="flex flex-wrap items-center gap-2 border-b pb-4">
                  {view.tags.map((tag) => (
                    <li key={tag.slug}>
                      <Link href={`/news/tag/${tag.slug}`} className={CHIP_LINK}>
                        {tag.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <ShareRow
                title={view.title}
                shareLabel={t("news.shareLabel")}
                facebookLabel={t("news.shareFacebook")}
                twitterLabel={t("news.shareTwitter")}
                linkedinLabel={t("news.shareLinkedin")}
                copyLabel={t("news.copyLink")}
                copiedLabel={t("news.linkCopied")}
              />
            </Reveal>

            {related.length > 0 && (
              <Reveal variant="up" className="flex flex-col gap-3 border-t pt-6">
                <section>
                  <h2 className="mb-3 text-xl font-semibold">{t("news.relatedTitle")}</h2>
                  <ArticleCards entries={related} locale={locale} />
                </section>
              </Reveal>
            )}
          </div>

          <ArticleSidebar facets={facets} locale={locale} basePath={backHref} />
        </Container>
      </Section>
    </main>
  );
}
