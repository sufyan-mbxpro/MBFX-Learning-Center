// Homepage hero (changes-03-plan.md §6.2, redesigned by changes-31) — three
// layout variants from one component, chosen by the admin-set `variant` on the
// home.sections descriptor. Copy comes from the catalogs and site.description
// (an admin-editable setting), never hardcoded.
//
// ─── The band is a slider of ARTICLES (ADR-140 §2) ───────────────────────
//
// For a while this band was static: one piece of footage and the site's own
// words, reading no service at all. The owner then asked for "a full page
// slider from the articles… remove the video", with the rest of the design
// unchanged. So the `split` variant now reads the same spotlight set /news
// leads with (`getSpotlightArticles`, featured first, then topped up). It
// composes the article module's own published rule instead of writing a
// fresh one, which is the ADR-108 lesson: a band with its own idea of
// "public" is a way to surface drafts.
//
// Both feature flags gate it. A kind whose section is off contributes no
// slide, and NO slide at all falls back to the static band on its
// `--secondary` fill, so an install that publishes nothing opens exactly as
// it did, minus the footage.
//
// changes-31 / ADR-101: the ambient devices are gone. `.bg-glow-primary`, the
// dot grid and `AmbientMotif` were changes-20's, and the reference this page
// now follows has none of them — a glow is the loudest thing on a page whose
// whole argument is restraint. The utilities stay in globals.css for the
// surfaces that still use them; only this band stopped calling them.
//
// ADR-104 §6: the band carries no `Reveal`, because it holds the page's
// largest first paint and an element behind an animation that starts at
// `opacity: 0` reports its paint when the animation ends. For the same reason
// the FIRST slide's cover is the one image on the page with `priority`.
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Lightbulb, LineChart, Newspaper } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSpotlightArticles, type ArticleListEntry } from "@repo/core";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Link } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { HeroSlider } from "../_components/hero-slider.tsx";
import { QuickStartBanner } from "../_components/quick-start-banner.tsx";
import { canOptimizeImage } from "../_lib/image-optimizer.ts";
import type { SectionProps } from "./registry.ts";

/** Enough to be a slideshow, few enough that the last one is ever seen. */
const SLIDE_COUNT = 5;

// A cover-less article's slide shows its kind's glyph, large and faint, on
// the band's own fill: the same kind → glyph mapping /news uses for a card.
const KIND_GLYPH: Record<string, LucideIcon> = {
  NEWS: Newspaper,
  ANALYSIS: LineChart,
  TRADE_IDEA: Lightbulb,
};

async function loadSlides(locale: string): Promise<ArticleListEntry[]> {
  const [news, analysis] = await Promise.all([
    isFeatureVisible("news", null),
    isFeatureVisible("analysis", null),
  ]);
  const kinds: Parameters<typeof getSpotlightArticles>[1]["kinds"] = [
    ...(news ? (["NEWS"] as const) : []),
    ...(analysis ? (["ANALYSIS", "TRADE_IDEA"] as const) : []),
  ];
  if (kinds.length === 0) return [];
  return getSpotlightArticles(locale, { kinds, limit: SLIDE_COUNT });
}

export async function Hero({ locale, variant = "split" }: SectionProps) {
  // site.description is admin-editable and deliberately DIFFERENT content
  // from the hero title — site.tagline duplicated the title's wording and
  // rendered the same sentence twice.
  const [t, description] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getSetting("site.description"),
  ]);

  const body = description ?? t("heroBody");

  const actions = (
    <>
      {/* ADR-101 §5, now ADR-107: the tailored rectangle. There is no longer a
          pill to opt out of — the shape was removed once the public surface
          had thirty-four call sites still passing it. */}
      <Button size="xl" render={<Link href="/learn" />}>
        {t("heroPrimaryCta")}
        <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
      </Button>
      <Button size="xl" variant="outline" render={<Link href="/glossary" />}>
        {t("heroSecondaryCta")}
      </Button>
    </>
  );

  const copy = (
    <div className="flex flex-col gap-6">
      <Badge variant="eyebrow" className="self-start">
        {t("heroEyebrow")}
      </Badge>
      {/* ADR-102 §3 / §5: the display face at its own weight. A serif cut for
          this size carries its own colour on the page, and bolding it is what
          makes a display face read as a UI label that grew. */}
      <h1 className="font-display text-display-lg font-normal tracking-tight text-balance">
        {t("heroTitle")}
      </h1>
      <p className="max-w-xl text-lg text-pretty text-muted-foreground">{body}</p>
      <div className="flex flex-wrap gap-3">{actions}</div>
    </div>
  );

  if (variant === "centered") {
    return (
      <Section spacing="lg">
        <Container size="narrow" className="flex flex-col items-center gap-6 text-center">
          <Badge variant="eyebrow">{t("heroEyebrow")}</Badge>
          <h1 className="font-display text-display-lg font-normal tracking-tight text-balance">
            {t("heroTitle")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{body}</p>
          <div className="flex flex-wrap justify-center gap-3">{actions}</div>
        </Container>
      </Section>
    );
  }

  if (variant === "background") {
    return (
      <Section tone="muted" spacing="lg">
        <Container>{copy}</Container>
      </Section>
    );
  }

  // `split` — the seeded variant: a full-bleed slider of articles, with the
  // quick-start panel floated across its bottom edge exactly as before.
  const [articles, tNews] = await Promise.all([
    loadSlides(locale),
    getTranslations({ locale, namespace: "news" }),
  ]);
  const kindLabels: Record<string, string> = {
    NEWS: tNews("kindNews"),
    ANALYSIS: tNews("kindAnalysis"),
    TRADE_IDEA: tNews("kindTradeIdea"),
  };

  // The scrim is what makes text over a cover safe. A cover is whatever an
  // editor uploaded, so nothing can assume what is behind the words: the
  // gradient runs from FULLY OPAQUE `--secondary` at the inline start and the
  // copy sits inside that opaque zone (ADR-117's guarantee over an arbitrary
  // photograph). It is the token pair `Section tone="inverted"` uses, so the
  // ink is the engine's own answer for that fill in both modes.
  const scrim = (
    <span
      aria-hidden
      // Vertical below `lg` (the copy has the full width there), horizontal
      // above it. A gradient direction has no logical form in Tailwind, so the
      // RTL flip is written out.
      className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-secondary via-secondary/85 to-secondary/30 lg:bg-gradient-to-r lg:from-secondary lg:via-secondary/80 lg:to-transparent rtl:lg:bg-gradient-to-l"
    />
  );

  const slides = articles.map((article, index) => {
    const Glyph = KIND_GLYPH[article.kind] ?? Newspaper;
    const cover = article.coverImageUrl;
    // The first slide carries the page's only h1; the rest are h2, so a
    // screen reader's heading list does not open on five top-level headings.
    const Heading = index === 0 ? "h1" : "h2";
    return (
      // Bottom-aligned, not centred: the button row has to sit at a FIXED
      // distance from the band's edge so the slider's controls can share its
      // row (changes-43), whatever length the headline above it runs to.
      <div key={article.articleId} className="relative isolate flex w-full items-end">
        <span aria-hidden className="absolute inset-0 -z-10 bg-secondary">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="100vw"
              priority={index === 0}
              unoptimized={!canOptimizeImage(cover)}
              className="object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-end pe-16 text-secondary-foreground/10 xl:pe-32">
              <Glyph className="size-80 max-lg:hidden" />
            </span>
          )}
        </span>
        {scrim}
        {/* The bottom padding clears the floated panel. From `lg` the
            slider's controls sit beside the buttons, on the same line as them
            (`hero-slider.tsx` mirrors `lg:pb-28`); below it the buttons wrap,
            so the controls get their own row underneath (`pb-40`). */}
        <Container className="pt-12 pb-40 lg:pb-28">
          <div className="flex max-w-2xl flex-col items-start gap-5 text-secondary-foreground">
            <Badge variant="marker">{article.category?.name ?? kindLabels[article.kind]}</Badge>
            <Heading className="line-clamp-2 font-display text-display-lg font-bold tracking-tight text-balance">
              {article.title}
            </Heading>
            {article.excerpt && (
              <p className="line-clamp-2 max-w-xl text-lg text-pretty text-secondary-foreground/80">
                {article.excerpt}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button size="xl" render={<Link href={`/news/${article.slug}`} />}>
                {t("heroSliderRead")}
                <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
              </Button>
              <Button size="xl" variant="inverted" render={<Link href="/learn" />}>
                {t("heroPrimaryCta")}
              </Button>
            </div>
          </div>
        </Container>
      </div>
    );
  });

  const total = slides.length;
  return (
    <div className="relative">
      {total === 0 ? (
        // Nothing published (or both sections off): the static band on its
        // fill. A homepage must never open on an empty slider.
        <div className="relative isolate flex min-h-(--height-hero) items-center overflow-hidden bg-secondary">
          <Container className="pt-12 pb-28">
            <div className="flex max-w-2xl flex-col items-start gap-5 text-secondary-foreground">
              <Badge variant="marker">{t("heroEyebrow")}</Badge>
              <h1 className="font-display text-display-lg font-bold tracking-tight text-balance">
                {t("heroTitle")}
              </h1>
              <p className="max-w-xl text-lg text-pretty text-secondary-foreground/80">{body}</p>
              <div className="flex flex-wrap gap-3">
                <Button size="xl" render={<Link href="/learn" />}>
                  {t("heroPrimaryCta")}
                  <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
                </Button>
                <Button size="xl" variant="inverted" render={<Link href="/glossary" />}>
                  {t("heroSecondaryCta")}
                </Button>
              </div>
            </div>
          </Container>
        </div>
      ) : (
        <HeroSlider
          slides={slides}
          labels={{
            region: t("heroSliderLabel"),
            previous: t("heroSliderPrevious"),
            next: t("heroSliderNext"),
            positions: slides.map((_, i) => t("heroSliderPosition", { index: i + 1, total })),
            goTo: slides.map((_, i) => t("heroSliderGoTo", { index: i + 1, total })),
          }}
        />
      )}

      {/* Pulled up across the band's bottom edge rather than positioned over
          it: `-mt-*` leaves the panel in the flow, so the section below starts
          underneath it instead of sliding behind it. */}
      {/* `rise-enter` (changes-46): a load entrance, never a scroll reveal —
          the panel is inside the first screen and must not wait for one. */}
      <div className="rise-enter relative z-10 -mt-14 sm:-mt-16">
        <QuickStartBanner locale={locale} />
      </div>
    </div>
  );
}
