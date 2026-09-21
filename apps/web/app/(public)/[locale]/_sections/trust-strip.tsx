// The trust strip (changes-31, ADR-103).
//
// The reference's row of publication marks under the hero: a small uppercase
// line, then five greyscale wordmarks. Ours renders only from partners the
// owner has actually supplied — a logo is a claim about SOMEONE ELSE, and an
// unearned one misrepresents them, not just us. Empty ⇒ the band is absent
// (ADR-103 §3).
//
// A partner with no `logo` renders as a wordmark set in the display face,
// which is a finished state rather than a missing image: half the marks in the
// reference are wordmarks anyway, and it means an owner can list a real
// partner before anyone has chased down an SVG.
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { HOME_FACTS } from "../_content/home-facts.ts";
import type { SectionProps } from "./registry.ts";

export async function TrustStrip({ locale }: SectionProps) {
  const { partners } = HOME_FACTS;
  if (partners.length === 0) return null;

  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <Section spacing="sm">
      <Container>
        <Reveal variant="fade" className="flex flex-col items-center gap-6">
          <p className="text-2xs tracking-caps text-muted-foreground uppercase">
            {t("trustLabel")}
          </p>
          {/* `flex-wrap` rather than a grid: the count is the owner's and a
              fixed column count would strand a sixth mark on its own row. */}
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
            {partners.map((partner) => {
              const mark = partner.logo ? (
                <Image
                  src={partner.logo}
                  alt={partner.name}
                  width={132}
                  height={32}
                  // Greyscale at rest, the reference's treatment: a row of
                  // full-colour third-party logos competes with the one brand
                  // colour the page is built on. Colour returns on hover only
                  // where the mark is a link and hovering means something.
                  className="h-8 w-auto opacity-60 grayscale transition group-hover/mark:opacity-100 group-hover/mark:grayscale-0"
                />
              ) : (
                <span className="font-display text-lg tracking-caps text-muted-foreground uppercase transition group-hover/mark:text-foreground">
                  {partner.name}
                </span>
              );

              return (
                <li key={partner.key} className="group/mark flex items-center">
                  {partner.href ? (
                    <a
                      href={partner.href}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {mark}
                    </a>
                  ) : (
                    mark
                  )}
                </li>
              );
            })}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}
