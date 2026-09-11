"use client";

// The video index's grid and its category chips (changes-16 PR 7/10, D26).
//
// ─── The chips are LINKS, and that is the difference from `QuizShelf` ──────
//
// `QuizShelf` filters in `useState`, because a quiz category is free text with
// no page behind it and `?category=charting` is not a URL anyone bookmarks.
// A video category IS a page — `/learn/<track>/videos/categories/<slug>` — with
// its own title, its own metadata and its own canonical URL. So these chips
// navigate (D26). No `useState`, no live region announcing a count that a
// navigation already announces by changing the page.
//
// That also means the shelf never has to hold every topic in one payload to
// narrow it later: each category view loads its own rows.
//
// Client only for `renderCover` — a function prop cannot cross the server/
// client boundary, so the component that passes one must be a client
// component. Nothing here reads a session (ADR-056 #1) or `searchParams`
// (architecture.md #6).
import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import type { VideoCategoryView, VideoTopicCardView } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Container } from "@repo/ui/components/container";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { VideoCard } from "@repo/ui/components/video-card";
import { cn } from "@repo/ui/lib/utils";

import { videoCoverUrl } from "../_content/learn-media.ts";
import { categoryTone, videoCardLabels } from "../_lib/video-labels.ts";

export function VideoShelf({
  topics,
  categories,
  basePath,
  /** The category slug this view is scoped to, or null on the index. */
  activeCategory = null,
}: {
  topics: VideoTopicCardView[];
  categories: VideoCategoryView[];
  /** `/learn/<track>/videos` — chips and cards are both built from it. */
  basePath: string;
  activeCategory?: string | null;
}) {
  const t = useTranslations("learn");
  const labels = videoCardLabels(t);

  return (
    <Section id="videos" spacing="md" className="scroll-mt-24">
      <Container className="flex flex-col gap-6">
        {/* One category is not a filter, it is a label — a chip row that can
            only ever produce the set already on screen is a dead control.
            Same rule `QuizShelf` applies to its own chips. */}
        {categories.length > 1 && (
          <nav aria-label={t("videos.filterLabel")} className="flex flex-wrap items-center gap-1.5">
            <Chip
              href={basePath}
              active={activeCategory === null}
              label={t("videos.filterAll")}
              count={categories.reduce((sum, category) => sum + category.topicCount, 0)}
            />
            {categories.map((category) => (
              <Chip
                key={category.id}
                href={`${basePath}/categories/${category.slug}`}
                active={activeCategory === category.slug}
                label={category.name}
                count={category.topicCount}
                // The chip wears the colour its cards' badges wear, so the
                // link between "I pressed this" and "these appeared" is
                // visible rather than inferred.
                tone={categoryTone(category.slug)}
              />
            ))}
          </nav>
        )}

        {topics.length === 0 ? (
          <Empty>
            <EmptyTitle>{t("videos.noneTitle")}</EmptyTitle>
            <EmptyDescription>{t("videos.noneBody")}</EmptyDescription>
          </Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic, index) => {
              const href = `${basePath}/${topic.slug}`;
              return (
                // A <ul> takes <li> children and nothing else, so the reveal
                // wrapper goes INSIDE the item rather than around it.
                // Staggered by position, capped so the last card of a long
                // shelf is not still waiting when it scrolls in.
                <li key={topic.id} className="flex">
                  <Reveal variant="up" delay={Math.min(index, 5) * 60} className="flex w-full">
                    <VideoCard
                      className="w-full"
                      href={href}
                      // The player's own anchor on the detail page: the same
                      // page, arrived at with intent to watch. Null when the
                      // topic carries no recording, and then no play control
                      // renders — an affordance that cannot deliver is worse
                      // than none.
                      watchHref={topic.videoCount > 0 ? `${href}#watch` : null}
                      title={topic.title}
                      description={topic.summary}
                      categoryLabel={topic.category?.name ?? null}
                      categoryTone={topic.category ? categoryTone(topic.category.slug) : "eyebrow"}
                      videoCountLabel={
                        topic.videoCount > 0
                          ? t("videos.videoCount", { count: topic.videoCount })
                          : null
                      }
                      coverUrl={videoCoverUrl(topic.coverUrl, topic.slug)}
                      highlighted={
                        activeCategory !== null && topic.category?.slug === activeCategory
                      }
                      labels={labels}
                      renderCover={({ src, alt }) => <VideoCover src={src} alt={alt} />}
                    />
                  </Reveal>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </Section>
  );
}

/**
 * A topic's thumbnail, faded in on decode.
 *
 * `unoptimized` only for the generated panels: an editor's uploaded cover is a
 * real raster that the optimizer should resize, while a generated vector has
 * nothing for it to win — and `dangerouslyAllowSVG` in next.config would relax
 * SVG handling for EVERY image the app serves, the trade `LearnBackdrop` and
 * `NewsBackdrop` both already refused.
 */
function VideoCover({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized={src.startsWith("/learn/")}
      sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw"
      onLoad={() => setLoaded(true)}
      className={cn(
        "media-zoom object-cover transition-opacity duration-(--duration-slow) ease-(--ease-out-quint)",
        loaded ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

const CHIP_ACTIVE_TONE = {
  info: "bg-info/15 text-info-interactive ring-info/40",
  success: "bg-success/15 text-success-interactive ring-success/40",
  warning: "bg-warning/18 text-warning-interactive ring-warning/40",
  eyebrow: "bg-primary/12 text-primary-interactive ring-primary/40",
} as const;

function Chip({
  href,
  active,
  label,
  count,
  tone,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  /** Omitted on "All", which is the neutral one by definition. */
  tone?: keyof typeof CHIP_ACTIVE_TONE;
}) {
  return (
    <Link
      href={href}
      // `aria-current="page"`, not `aria-pressed`: these navigate. The quiz
      // shelf's chips are toggles and use `aria-pressed` — the difference in
      // markup follows the difference in what they do.
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-[background-color,color,box-shadow,transform] duration-(--duration-base) ease-(--ease-out-quint) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? cn(
              "shadow-sm",
              tone ? CHIP_ACTIVE_TONE[tone] : "bg-primary text-primary-foreground ring-primary",
            )
          : "bg-background text-muted-foreground ring-border hover:-translate-y-px hover:text-foreground hover:shadow-sm hover:ring-primary/25",
      )}
    >
      {label}
      <span
        // Decoration for the label beside it, not a second fact: a screen
        // reader reading "Getting started 4" as a link name is worse than
        // "Getting started".
        aria-hidden
        className={cn(
          "rounded-full px-1.5 text-xs tabular-nums",
          active ? "bg-foreground/10" : "bg-muted",
        )}
      >
        {count}
      </span>
    </Link>
  );
}
