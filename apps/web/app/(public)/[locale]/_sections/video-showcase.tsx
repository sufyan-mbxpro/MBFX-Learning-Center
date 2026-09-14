// "Learn by watching" — the video rail that opens the homepage.
//
// Seeded at order 1, so it is the first thing under the header. A full-bleed
// dark band (`tone="inverted"`, the theme's own --secondary surface — not a
// literal), which is what makes it read as a cinematic strip rather than
// another card grid, and what visually separates it from the hero directly
// below it.
//
// ─── It reads the database (changes-28 PR 1, ADR-092) ─────────────────────
//
// Until changes-28 this rail rendered `_content/home-videos.ts`: six coded
// entries whose `url` was null by design, so the live homepage opened on six
// "Recording soon" tiles — beside a database that already held published
// `VideoTopic` rows with titles, summaries, categories, covers and, on two of
// them, a playable source. The placeholder was never the problem; reading the
// wrong source was.
//
// Composition is still code (ADR-042): which band, where, what shape, how many.
// What is in it is data, like every other homepage band that lists things, so
// an editor who publishes a topic gets it on the homepage without a deploy.
//
// Server component apart from the tiles. Sources are resolved in @repo/core —
// a raw URL never reaches the client and never reaches an iframe `src`
// (security.md #9): the tile receives a derived `embedUrl` or null, and there
// is no third code path.
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { learnTrackVideosPath } from "@repo/contracts";
import { getFeaturedVideoTopics } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { isFeatureVisible } from "@repo/settings";
import { Button } from "@repo/ui/components/button";
import { Carousel } from "@repo/ui/components/carousel";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";

import { VideoTile } from "../_components/video-tile.tsx";
import { videoTopicCoverUrl } from "../_content/video-covers.ts";
import type { SectionProps } from "./registry.ts";

const DEFAULT_LIMIT = 6;

export async function VideoShowcase({
  locale,
  variant = "carousel",
  limit,
  // "Watch every lesson" points at /learn. On the homepage that is the whole
  // job of the button; on /learn itself it is a link to the page you are
  // already reading, so the learn index turns it off. Defaulted to true so the
  // registry-driven homepage path (`SECTION_COMPONENTS`, which passes only
  // `SectionProps`) is unchanged.
  showCta = true,
}: SectionProps & { showCta?: boolean }) {
  // The rail teaches; it belongs to the videos feature. An operator who turns
  // off `videos` should not still be shown a wall of them. (It was gated on
  // `courses` before changes-28, which was the closest flag while the rail was
  // a code registry of lessons — now that it reads video topics, the flag that
  // governs those is the right one.)
  if (!(await isFeatureVisible("videos", null))) return null;

  const [t, topics] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getFeaturedVideoTopics(locale, limit ?? DEFAULT_LIMIT),
  ]);

  // No published topic is a legitimate state, not an error — render nothing
  // rather than a heading over an empty rail. The same rule every other band
  // that lists things already follows.
  if (topics.length === 0) return null;

  const tiles = topics.map((topic) => {
    const href = `${learnTrackVideosPath(topic.track)}/${topic.slug}`;
    return (
      <VideoTile
        key={topic.id}
        // Only an `embed` source can play inside the rail's facade. An
        // `upload` has a real file behind it, but it is a <video> and not an
        // iframe, and a rail that silently swapped element types would be two
        // players wearing one component. Those tiles link to the topic page,
        // where the real player lives.
        embedUrl={topic.source?.kind === "embed" ? topic.source.embedUrl : null}
        poster={topic.coverUrl ?? videoTopicCoverUrl(topic.slug)}
        href={href}
        title={topic.title}
        description={topic.summary}
        level={topic.categoryName}
        playLabel={t("videoPlay", { title: topic.title })}
        guideLabel={topic.source ? t("videoWatch") : t("videoGuide")}
        openLabel={t("videoOpen", { title: topic.title })}
      />
    );
  });

  return (
    <Section tone="inverted" spacing="lg" className="relative isolate overflow-hidden">
      {/* Depth for the band, both from existing utilities: an ambient brand
          wash and the dot grid, which builds its pattern from `currentcolor`
          and so tints itself correctly against this inverted surface without
          a second colour decision. */}
      <span aria-hidden className="bg-glow-primary pointer-events-none absolute inset-0 -z-10" />
      <span
        aria-hidden
        className="bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-18 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />

      <Container className="flex flex-col gap-(--section-gap)">
        <div className="flex flex-wrap items-end justify-between gap-4">
          {/*
            Hand-written rather than `SectionHeading`, deliberately. That
            component's eyebrow is `Badge variant="eyebrow"`
            (`text-primary-interactive`) and its lead is
            `text-muted-foreground` — BOTH derived for legibility against
            `--background`, not against the `--secondary` band this section
            sits on. Reusing it here would be the same class of bug ADR-018
            rule 5 and Badge's own comment already document. Opacities of
            `--secondary-foreground` are readable on `--secondary` by
            construction (ADR-003), which is the footer's idiom for the same
            surface.
          */}
          <div className="flex flex-col items-start gap-3">
            <span className="rounded-4xl bg-secondary-foreground/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-secondary-foreground/85 uppercase">
              {t("videoEyebrow")}
            </span>
            <h2 className="text-display-sm font-semibold text-balance text-secondary-foreground">
              {t("videoTitle")}
            </h2>
            <p className="max-w-2xl text-lg text-pretty text-secondary-foreground/75">
              {t("videoLead")}
            </p>
          </div>
          {showCta && (
            <Button
              variant="ghost"
              shape="pill"
              className="bg-secondary-foreground/10 text-secondary-foreground ring-1 ring-secondary-foreground/20 ring-inset hover:bg-secondary-foreground/20 hover:text-secondary-foreground"
              render={<Link href="/learn" />}
            >
              {t("videoAll")}
              <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
            </Button>
          )}
        </div>

        <Reveal variant="up">
          {variant === "grid" ? (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {tiles.map((tile, index) => (
                <li key={topics[index]?.id}>{tile}</li>
              ))}
            </ul>
          ) : (
            // Wider slides than the explore rail: a 16:9 tile with copy laid
            // over it needs the room, and two-and-a-peek reads as a video
            // shelf where three-across reads as a card grid.
            <Carousel
              label={t("videoCarouselLabel")}
              previousLabel={t("videoCarouselPrevious")}
              nextLabel={t("videoCarouselNext")}
              slideLabels={topics.map((topic) => topic.title)}
              itemClassName="w-43/50 sm:w-16/25 lg:w-(--width-slide-2)"
              tone="inverted"
            >
              {tiles}
            </Carousel>
          )}
        </Reveal>
      </Container>
    </Section>
  );
}
