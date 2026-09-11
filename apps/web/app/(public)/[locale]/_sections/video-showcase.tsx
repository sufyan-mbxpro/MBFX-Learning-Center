// "Learn by watching" — the video rail that opens the homepage.
//
// Seeded at order 1, so it is the first thing under the header. A full-bleed
// dark band (`tone="inverted"`, the theme's own --secondary surface — not a
// literal), which is what makes it read as a cinematic strip rather than
// another card grid, and what visually separates it from the hero directly
// below it.
//
// Server component apart from the tiles. `parseVideoUrl` runs HERE, on the
// server, so a raw URL never reaches the client and never reaches an iframe
// `src` (security.md #9): the tile receives a derived `embedUrl` or null, and
// there is no third code path.
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@repo/i18n/navigation";
import { isFeatureVisible } from "@repo/settings";
import { parseVideoUrl } from "@repo/utils";
import { Button } from "@repo/ui/components/button";
import { Carousel } from "@repo/ui/components/carousel";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";

import { VideoTile } from "../_components/video-tile.tsx";
import { LEARNING_VIDEOS } from "../_content/home-videos.ts";
import type { SectionProps } from "./registry.ts";

/** `basics` → `Basics`, so one key addresses three catalog entries. */
function catalogKey(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

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
  // The rail teaches; it belongs to the courses feature. An operator who
  // turns off `courses` should not still be shown a wall of lessons.
  if (!(await isFeatureVisible("courses", null))) return null;

  const t = await getTranslations({ locale, namespace: "home" });

  const shown = LEARNING_VIDEOS.slice(0, limit ?? LEARNING_VIDEOS.length);
  // An empty registry is a legitimate configuration, not an error state —
  // render nothing rather than a heading over an empty rail.
  if (shown.length === 0) return null;

  const tiles = shown.map((video) => {
    const suffix = catalogKey(video.key);
    const title = t(`video${suffix}Title` as "videoBasicsTitle");
    // Parsed on the server. A null `url` — and equally a malformed one, which
    // `parseVideoUrl` rejects rather than passes through — yields a tile with
    // no play affordance instead of a broken embed.
    const parsed = video.url ? parseVideoUrl(video.url) : null;

    return (
      <VideoTile
        key={video.key}
        embedUrl={parsed?.embedUrl ?? null}
        poster={video.poster}
        title={title}
        description={t(`video${suffix}Body` as "videoBasicsBody")}
        level={t(`video${suffix}Level` as "videoBasicsLevel")}
        playLabel={t("videoPlay", { title })}
        soonLabel={t("videoSoon")}
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
        className="bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-[0.18] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
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
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {tiles.map((tile, index) => (
                <li key={shown[index]?.key}>{tile}</li>
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
              slideLabels={shown.map((video) =>
                t(`video${catalogKey(video.key)}Title` as "videoBasicsTitle"),
              )}
              itemClassName="w-[86%] sm:w-[64%] lg:w-[calc((100%-1.25rem)/2)]"
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
