// "See it in practice" — the home page's three-kinds-of-proof band
// (changes-35, ADR-116 §1 band D and §3).
//
// The reference's fourth band puts three unrelated arguments side by side: a
// client's words, a video, and an offer. Ours is the same idea with the
// material this site actually has — what a reader took from a lesson, the
// work itself on screen, and the instruments to work it out themselves.
//
// ─── It is the first home band fed by THREE datasets ─────────────────────
//
// Testimonials are a static content module (ADR-103), the video is static
// owner footage (`HOME_MEDIA.practiceVideo`), the tools are `Tool` rows. The
// quotes and the tools are not guaranteed to exist, and ADR-116 §3 is the rule
// that follows: the band degrades PER COLUMN and never renders a column
// heading over an empty column (`home-presentation.test.ts`).
//
// This band absorbs three that used to be separate: `testimonials` (a 3-up
// grid), `popular_tools` (a 4-up grid) and `connect`'s video panel. All three
// keep their components and are seeded off on the home page only — ADR-116 §7
// states what that costs.
//
// ─── The video column is the owner's footage (2026-09-17) ────────────────
//
// It was the one featured `VideoTopic`, rendered as a click-to-play tile that
// sat centred in its column and was usually absent (a topic with an EMBED
// source is what it needed). The owner asked for a clip that plays on its own
// and fills the column to the same height as the two beside it, so the column
// is now composition rather than content — the same move the hero made with
// its footage, and the same `HeroVideo` island: muted, looped, started after
// hydration, and held still under reduced motion.
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { ArrowRight, Quote } from "lucide-react";

import { ROUTE_PATHS, toolPath } from "@repo/contracts";
import { getEnabledTools } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { isFeatureVisible } from "@repo/settings";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Carousel } from "@repo/ui/components/carousel";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";

import { HOME_FACTS } from "../_content/home-facts.ts";
import { HeroVideo } from "../_components/hero-video.tsx";
import { HOME_MEDIA } from "../_content/home-media.ts";
import { TOOL_ICONS } from "../tools/_components/tool-icons.ts";
import type { SectionProps } from "./registry.ts";
import type { HomeTestimonial } from "../_content/home-facts.ts";

/** How many tools the band names. Three is the reference's icon row. */
const PRACTICE_TOOL_COUNT = 3;

/**
 * One learner's words.
 *
 * A `figure`, because a `figcaption` is only a figcaption inside one — the
 * attribution is not part of the quotation. Lifted from `testimonials.tsx`
 * rather than shared: that band's card is a grid cell that must match its two
 * neighbours' height, and this one is a column of its own.
 */
function TestimonialCard({ testimonial }: { testimonial: HomeTestimonial }) {
  return (
    // ADR-101 §4: the public card is separated by air.
    <Card variant="plain" className="h-full bg-muted/50">
      <CardContent className="h-full">
        <figure className="flex h-full flex-col gap-5">
          {/* Mirrored in RTL, where a quotation opens on the other side. */}
          <Quote aria-hidden className="size-8 shrink-0 text-primary/25 rtl:-scale-x-100" />
          <blockquote className="flex-1 text-pretty text-foreground">
            {testimonial.quote}
          </blockquote>
          <figcaption className="flex items-center gap-3 border-t pt-4">
            {testimonial.avatar ? (
              <Image
                src={testimonial.avatar}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-lg text-primary-interactive"
              >
                {/* The initial, not a stock portrait: a generated face beside a
                    real person's words is the one placeholder that reads as a
                    lie. */}
                {testimonial.name.slice(0, 1)}
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {testimonial.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">{testimonial.role}</span>
            </span>
          </figcaption>
        </figure>
      </CardContent>
    </Card>
  );
}

export async function InPractice({ locale }: SectionProps) {
  const { testimonials } = HOME_FACTS;

  // The tools flag gates the third column exactly as `PopularTools` gates its
  // whole band.
  const toolsVisible = await isFeatureVisible("calculators", null);

  const [t, tTools, tools] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "tools" }),
    toolsVisible ? getEnabledTools(locale) : [],
  ]);

  // Static footage, so it is present whenever a file is named — the column
  // still goes through the count so the grid closes up if the entry is ever
  // emptied rather than leaving a hole.
  const video: string = HOME_MEDIA.practiceVideo;
  const shownTools = tools.slice(0, PRACTICE_TOOL_COUNT);
  const columns = [testimonials.length > 0, video !== "", shownTools.length > 0];
  const columnCount = columns.filter(Boolean).length;

  // Nothing to show is a legitimate configuration, not an error state. The
  // band is absent rather than a heading over three empty columns (ADR-116 §3).
  if (columnCount === 0) return null;

  return (
    <Section spacing="md">
      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading
          eyebrow={t("practiceEyebrow")}
          title={t("practiceTitle")}
          lead={t("practiceLead")}
        />

        {/* The grid tracks follow the COLUMN COUNT, not the viewport: a band
            that lost a column to a flag should close up, not leave the gap
            where it was. `grid-cols-1` is the stated base (code-style #23) and
            is also the whole layout at one column.

            No `items-start` (owner, 2026-09-16): the three columns STRETCH to
            one height. Start-aligned they came out 300px, 237px and 420px —
            three columns that each ended somewhere different, which reads as
            three things that happen to be adjacent rather than as one band.
            Each column below fills the row and decides for itself what to do
            with the surplus: the quote grows, the video FILLS it (2026-09-17),
            the tools list grows. */}
        <div
          className={
            columnCount === 3
              ? "grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8"
              : columnCount === 2
                ? "grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8"
                : "grid grid-cols-1 gap-6"
          }
        >
          {testimonials.length > 0 && (
            <Reveal variant="start" className="h-full">
              {testimonials.length > 1 ? (
                // One at a time, with dots. A testimonial is a SET a reader
                // steps through, not a shelf they skim — position matters and
                // paging by a viewport-full does not, because a viewport-full
                // here is one quote (ADR-116 §7).
                //
                // changes-37 (ADR-121 §4): it advances on its own, and shows
                // previous/next over the card on hover. Autoplay brings its own
                // pause button and holds still under the pointer, under focus,
                // off screen and under reduced motion — see `Carousel`.
                <Carousel
                  className="h-full"
                  label={t("practiceQuotesLabel")}
                  previousLabel={t("practiceQuotesPrevious")}
                  nextLabel={t("practiceQuotesNext")}
                  itemClassName="w-full"
                  controls="dots"
                  hoverArrows
                  autoplay={{
                    interval: 6000,
                    pauseLabel: t("practiceQuotesPause"),
                    playLabel: t("practiceQuotesPlay"),
                  }}
                  slideLabels={testimonials.map((testimonial) => testimonial.name)}
                >
                  {testimonials.map((testimonial) => (
                    <TestimonialCard key={testimonial.key} testimonial={testimonial} />
                  ))}
                </Carousel>
              ) : (
                testimonials.map((testimonial) => (
                  <TestimonialCard key={testimonial.key} testimonial={testimonial} />
                ))
              )}
            </Reveal>
          )}

          {video !== "" && (
            // The one column with no content height of its own. Below `lg` it
            // is a 16:9 box; at `lg` the grid row is set by its two
            // neighbours and the footage FILLS that row (`object-cover`
            // behind an absolutely-positioned layer, so the video never
            // decides the row height) — the owner's "same size as the left
            // and right section". `min-h-80` is the floor for a band that
            // lost both neighbours' height to a missing dataset.
            <Reveal variant="up" className="h-full">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted lg:aspect-auto lg:h-full lg:min-h-80">
                {/* The clip's own first frame, painted under it — a still from
                    the SAME footage, so nothing visibly swaps when playback
                    starts, and a reduced-motion reader sees a picture rather
                    than an empty box. An image layer rather than `poster` on
                    `HeroVideo`, whose header explains why the hero has none. */}
                <Image
                  src={HOME_MEDIA.practicePoster}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover"
                />
                <HeroVideo src={video} className="absolute inset-0" />
              </div>
            </Reveal>
          )}

          {shownTools.length > 0 && (
            <Reveal variant="end" className="flex h-full flex-col gap-5">
              <div className="flex flex-col gap-3">
                <h3 className="font-display text-2xl font-bold text-balance">
                  {t("practiceToolsTitle")}
                </h3>
                <p className="text-pretty text-muted-foreground">{t("practiceToolsLead")}</p>
              </div>

              <div>
                <Button render={<Link href={ROUTE_PATHS.tools} />}>
                  {t("practiceToolsCta")}
                  <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
                </Button>
              </div>

              {/* The reference's three icon-labels. Each is a real link to a
                  real calculator — an icon row that only decorates would be
                  three affordances that do nothing. `divide-y` is a rule
                  between rows and needs no directional utility. */}
              <ul className="divide-y rounded-lg border">
                {shownTools.map((tool) => {
                  const Icon = TOOL_ICONS[tool.key];
                  return (
                    <li key={tool.key}>
                      <Link
                        href={toolPath(tool.key)}
                        className="group/tool flex items-center gap-3 p-3 transition-colors duration-(--duration-base) hover:bg-muted/50"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive ring-1 ring-primary/15 transition-colors duration-(--duration-base) group-hover/tool:bg-primary/15">
                          <Icon aria-hidden className="size-4.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium transition-colors duration-(--duration-base) group-hover/tool:text-primary-interactive">
                          {tool.title}
                        </span>
                        <ArrowRight
                          aria-hidden
                          className="hover-arrow size-4 shrink-0 text-muted-foreground rtl:rotate-180"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Named for what it is: the same "view all" the absorbed
                  `popular_tools` band carried at its foot. `mt-auto` pins it to
                  the column's bottom edge, which is what puts it on the same
                  line as the quote's dots and the bottom of the video. */}
              <Link
                href={ROUTE_PATHS.tools}
                className="link-underline mt-auto w-fit text-sm font-medium text-primary-interactive"
              >
                {tTools("home.viewAll")}
              </Link>
            </Reveal>
          )}
        </div>
      </Container>
    </Section>
  );
}
