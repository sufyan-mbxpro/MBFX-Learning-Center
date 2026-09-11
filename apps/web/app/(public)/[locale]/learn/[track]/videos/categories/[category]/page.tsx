import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getVideoCategories, getVideoTopics } from "@repo/core";
import { isLearnTrack, learnTrackVideosPath, LEARN_TRACKS } from "@repo/contracts";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { VideoMasthead, videoStats } from "../../../../_components/video-masthead.tsx";
import { VideoShelf } from "../../../../_components/video-shelf.tsx";

// One category, inside one school (changes-16 PR 7, ADR-068 §1).
//
// **A page, not a filter state.** This is the whole reason D26 made the chips
// links: a reader who wants "the getting-started videos in forex" has a URL
// they can bookmark, share and land on from search, with its own title and its
// own canonical.
//
// **A category spans schools; this view does not.** The same category renders
// under both tracks with different rows and a different count, and that is
// ADR-068 §1's accepted consequence rather than a bug to reconcile — a
// category is taxonomy, and this is a view onto one school's part of it.
//
// A category with no published topics IN THIS TRACK 404s rather than rendering
// an empty shelf: `loadVideoCategories` only returns categories that have
// rows here, so a category that exists but is empty under this school has no
// page under it — the same call the track glossary makes.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn/[track]/videos/categories/[category]">): Promise<Metadata> {
  const { locale, track, category } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) return {};

  const [t, template, categories] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    getSetting("seo.titleTemplate"),
    getVideoCategories(locale, track),
  ]);
  const match = categories.find((entry) => entry.slug === category);
  if (!match) return {};

  const title = `${match.name} — ${t(LEARN_TRACKS[track].titleKey)}`;
  return {
    title: (template ?? "%s").replace("%s", title),
    description: match.description ?? t("videos.metaDescription"),
    alternates: { canonical: `${learnTrackVideosPath(track)}/categories/${match.slug}` },
  };
}

export default async function VideoCategoryPage({
  params,
}: PageProps<"/[locale]/learn/[track]/videos/categories/[category]">) {
  const { locale, track, category } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) notFound();

  const [coursesOn, videosOn] = await Promise.all([
    isFeatureVisible("courses", null),
    isFeatureVisible("videos", null),
  ]);
  if (!coursesOn || !videosOn) notFound();

  const [t, categories] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    getVideoCategories(locale, track),
  ]);

  const match = categories.find((entry) => entry.slug === category);
  if (!match) notFound();

  const topics = await getVideoTopics(locale, track, category);

  return (
    <>
      {/* The eyebrow carries the school AND the section, because this page is
          two levels down and its title is the category's name alone — without
          the trail, "Getting started" says nothing about where the reader is. */}
      <VideoMasthead
        stats={videoStats(topics)}
        heading={{
          eyebrow: `${t(LEARN_TRACKS[track].titleKey)} — ${t("videos.title")}`,
          title: match.name,
          lead: match.description ?? t("videos.categoryLead", { category: match.name }),
        }}
      />

      <VideoShelf
        topics={topics}
        categories={categories}
        basePath={learnTrackVideosPath(track)}
        activeCategory={match.slug}
      />
    </>
  );
}
