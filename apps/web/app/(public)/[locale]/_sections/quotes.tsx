// The homepage's closing quotation band (changes-28 PR 3, ADR-093).
//
// The brief's images 48 and 53: oversized opening and closing marks in the
// brand colour, the words large and centred between them, the attribution
// small and set to the inline end.
//
// Two variants. `single` shows the day's quote — deterministic, from
// `quoteOfTheDay`, the same no-cron-no-column technique the glossary's term of
// the day already uses. `carousel` shows all of them in the existing
// scroll-snap rail, for a page that would rather offer the set than pick.
//
// ─── The marks are decoration, and are marked as such ─────────────────────
//
// The visible “ ” glyphs are `aria-hidden`. A screen reader reading a
// `<blockquote>` already announces it as a quotation, and a literal
// left-double-quotation-mark read aloud before every quote is noise. The
// attribution is a `<figcaption>` inside a `<figure>`, which is the pairing
// the HTML spec names for exactly this — not a `<p>` that happens to sit
// underneath.
import { getTranslations } from "next-intl/server";
import { Quote } from "lucide-react";

import { Carousel } from "@repo/ui/components/carousel";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";

import { HOME_QUOTES, loadQuoteOfTheDay, type HomeQuote } from "../_content/home-quotes.ts";
import type { SectionProps } from "./registry.ts";

function QuoteFigure({ text, attribution }: { text: string; attribution: string }) {
  return (
    <figure className="flex flex-col items-center gap-6 text-center">
      <blockquote className="relative flex items-start justify-center gap-3 sm:gap-5">
        {/* `-scale-x-100` rather than a second icon: lucide ships one Quote
            glyph, and the closing mark is the opening one mirrored. It flips
            along the same axis in both directions, so RTL needs no rule of
            its own. */}
        <Quote
          aria-hidden
          className="size-8 shrink-0 -scale-x-100 fill-current text-primary/70 sm:size-11"
        />
        <p className="max-w-3xl text-2xl font-medium text-balance text-primary-interactive sm:text-3xl">
          {text}
        </p>
        <Quote aria-hidden className="size-8 shrink-0 fill-current text-primary/70 sm:size-11" />
      </blockquote>
      {/* The dash before the name lives in the catalog (`quoteAttribution`,
          "— {author}") rather than being concatenated here: punctuation around
          a name is a typographic decision, and it is not the same mark in
          every script this site serves. */}
      <figcaption className="text-sm font-medium text-muted-foreground">{attribution}</figcaption>
    </figure>
  );
}

export async function Quotes({ locale, variant = "single", limit }: SectionProps) {
  const t = await getTranslations({ locale, namespace: "home" });

  const textOf = (quote: HomeQuote) =>
    t(`quote${quote.key.charAt(0).toUpperCase()}${quote.key.slice(1)}Text` as "quoteRiskText");

  const shown: readonly HomeQuote[] =
    variant === "carousel"
      ? HOME_QUOTES.slice(0, limit ?? HOME_QUOTES.length)
      : [await loadQuoteOfTheDay()];

  return (
    <Section tone="muted" spacing="md" className="relative isolate overflow-hidden">
      {/* The one piece of depth this band gets. A quote is the quietest thing
          on the page and a card would make it the loudest. */}
      <span aria-hidden className="bg-glow-primary pointer-events-none absolute inset-0 -z-10" />
      <Container>
        <Reveal variant="up">
          {variant === "carousel" && shown.length > 1 ? (
            <Carousel
              label={t("quoteCarouselLabel")}
              previousLabel={t("quoteCarouselPrevious")}
              nextLabel={t("quoteCarouselNext")}
              slideLabels={shown.map((quote) => quote.author)}
              itemClassName="w-full"
            >
              {shown.map((quote) => (
                <QuoteFigure
                  key={quote.key}
                  text={textOf(quote)}
                  attribution={t("quoteAttribution", { author: quote.author })}
                />
              ))}
            </Carousel>
          ) : (
            shown.map((quote) => (
              <QuoteFigure
                key={quote.key}
                text={textOf(quote)}
                attribution={t("quoteAttribution", { author: quote.author })}
              />
            ))
          )}
        </Reveal>
      </Container>
    </Section>
  );
}
