// The video index's masthead (changes-16 PR 7/10) — `QuizMasthead`'s sibling,
// on the same `PageHero` for the same reason: the tone and contrast decisions
// are made once in the primitive.
//
// A separate component rather than a `QuizMasthead` prop because its figures
// are different figures. That one counts quizzes, questions and topics; this
// counts topics, videos and categories. Threading a stat array through a
// shared component would make three call sites responsible for a layout none
// of them owns.
//
// The figures are COUNTED from the rows the page already loaded — never a
// claim typed into a catalog. A school with nothing published shows no strip
// at all rather than three zeroes, exactly as the other two mastheads do.
import { ArrowDown, Film, FolderOpen, Video } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { VideoTopicCardView } from "@repo/contracts";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { Section } from "@repo/ui/components/section";
import { StatCard } from "@repo/ui/components/stat-card";

import { LearnBackdrop } from "./learn-art.tsx";

export interface VideoStats {
  topics: number;
  videos: number;
  categories: number;
}

/**
 * Counted from the index's own rows, so the strip cannot disagree with the
 * grid under it. Exported for the loading skeleton's sake as much as the
 * page's: both need to know a strip appears only when something is published.
 *
 * `videos` sums the per-topic counts rather than counting topics again — a
 * topic can carry several recordings, and a strip that said "6 topics, 6
 * videos" when there are nine would be a number the page itself disproves.
 */
export function videoStats(topics: VideoTopicCardView[]): VideoStats {
  return {
    topics: topics.length,
    videos: topics.reduce((sum, topic) => sum + topic.videoCount, 0),
    categories: new Set(topics.flatMap((topic) => (topic.category ? [topic.category.slug] : [])))
      .size,
  };
}

export async function VideoMasthead({
  stats,
  heading,
}: {
  stats: VideoStats;
  /** The school's own name, so "Learn Crypto → Videos" lands on a banner that
   * says which school it is (ADR-065 §1). Passed already translated. */
  heading: { eyebrow: string; title: string; lead: string };
}) {
  const t = await getTranslations("learn");

  return (
    <>
      <PageHero
        // `priority` on this one piece: it is the LCP candidate on the route.
        // Every video panel below it stays lazy.
        backdrop={<LearnBackdrop slot="videoBanner" priority />}
        // Composed WITH the artwork rather than instead of it: the generated
        // banner is a soft wash and the glyph field is line art, so the two
        // occupy different frequencies. Dialled down because this band already
        // carries a backdrop.
        motif={<AmbientMotif variant="learn" intensity={0.7} />}
        eyebrow={heading.eyebrow}
        title={heading.title}
        lead={heading.lead}
        actions={
          // An in-page anchor, not a navigation: on a phone the grid is a
          // screen down, and a masthead that only repeats the page's name has
          // not earned its height. `secondary` rides on --primary-foreground,
          // the one ink ADR-003 derives to be legible on the `brand` tone.
          <Button size="xl" shape="pill" variant="secondary" render={<a href="#videos" />}>
            {t("videos.heroBrowse")}
            {/* Down, not inline-end: this scrolls the page rather than
                navigating, so it needs no RTL flip either. */}
            <ArrowDown aria-hidden />
          </Button>
        }
      />

      {stats.topics > 0 && (
        <Section spacing="sm" tone="muted">
          <Container>
            {/* StatCard's ink is --foreground/--muted-foreground, both derived
                against --background — which is why this strip is its own muted
                band under the hero rather than a row inside the brand fill,
                where neither would be contrast-checked (ADR-018 #5). */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
              <StatItem
                icon={<Video aria-hidden className="size-5" />}
                value={stats.topics}
                label={t("videos.statTopics")}
              />
              {/* Absent, not zero: a school whose topics are all written
                  guides has no recordings, and "0 videos" on a page called
                  Videos reads as a fault rather than as a fact. */}
              {stats.videos > 0 && (
                <StatItem
                  icon={<Film aria-hidden className="size-5" />}
                  value={stats.videos}
                  label={t("videos.statVideos")}
                />
              )}
              {stats.categories > 0 && (
                <StatItem
                  icon={<FolderOpen aria-hidden className="size-5" />}
                  value={stats.categories}
                  label={t("videos.statCategories")}
                />
              )}
            </div>
          </Container>
        </Section>
      )}
    </>
  );
}

/** StatCard plus the glyph above it — the count-up itself is StatCard's. */
function StatItem({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary-interactive">
        {icon}
      </span>
      <StatCard value={value} label={label} />
    </div>
  );
}
