import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { getActiveReviewLinks } from "@repo/core";
import { buttonVariants } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { SocialGlyph } from "@repo/ui/components/social-glyph";

// "Share your experience" (changes-41, ADR-135; one button per platform since
// changes-53, ADR-169).
//
// **Links, not the vendors' widgets.** A widget is a third-party script: it
// would need a `script-src` exception in the public CSP (security.md #14),
// set cookies on a page that has asked for none, and add client weight to
// every tool page for a row of stars. A button that opens the review page
// does the one thing the band exists for.
//
// **The platforms are data.** Which of Trustpilot, Google and Facebook are on,
// their order and their links are `review_platforms` rows, edited at
// Settings → General → Reviews. None on makes the band ABSENT (ADR-047 §2)
// rather than a heading over nothing. The words are interface text, so they
// are catalog keys; the brand name inside each label is not translated.
export async function ReviewsBand({
  tone = "default",
}: {
  /** Chosen by the page, so the band alternates with its neighbours. */
  tone?: "default" | "muted";
}) {
  const [links, t] = await Promise.all([getActiveReviewLinks(), getTranslations("public")]);
  if (links.length === 0) return null;

  return (
    <Section spacing="lg" tone={tone}>
      <Container size="narrow">
        <Reveal variant="up" className="flex flex-col items-center gap-6 text-center">
          <SectionHeading align="center" title={t("reviews.title")} lead={t("reviews.lead")} />
          <ul className="flex flex-wrap items-center justify-center gap-3">
            {links.map((link, index) => (
              <li key={link.platform}>
                {/* A plain anchor dressed as a button, not `Button render={<a>}`:
                    that stamps `role="button"` on the anchor, which suits an
                    in-app card action and misdescribes a link that leaves the
                    site. The first platform is the band's main action. */}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-review-platform={link.platform}
                  className={buttonVariants({
                    size: "lg",
                    variant: index === 0 ? "default" : "outline",
                  })}
                >
                  <SocialGlyph name={link.platform} data-icon="inline-start" />
                  {t(`reviews.platforms.${link.platform}`)}
                  <ExternalLink data-icon="inline-end" aria-hidden />
                  {/* A new tab is announced, not just drawn. */}
                  <span className="sr-only">{t("reviews.newTab")}</span>
                </a>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}
