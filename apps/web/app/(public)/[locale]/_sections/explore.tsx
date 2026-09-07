// "Explore the platform" — the homepage's wayfinding section.
//
// One card per destination the site offers (learning, calculators, the
// economic calendar, news, analysis, the glossary, markets, about), rendered
// either as a scroll-snap carousel (`carousel`, the default) or as a static
// grid (`grid`). Which destinations exist, in what order, with which glyph
// and tone, is `_sections/explore-destinations.ts` — code, per ADR-042.
//
// Server component throughout except the carousel track itself. Every card is
// server-rendered HTML; `Carousel` is the one client island, and it only adds
// controls to a list that already scrolls without it (ADR-018 rule 2).
//
// Feature flags gate each card the same way the header gates its menu rows and
// `LatestAnalysis` gates itself — a disabled feature does not advertise itself
// on the homepage and then 404 when clicked.
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@repo/i18n/navigation";
import { isFeatureVisible } from "@repo/settings";
import { Badge } from "@repo/ui/components/badge";
import { Carousel } from "@repo/ui/components/carousel";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { cn } from "@repo/ui/lib/utils";

import { HomeMedia } from "../_components/home-media.tsx";
import { HOME_MEDIA } from "../_content/home-media.ts";
import {
  DESTINATION_BAR_CLASS,
  DESTINATION_ICON_CLASS,
  DESTINATION_ICON_HOVER_CLASS,
  destinationHref,
  EXPLORE_DESTINATIONS,
  type ExploreDestination,
} from "./explore-destinations.ts";
import type { SectionProps } from "./registry.ts";

/** `learn` → `Learn`, so one destination key addresses three catalog entries. */
function catalogKey(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

interface CardCopy {
  title: string;
  body: string;
  tag: string;
  cta: string;
  soon: string;
}

function DestinationCard({
  destination,
  copy,
}: {
  destination: ExploreDestination;
  copy: CardCopy;
}) {
  const { icon: Icon, tone, status } = destination;
  const live = status === "live";

  // `group` goes on the LINK, never on a `soon` tile: `.media-zoom`,
  // `.hover-arrow` and the icon flip all key off `.group:hover`, so leaving it
  // off is what makes a non-clickable card visually inert. A card that reacts
  // to the pointer and then does nothing is the promise IconCard's own
  // `interactive` default exists to avoid making.
  const card = (
    <article
      className={cn(
        // `.card-hover` is the shared ring/shadow treatment every card-like
        // surface in the app uses; `.hover-lift` and `.sheen` layer the
        // public-surface emphasis on top of it (ADR-051 §6). `.sheen` sets
        // its own position/overflow/isolation — the classes here would be
        // redundant, but they also document what the surface needs if the
        // sheen is ever dropped.
        "card-hover relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10",
        live && "hover-lift sheen hover:ring-primary/25",
      )}
    >
      {/* Top rule sweeping from the inline start — `start-0` + `w-0` →
          `w-full` so it runs the correct way in RTL with no [dir] rule.
          Every animated property lives on a CHILD, never on the card:
          `.card-hover` declares its own `transition-property` and, sitting
          later in `@layer utilities` than Tailwind's generated classes, it
          beats any transition utility written in the class attribute — a
          hover transform on the card itself would jump rather than glide. */}
      {live && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0 start-0 z-20 h-1 w-0 transition-[width] duration-(--duration-slow) ease-(--ease-out-quint) group-hover:w-full",
            DESTINATION_BAR_CLASS[tone],
          )}
        />
      )}

      <HomeMedia src={HOME_MEDIA[destination.key]} icon={Icon} tone={tone} className="w-full" />

      <div className="flex flex-1 flex-col gap-3 p-6">
        {/* `relative z-10` is load-bearing, not decoration. The negative
            margin lifts this row over the media's bottom edge, but the card
            sets `isolate` and the media paints after it in document order —
            without a stacking position of its own the icon badge renders
            UNDER the artwork and only its bottom half is visible. */}
        <div className="relative z-10 -mt-12 flex items-end justify-between gap-3">
          {/* The badge that ties the card's two halves together, and the
              reason the media carries no bottom radius. */}
          <span
            className={cn(
              "flex size-12 items-center justify-center rounded-xl shadow-sm ring-4 ring-card transition-colors duration-(--duration-base) ease-(--ease-out-quint)",
              DESTINATION_ICON_CLASS[tone],
              live && DESTINATION_ICON_HOVER_CLASS[tone],
            )}
          >
            <Icon aria-hidden className="size-6" />
          </span>
          <Badge variant="pill">{copy.tag}</Badge>
        </div>

        <h3 className="text-lg font-semibold text-balance text-foreground">{copy.title}</h3>
        <p className="flex-1 text-sm leading-relaxed text-pretty text-muted-foreground">
          {copy.body}
        </p>

        {live ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-interactive">
            {copy.cta}
            <ArrowRight aria-hidden className="hover-arrow size-4 rtl:rotate-180" />
          </span>
        ) : (
          <Badge variant="outline" className="w-fit">
            {copy.soon}
          </Badge>
        )}
      </div>
    </article>
  );

  if (!live) return card;

  return (
    <Link href={destinationHref(destination)} className="group block h-full">
      {card}
    </Link>
  );
}

export async function Explore({ locale, variant = "carousel", limit }: SectionProps) {
  const t = await getTranslations({ locale, namespace: "home" });

  // Resolved in parallel rather than in sequence: eight awaited flag reads on
  // the critical path of the homepage is exactly the kind of waterfall the
  // Lighthouse budget on this surface exists to catch.
  const visibility = await Promise.all(
    EXPLORE_DESTINATIONS.map((destination) =>
      destination.feature === null ? true : isFeatureVisible(destination.feature, null),
    ),
  );

  const shown = EXPLORE_DESTINATIONS.filter((_, index) => visibility[index]).slice(
    0,
    limit ?? EXPLORE_DESTINATIONS.length,
  );
  // Every flag off is a legitimate configuration, not an error state — render
  // nothing rather than an empty carousel with dead controls.
  if (shown.length === 0) return null;

  const cards = shown.map((destination) => {
    const suffix = catalogKey(destination.key);
    return (
      <DestinationCard
        key={destination.key}
        destination={destination}
        copy={{
          // The cast is the FAQ section's existing idiom: the catalog keys are
          // generated from a closed registry, so the string is always real,
          // but `t()`'s key type cannot see that.
          title: t(`explore${suffix}Title` as "exploreLearnTitle"),
          body: t(`explore${suffix}Body` as "exploreLearnBody"),
          tag: t(`explore${suffix}Tag` as "exploreLearnTag"),
          cta: t("exploreCta"),
          soon: t("exploreSoon"),
        }}
      />
    );
  });

  return (
    <Section spacing="lg" className="relative isolate overflow-hidden">
      {/* The ambient wash is its own element rather than a class on Section:
          Section composes its tone (`bg-background`) with `className` through
          `cn`, and twMerge treats `bg-glow-primary` as a `bg-*` utility that
          conflicts with it. A dedicated layer is what the footer already does
          for the same reason, and it also lets the two backdrops carry
          different opacities. */}
      <span aria-hidden className="bg-glow-primary pointer-events-none absolute inset-0 -z-10" />
      <span
        aria-hidden
        className="bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-[0.12] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]"
      />
      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading
          eyebrow={t("exploreEyebrow")}
          title={t("exploreTitle")}
          lead={t("exploreLead")}
        />
        <Reveal variant="up">
          {variant === "grid" ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((card, index) => (
                <li key={shown[index]?.key}>{card}</li>
              ))}
            </ul>
          ) : (
            <Carousel
              label={t("exploreCarouselLabel")}
              previousLabel={t("exploreCarouselPrevious")}
              nextLabel={t("exploreCarouselNext")}
              slideLabels={shown.map((destination) =>
                t(`explore${catalogKey(destination.key)}Title` as "exploreLearnTitle"),
              )}
            >
              {cards}
            </Carousel>
          )}
        </Reveal>
      </Container>
    </Section>
  );
}
