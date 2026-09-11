import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getVideoCategories, getVideoTopics } from "@repo/core";
import { isLearnTrack, learnTrackVideosPath, LEARN_TRACKS } from "@repo/contracts";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { VideoMasthead, videoStats } from "../../_components/video-masthead.tsx";
import { VideoShelf } from "../../_components/video-shelf.tsx";

// The video index (changes-16 PR 7, ADR-068).
//
// Cached and session-free like every other public learn page: a video topic
// has nothing per-learner on it at all — no progress, no attempt, no score —
// so unlike the quiz index there is not even an island here (ADR-056 #1).
//
// **This school's only** (ADR-065 §1). The header offers "Learn Crypto →
// Videos"; landing that on an index of forex topics would be the nav telling a
// lie on every page.
//
// **The category filter is a URL, not client state** (D26). Each category has
// its own page under `categories/[category]`, so the chips navigate — see
// `VideoShelf`'s header for why that differs from the quiz shelf's chips.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn/[track]/videos">): Promise<Metadata> {
  const { locale, track } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) return {};

  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    getSetting("seo.titleTemplate"),
  ]);
  const title = `${t(LEARN_TRACKS[track].titleKey)} — ${t("videos.metaTitle")}`;
  return {
    title: (template ?? "%s").replace("%s", title),
    description: t("videos.metaDescription"),
    alternates: { canonical: learnTrackVideosPath(track) },
  };
}

export default async function VideoIndexPage({
  params,
}: PageProps<"/[locale]/learn/[track]/videos">) {
  const { locale, track } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) notFound();

  // Both flags, matching the quiz index's reasoning: a video index inside a
  // learning area that is switched off is a page with no way back to anything.
  const [coursesOn, videosOn] = await Promise.all([
    isFeatureVisible("courses", null),
    isFeatureVisible("videos", null),
  ]);
  if (!coursesOn || !videosOn) notFound();

  const [t, topics, categories] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    getVideoTopics(locale, track),
    getVideoCategories(locale, track),
  ]);

  return (
    <>
      {/* The masthead names the SCHOOL and the page under it, in that order:
          the header offers "Learn Crypto → Videos", and a banner that only
          said "Videos" would drop the half the reader navigated by. */}
      <VideoMasthead
        stats={videoStats(topics)}
        heading={{
          eyebrow: t(LEARN_TRACKS[track].titleKey),
          title: t("videos.title"),
          lead: t("videos.intro"),
        }}
      />

      <VideoShelf topics={topics} categories={categories} basePath={learnTrackVideosPath(track)} />
    </>
  );
}
