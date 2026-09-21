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

import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { isFeatureVisible } from "@repo/settings";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Carousel } from "@repo/ui/components/carousel";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { cn } from "@repo/ui/lib/utils";

import { HomeMedia } from "../_components/home-media.tsx";
import { HOME_MEDIA } from "../_content/home-media.ts";
import {
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

  // EVERY card is a link now (changes-22). It used to be that a `soon` tile
  // was inert — no link, no `group`, so `.media-zoom`, `.hover-arrow` and the
  // icon flip all stayed still — because the destination had no route and the
  // card would have pointed at a 404. Both `soon` destinations now have a page
  // that says what the section will do and where to go meanwhile, so the card
  // has somewhere honest to send a reader. `live` no longer decides whether
  // the card reacts; it decides what the card PROMISES, which is the "Coming
  // soon" badge in place of the "Explore" arrow.
  const card = (
    <article
      className={cn(
        // `.card-hover` is the shared ring/shadow treatment every card-like
        // surface in the app uses; `.hover-lift` and `.sheen` layer the
        // public-surface emphasis on top of it (ADR-051 §6). `.sheen` sets
        // its own position/overflow/isolation — the classes here would be
        // redundant, but they also document what the surface needs if the
        // sheen is ever dropped.
        "card-hover hover-lift sheen relative isolate flex h-full flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10",
      )}
    >
      {/* changes-35 (ADR-116 §4): four across, not three, so the slot is
          ~330px on a 1400px page rather than ~430px. `sizes` is what decides
          which variant the optimizer serves — left at the 30vw default it
          would ship every card roughly a third more pixels than it paints. */}
      <HomeMedia
        src={HOME_MEDIA[destination.key]}
        icon={Icon}
        tone={tone}
        sizes="(max-width: 640px) 82vw, (max-width: 1024px) 58vw, 23vw"
        className="w-full"
      />

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        {/* `relative z-10` is load-bearing, not decoration. The negative
            margin lifts this row over the media's bottom edge, but the card
            sets `isolate` and the media paints after it in document order —
            without a stacking position of its own the icon badge renders
            UNDER the artwork and only its bottom half is visible. */}
        <div className="relative z-10 -mt-10 flex items-end justify-between gap-3">
          {/* The badge that ties the card's two halves together, and the
              reason the media carries no bottom radius. */}
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-xl shadow-sm ring-4 ring-card transition-transform duration-(--duration-base) ease-(--ease-out-quint)",
              DESTINATION_ICON_CLASS[tone],
              DESTINATION_ICON_HOVER_CLASS[tone],
            )}
          >
            <Icon aria-hidden className="size-5" />
          </span>
          <Badge variant="pill">{copy.tag}</Badge>
        </div>

        <h3 className="text-base font-semibold text-balance text-foreground">{copy.title}</h3>
        {/* Two lines at four across. The body is a card's promise, not its
            documentation — the destination page is where the third sentence
            belongs, and an unclamped one made the tallest card set the height
            of every card in the row. */}
        <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-pretty text-muted-foreground">
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
    // changes-35 (ADR-116 §4): `sm`, not `lg`. The composition is the owner's
    // ("the first The platform section is perfect"); its HEIGHT was not. Every
    // band pays its padding twice — this one's bottom plus the next one's top
    // — so a step down the scale is worth roughly double what it reads as.
    <Section spacing="sm">
      {/* changes-31 / ADR-101 §6: the ambient wash and dot grid are gone.
          Bands separate by TONE down the page now — a muted band, an inverted
          band, the default ground — which is how the reference does it, and
          four bands each painting their own glow was four arguments against a
          design whose whole case is restraint. The utilities stay in
          globals.css for the surfaces that still use them. */}
      <Container className="flex flex-col gap-(--section-gap)">
        {/* The reference's band header: the heading at the inline start and the
            "view all" control on the same baseline at the end, rather than the
            button taking a line of its own under the track. `items-end` is what
            puts the button on the LEAD's baseline instead of the h2's. */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow={t("exploreEyebrow")}
            title={t("exploreTitle")}
            lead={t("exploreLead")}
          />
          {/* `/sitemap`, and it is the only honest target. The reference's
              "View All Properties" goes to the full listing; this band's cards
              are SECTIONS, and the one page that lists every section for a
              person is the reader's sitemap (ADR-110). `/learn` would be one
              of the eight cards promoted over the other seven. */}
          <Button variant="outline" render={<Link href={ROUTE_PATHS.sitemap} />}>
            {t("exploreAll")}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
        </div>
        <Reveal variant="up">
          {variant === "grid" ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((card, index) => (
                <li key={shown[index]?.key}>{card}</li>
              ))}
            </ul>
          ) : (
            <Carousel
              label={t("exploreCarouselLabel")}
              previousLabel={t("exploreCarouselPrevious")}
              nextLabel={t("exploreCarouselNext")}
              // Four across, and the controls are the reference's: two arrows
              // centred under the track. A dot rail under a shelf is one
              // control per destination that nobody counts, and it was the
              // widest thing in the band (ADR-116 §4).
              itemClassName="w-41/50 sm:w-29/50 lg:w-(--width-slide-4)"
              controls="arrows"
              controlsAlign="center"
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
