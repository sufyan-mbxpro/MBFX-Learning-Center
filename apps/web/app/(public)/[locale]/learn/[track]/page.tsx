import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getLearnIndex } from "@repo/core";
import {
  isLearnTrack,
  learnTrackGlossaryPath,
  learnTrackPath,
  LEARN_TRACKS,
  ROUTE_PATHS,
} from "@repo/contracts";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { CtaBand } from "@repo/ui/components/cta-band";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { Section } from "@repo/ui/components/section";
import { CourseShelf } from "../_components/course-shelf.tsx";
import { LearnTrackBackdrop } from "../_components/learn-art.tsx";
import { LearnMasthead } from "../_components/learn-masthead.tsx";
import { learnStats, shelfLabels, toShelfTracks } from "../_lib/shelf-data.ts";

// One school's index — `/learn/forex`, `/learn/crypto` (ADR-065 §1).
//
// This is where the header's "Learn Forex" lands, and it is the page the
// pinned section bar scopes itself to. It renders the SAME shelf component the
// umbrella `/learn` does, given one track's group: the shelf hides its track
// chips when handed a single track, so no variant component is needed and a
// card cannot look different depending on which page it is on.
//
// The track is validated in the layout (ADR-065 §5), which 404s the whole
// segment for an unregistered one. The re-check here is not redundant: this
// page reads `params.track` to pick a group and to build hrefs, and
// `architecture.md`'s rule that a server function verifies its own input
// applies to a route param exactly as it does to a body.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn/[track]">): Promise<Metadata> {
  const { locale, track } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) return {};

  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t(LEARN_TRACKS[track].titleKey)),
    description: t(LEARN_TRACKS[track].descriptionKey),
    alternates: { canonical: learnTrackPath(track) },
  };
}

export default async function LearnTrackPage({ params }: PageProps<"/[locale]/learn/[track]">) {
  const { locale, track } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) notFound();

  // Disabled feature → 404, not a blank page. The flag IS the module switch,
  // the same rule `/news` and `/glossary` already follow.
  if (!(await isFeatureVisible("courses", null))) notFound();

  const [t, groups] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    // The one cached, `content`-tagged loader, shared with `/learn` and with
    // the course sidebar. Filtering it here rather than adding a per-track
    // query keeps ONE cache entry for the whole area: two tracks would
    // otherwise be three near-identical entries invalidated by the same tag.
    getLearnIndex(locale),
  ]);

  const mine = groups.filter((group) => group.track === track);
  const tracks = toShelfTracks(mine, t);

  return (
    <>
      <LearnMasthead
        stats={learnStats(mine)}
        // The video rail is the umbrella page's — a school index sends the
        // reader to courses, and an anchor to a band that is not on the page
        // is a button that silently does nothing.
        hasVideos={false}
        heading={{
          eyebrow: t("index.eyebrow"),
          title: t(LEARN_TRACKS[track].titleKey),
          lead: t(LEARN_TRACKS[track].descriptionKey),
        }}
        backdrop={<LearnTrackBackdrop track={track} priority />}
      />

      {tracks.length === 0 ? (
        <Section spacing="md">
          <Container>
            <Empty>
              <EmptyTitle>{t("index.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("index.emptyBody")}</EmptyDescription>
              <Button variant="outline" size="sm" render={<Link href={ROUTE_PATHS.learn} />}>
                {t("nav.allLearning")}
              </Button>
            </Empty>
          </Container>
        </Section>
      ) : (
        <CourseShelf tracks={tracks} labels={shelfLabels(t)} />
      )}

      <CtaBand title={t("index.ctaTitle")} description={t("index.ctaDescription")}>
        <Button
          size="lg"
          shape="pill"
          variant="secondary"
          render={<Link href={learnTrackGlossaryPath(track)} />}
        >
          {t("index.ctaAction")}
        </Button>
      </CtaBand>
    </>
  );
}
