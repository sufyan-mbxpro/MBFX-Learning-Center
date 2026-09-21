import type { Metadata } from "next";
import { descriptionFrom, localizedPath, shareMetadata } from "../../../../../../_lib/seo.ts";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getVideoTopicBySlug, getVideoTopics } from "@repo/core";
import { isLearnTrack, learnTrackPath, learnTrackVideosPath, LEARN_TRACKS } from "@repo/contracts";
import { getServableLocales } from "@repo/i18n";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { RichText } from "@repo/ui/components/rich-text";
import { Section } from "@repo/ui/components/section";
import { LearnBreadcrumb } from "../../../_components/learn-breadcrumb.tsx";
import { VideoJsonLd } from "../../../_components/video-json-ld.tsx";
import { VideoLinks } from "../../../_components/video-links.tsx";
import { VideoPlayer } from "../../../_components/video-player.tsx";
import { VideoRelated } from "../../../_components/video-related.tsx";
import { categoryTone } from "../../../_lib/video-labels.ts";
import { ReadingLanguageMenu } from "../../../../_components/reading-language-menu.tsx";
import { readingLanguageOptions, readingLocaleFrom } from "../../../../_lib/reading-language.ts";

// One video topic (changes-16 PR 8, ADR-068).
//
// Cached and session-free. There is genuinely nothing per-learner on this page
// — no progress, no completion, no attempt — so unlike a lesson it needs no
// island at all (ADR-056 #1).
//
// **The track is part of the address.** `getVideoTopicBySlug` takes it and
// returns null when the row's track differs, so a topic loaded under the wrong
// school 404s rather than answering at two URLs (ADR-065's rule for courses).
//
// **A topic with no recording is not an error.** The contract's capability
// rule allows a body instead of a video, so the player, the JSON-LD and the
// `#watch` anchor are all conditional and the page reads as a written guide
// when they are absent.
export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/learn/[track]/videos/[topic]">): Promise<Metadata> {
  const { locale, track, topic } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) return {};

  const readingLocale = readingLocaleFrom(await searchParams);
  const [template, view, tCommon] = await Promise.all([
    getSetting("seo.titleTemplate"),
    getVideoTopicBySlug(locale, track, topic, readingLocale),
    getTranslations({ locale, namespace: "common" }),
  ]);
  if (!view) return {};

  const canonical = localizedPath(locale, `${learnTrackVideosPath(track)}/${view.slug}`);

  return {
    title: (template ?? "%s").replace("%s", view.seoTitle || view.title),
    ...descriptionFrom(view.seoDescription, view.summary),
    alternates: { canonical },
    // changes-46 SEO check: no share card of its own, so Open Graph fell
    // through to the root layout's (no `og:url`, no cover). The topic's cover
    // is its card image, as a course's is.
    ...(await shareMetadata({
      locale,
      siteName: tCommon("siteName"),
      url: canonical,
      title: view.seoTitle || view.title,
      description: view.seoDescription || view.summary,
      image: view.coverUrl,
    })),
    // ADR-127 #4: a `?lang=` reading view is never indexed. A conditional
    // SPREAD, never `robots: undefined` (ADR-090).
    ...(view.readingLocale ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function VideoTopicPage({
  params,
  searchParams,
}: PageProps<"/[locale]/learn/[track]/videos/[topic]">) {
  const { locale, track, topic } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) notFound();

  const [coursesOn, videosOn] = await Promise.all([
    isFeatureVisible("courses", null),
    isFeatureVisible("videos", null),
  ]);
  if (!coursesOn || !videosOn) notFound();

  const readingLocale = readingLocaleFrom(await searchParams);
  const [t, tPublic, view, servableLocales] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    getTranslations({ locale, namespace: "public" }),
    getVideoTopicBySlug(locale, track, topic, readingLocale),
    getServableLocales(),
  ]);
  if (!view) notFound();

  const videosPath = learnTrackVideosPath(track);
  // ADR-127: the topic's own words (title, summary, guide) only.
  const readingOptions = readingLanguageOptions({
    languages: view.readingLanguages,
    contentLocale: view.contentLocale,
    interfaceLocale: locale,
    servable: servableLocales,
    currentPath: `${videosPath}/${view.slug}`,
    pathFor: (language) => `${videosPath}/${language.slug}`,
  });

  // Related = the same category in the same school, this topic excluded.
  // Loaded through the SAME cached reader the shelf uses rather than a
  // bespoke query: the rows are already in the `content` cache entry for this
  // (locale, track, category), so a second page costs nothing new. A topic
  // with no category gets the school's shelf instead — narrower would be an
  // empty rail, and a rail that is sometimes absent for reasons the reader
  // cannot see is worse than a broader one.
  const siblings = await getVideoTopics(locale, track, view.category?.slug);
  const related = siblings.filter((entry) => entry.id !== view.id).slice(0, 3);

  const firstVideo = view.videos[0];

  return (
    <>
      {/* Emitted only when there IS a recording — see `video-json-ld.tsx`. */}
      {firstVideo && (
        <VideoJsonLd
          name={view.title}
          description={view.seoDescription ?? view.summary}
          url={`${videosPath}/${view.slug}`}
          uploadDate={view.updatedAt.toISOString()}
          thumbnailUrl={
            firstVideo.kind === "embed" ? firstVideo.thumbnailUrl : firstVideo.posterUrl
          }
          embedUrl={firstVideo.kind === "embed" ? firstVideo.embedUrl : null}
          contentUrl={firstVideo.kind === "upload" ? firstVideo.src : null}
        />
      )}

      <Section spacing="md">
        {/* `Container size="narrow"` rather than a `max-w-*` utility: the
            utility loses to `.container-page` at equal specificity, which is
            the trap the glossary design pass recorded. */}
        <Container size="narrow" className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <LearnBreadcrumb
              learnLabel={t(LEARN_TRACKS[track].titleKey)}
              learnHref={learnTrackPath(track)}
              trail={[{ href: videosPath, label: t("videos.metaTitle") }]}
              current={view.title}
            />

            <div className="flex flex-col gap-3">
              {(view.category || readingOptions.length > 1) && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* A link, not a chip: the category has a page, and this is
                      the reader's way back up to its siblings (D26). */}
                  {view.category && (
                    <a href={`${videosPath}/categories/${view.category.slug}`}>
                      <Badge variant={categoryTone(view.category.slug)}>{view.category.name}</Badge>
                    </a>
                  )}
                  <div className="ms-auto">
                    <ReadingLanguageMenu
                      options={readingOptions}
                      label={tPublic("readingLanguage")}
                    />
                  </div>
                </div>
              )}
              {/* `lang`/`dir` follow the TRANSLATION on screen (ADR-127 #1). */}
              <h1
                lang={view.contentLocale}
                dir={view.contentDirection}
                className="text-3xl font-semibold text-balance sm:text-4xl"
              >
                {view.title}
              </h1>
              {view.summary && (
                <p
                  lang={view.contentLocale}
                  dir={view.contentDirection}
                  className="text-lg text-muted-foreground text-pretty"
                >
                  {view.summary}
                </p>
              )}
            </div>
          </div>

          {/* `id="watch"` is what the card's play control targets. It sits on
              the player when there is one, and nowhere at all when there is
              not — a fragment that scrolls to a paragraph of prose after the
              reader pressed play would be a small lie. */}
          {view.videos.length > 0 ? (
            <div id="watch" className="scroll-mt-24">
              <VideoPlayer
                videos={view.videos}
                labels={{ play: t("videos.watch"), poster: t("videos.noArtwork") }}
              />
            </div>
          ) : (
            <aside className="rounded-lg border bg-muted/40 p-4">
              <p className="font-medium">{t("videos.guideOnlyTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("videos.guideOnlyBody")}</p>
            </aside>
          )}

          {view.content && (
            <section aria-labelledby="video-about-heading" className="flex flex-col gap-4">
              <h2 id="video-about-heading" className="text-lg font-semibold">
                {t("videos.aboutHeading")}
              </h2>
              {/* Already sanitized on save (security.md #8) — this renders it,
                  it does not clean it. */}
              <div lang={view.contentLocale} dir={view.contentDirection}>
                <RichText html={view.content} />
              </div>
            </section>
          )}

          <VideoLinks
            links={view.links}
            labels={{
              heading: t("videos.linksHeading"),
              intro: t("videos.linksIntro"),
              external: t("videos.externalLink"),
            }}
          />
        </Container>
      </Section>

      <VideoRelated
        topics={related}
        basePath={videosPath}
        heading={t("videos.relatedHeading")}
        intro={t("videos.relatedIntro")}
        allHref={videosPath}
        allLabel={t("videos.moreInTrack")}
      />
    </>
  );
}
