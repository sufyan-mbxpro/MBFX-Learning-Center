// The learning videos rail — `/learn` only (changes-31).
//
// It opened the homepage for two years, first as a shelf of coded entries and
// then as a shelf of published `VideoTopic` rows. For one turn it was a
// full-height slider. It is now on neither: the owner asked for the dynamic
// video content off the home page (2026-09-15), and the hero's own static
// footage took the position. This component keeps the `/learn` rail, which is
// the surface the rows were always really for.
//
// ─── It reads the database (changes-28 PR 1, ADR-092) ─────────────────────
//
// Until changes-28 this rail rendered `_content/home-videos.ts`: six coded
// entries whose `url` was null by design, so the page opened on six
// "Recording soon" tiles — beside a database that already held published
// `VideoTopic` rows with titles, summaries, categories, covers and, on two of
// them, a playable source. The placeholder was never the problem; reading the
// wrong source was. That decision is untouched by the homepage change: what
// moved is WHERE the rail appears, not where its content comes from.
//
// Composition is code (ADR-042): which band, where, what shape, how many.
// What is in it is data, so an editor who publishes a topic gets it on the
// learn index without a deploy.
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
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";

import { VideoTile } from "../_components/video-tile.tsx";
import { videoTopicCoverUrl } from "../_content/video-covers.ts";
import type { SectionProps } from "./registry.ts";

const DEFAULT_LIMIT = 6;

/**
 * The on-media action: a tinted disc of the band's own derived foreground.
 *
 * Not `variant="outline"`, which is `border-input bg-background` — a pale chip
 * on a dark scrim. Opacities of `--secondary-foreground` are readable ON
 * `--secondary` by construction (ADR-003), which is the idiom the footer, the
 * connect band and Carousel's own inverted arrows all already use for this
 * exact surface.
 */
const ON_MEDIA_BUTTON =
  "bg-secondary-foreground/10 text-secondary-foreground ring-1 ring-secondary-foreground/25 ring-inset hover:bg-secondary-foreground/20 hover:text-secondary-foreground";

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
  // ── The homepage carries no video band ──────────────────────────────────
  //
  // It did for one turn: a full-height slider of published topics. The owner
  // asked for the dynamic content off the home page (2026-09-15), and what
  // replaced it is the hero's own static footage — composition, not content.
  //
  // So this component serves `/learn` and nothing else, and the seeded
  // homepage row is `enabled: false`. The guard is not belt-and-braces: a
  // database seeded before that change still holds an ENABLED row, and the
  // homepage section composer is paused (ADR-038), so there is no screen on
  // which to turn it off. Rendering nothing is what keeps an existing install
  // from showing a band nobody asked for — the same rule the owner-supplied
  // bands follow when their data is empty (ADR-103 §3).
  //
  // First, and before any I/O: it is a pure check on a prop, and a band that
  // is not going to render should not cost a query to find that out.
  if (variant !== "grid") return null;

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

  // ── /learn: the tile grid, unchanged ────────────────────────────────────
  const tiles = topics.map((topic) => (
    <VideoTile
      key={topic.id}
      // Only an `embed` source can play inside the rail's facade. An `upload`
      // has a real file behind it, but it is a <video> and not an iframe, and
      // a rail that silently swapped element types would be two players
      // wearing one component. Those tiles link to the topic page, where the
      // real player lives.
      embedUrl={topic.source?.kind === "embed" ? topic.source.embedUrl : null}
      poster={topic.coverUrl ?? videoTopicCoverUrl(topic.slug)}
      href={`${learnTrackVideosPath(topic.track)}/${topic.slug}`}
      title={topic.title}
      description={topic.summary}
      level={topic.categoryName}
      playLabel={t("videoPlay", { title: topic.title })}
      guideLabel={topic.source ? t("videoWatch") : t("videoGuide")}
      openLabel={t("videoOpen", { title: topic.title })}
    />
  ));

  return (
    <Section tone="inverted" spacing="lg">
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
            <span className="rounded-sm bg-secondary-foreground/10 px-2 py-1 text-3xs font-semibold tracking-caps text-secondary-foreground/85 uppercase">
              {t("videoEyebrow")}
            </span>
            <h2 className="font-display text-display-sm font-bold text-balance text-secondary-foreground">
              {t("videoTitle")}
            </h2>
            <p className="max-w-2xl text-lg text-pretty text-secondary-foreground/75">
              {t("videoLead")}
            </p>
          </div>
          {showCta && (
            <Button variant="ghost" className={ON_MEDIA_BUTTON} render={<Link href="/learn" />}>
              {t("videoAll")}
              <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
            </Button>
          )}
        </div>

        <Reveal variant="up">
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((tile, index) => (
              <li key={topics[index]?.id}>{tile}</li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}
