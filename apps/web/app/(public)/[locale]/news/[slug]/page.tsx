import type { Metadata } from "next";
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
import { parseVideoUrl } from "@repo/utils";
import { LOCALE_DIRECTION, routing } from "@repo/i18n/routing";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { ArticleCards } from "../_components/article-list.tsx";
import { ArticleSidebar } from "../_components/article-sidebar.tsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";
import { RichText } from "@repo/ui/components/rich-text";
import { ListingHeader } from "../_components/listing-header.tsx";
import { ShareRow } from "../_components/share-row.tsx";
import { VideoFacade } from "../../_components/video-facade.tsx";

function featureKeyFor(view: ArticleView): "news" | "analysis" {
  return view.kind === "NEWS" ? "news" : "analysis";
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/news/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [view, template, defaultOgImage] = await Promise.all([
    getArticleBySlug(locale, slug),
    getSetting("seo.titleTemplate"),
    getSetting("seo.defaultOgImage"),
  ]);
  if (!view) return {};

  const languages = Object.fromEntries(
    view.alternates.map((alt) => [
      alt.locale,
      articlePath(alt.locale, routing.defaultLocale, alt.slug),
    ]),
  );

  // OG image fallback chain (ADR-015 #7): article OG → cover → site default.
  const ogImage = view.ogImageUrl ?? view.coverImageUrl ?? defaultOgImage ?? undefined;
  // changes-07: OG/Twitter overrides fall back through the SEO fields to the
  // article itself — a null override means "inherit", never "render empty".
  const ogTitle = view.ogTitle ?? view.seoTitle ?? view.title;
  const ogDescription = view.ogDescription ?? view.seoDescription ?? view.excerpt ?? undefined;
  const twitterImage = view.twitterImageUrl ?? ogImage;

  return {
    title: (template ?? "%s").replace("%s", view.seoTitle ?? view.title),
    description: view.seoDescription ?? view.excerpt ?? undefined,
    alternates: {
      languages,
      ...(view.canonicalUrl ? { canonical: view.canonicalUrl } : {}),
    },
    // index and follow are now INDEPENDENT (changes-07): the editor exposes
    // them as two checkboxes, so noIndex no longer implies nofollow.
    robots:
      view.noIndex || view.noFollow ? { index: !view.noIndex, follow: !view.noFollow } : undefined,
    openGraph: {
      type: "article",
      title: ogTitle,
      description: ogDescription,
      publishedTime: view.publishedAt?.toISOString(),
      modifiedTime: view.updatedAt.toISOString(),
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: view.twitterCard === "summary" ? "summary" : "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: twitterImage ? [twitterImage] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: PageProps<"/[locale]/news/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const view = await getArticleBySlug(locale, slug);

  if (!view) {
    // Old slug? articles.ts wrote a 301 row when it changed.
    const target = await getRedirect(articlePath(locale, routing.defaultLocale, slug));
    if (target) permanentRedirect(target);
    notFound();
  }

  if (!(await isFeatureVisible(featureKeyFor(view), null))) notFound();

  const [t, disclaimer, showAuthor, showReadingTime, relatedCount] = await Promise.all([
    getTranslations(),
    getSetting("legal.riskDisclaimer"),
    getSetting("articles.showAuthor"),
    getSetting("articles.showReadingTime"),
    getSetting("articles.relatedCount"),
  ]);
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

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const video = view.videoUrl ? parseVideoUrl(view.videoUrl) : null;
  const backHref = view.kind === "NEWS" ? "/news" : "/analysis";

  // JSON-LD (ADR-015 #11): NewsArticle for news, AnalysisNewsArticle for
  // analysis/trade ideas — values are our own sanitized/plain columns.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": view.kind === "NEWS" ? "NewsArticle" : "AnalysisNewsArticle",
    headline: view.title,
    description: view.seoDescription ?? view.excerpt ?? undefined,
    datePublished: view.publishedAt?.toISOString(),
    dateModified: view.updatedAt.toISOString(),
    ...(view.coverImageUrl ? { image: [view.coverImageUrl] } : {}),
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
            unoptimized
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
      )}
      <ListingHeader title={view.title} crumbs={[{ label: view.title }]} />

      <Section spacing="md">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
                      unoptimized
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
                {view.publishedAt && <time>{dateFormat.format(view.publishedAt)}</time>}
                {showReadingTime !== false && view.readingMinutes > 0 && (
                  <span>{t("news.minRead", { minutes: view.readingMinutes })}</span>
                )}
              </div>
            </Reveal>

            <Reveal variant="up" delay={120}>
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

            {/* changes-07: the FAQ list, rendered as an accordion and mirrored
                into the FAQPage JSON-LD above. Answers are sanitized on save
                (ADR-009), same as the body — this renders already-clean HTML. */}
            {view.faqItems.length > 0 && (
              <Reveal variant="up" className="flex flex-col gap-3 border-t pt-6">
                <h2 className="text-xl font-semibold">{t("news.faqTitle")}</h2>
                <Accordion>
                  {view.faqItems.map((item, i) => (
                    // Authored rows have no stable id on the public view;
                    // order is their identity, as in @repo/blocks' faq block.
                    <AccordionItem key={i} value={"faq-" + i}>
                      <AccordionTrigger>{item.question}</AccordionTrigger>
                      <AccordionContent>
                        <div
                          className="flex flex-col gap-2 leading-relaxed [&_a]:text-primary-interactive [&_a]:underline [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5"
                          dangerouslySetInnerHTML={{ __html: item.answer }}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Reveal>
            )}

            {/* Tags + share always render together as the body's closing
                row — share doesn't depend on tags existing. */}
            <Reveal variant="up" className="flex flex-col gap-4 border-t pt-6">
              {view.tags.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {view.tags.map((tag) => (
                    <li key={tag.slug}>
                      <Link
                        href={`/news/tag/${tag.slug}`}
                        className="rounded-md border bg-card px-2.5 py-1 text-xs transition-[background-color,transform] duration-(--duration-fast) hover:-translate-y-0.5 hover:bg-primary/10 hover:text-primary-interactive"
                      >
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

            {disclaimer && (
              <Reveal variant="fade">
                <p className="rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
                  {disclaimer}
                </p>
              </Reveal>
            )}

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
