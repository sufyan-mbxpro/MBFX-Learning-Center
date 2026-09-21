// The testimonials band (changes-31, ADR-103).
//
// Owner-supplied, and empty until it is (ADR-103 §3). The quote, the name and
// the role are all facts about a real person, so none of the three is a
// catalog string — a translated testimonial is a testimonial nobody gave. Only
// the band's own heading and eyebrow come from `home.*`.
//
// Static content, not an entity: no model, no admin screen. ADR-103 says so
// deliberately rather than creating a half-model to grow into.
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Quote } from "lucide-react";
import { Card, CardContent } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { RevealGroup } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { HOME_FACTS } from "../_content/home-facts.ts";
import type { SectionProps } from "./registry.ts";

export async function Testimonials({ locale, limit }: SectionProps) {
  const { testimonials } = HOME_FACTS;
  if (testimonials.length === 0) return null;

  const t = await getTranslations({ locale, namespace: "home" });
  const shown = limit ? testimonials.slice(0, limit) : testimonials;

  return (
    <Section spacing="lg">
      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading
          eyebrow={t("testimonialsEyebrow")}
          title={t("testimonialsTitle")}
          lead={t("testimonialsLead")}
        />
        {/* RevealGroup IS the grid (see its own comment): each card's wrapper
            is the grid item, and the ladder gives the row one direction
            instead of three separate arrivals. */}
        <RevealGroup className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((testimonial) => (
            <Card
              key={testimonial.key}
              // ADR-101 §4: the public card is separated by air.
              variant="plain"
              className="h-full bg-muted/50"
            >
              <CardContent className="h-full">
                {/* A figure, because a figcaption is only a figcaption inside
                    one — the attribution is not part of the quotation. */}
                <figure className="flex h-full flex-col gap-5">
                  {/* The reference's oversized opening mark. Mirrored in RTL,
                      where a quotation opens on the other side. */}
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
                        {/* The initial, not a stock portrait: a generated face
                            beside a real person's words is the one placeholder
                            that reads as a lie. */}
                        {testimonial.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {testimonial.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {testimonial.role}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              </CardContent>
            </Card>
          ))}
        </RevealGroup>
      </Container>
    </Section>
  );
}
