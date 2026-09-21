import { getTranslations } from "next-intl/server";
import { ExternalLink, Star } from "lucide-react";
import { getSetting } from "@repo/settings";
import { buttonVariants } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";

// "Share your experience" (changes-41, ADR-135).
//
// **A link, not Trustpilot's widget.** The widget is a third-party script:
// it would need a `script-src` exception in the public CSP (security.md #14),
// set cookies on a page that has asked for none, and add client weight to
// every tool page for a row of stars. A button that opens the review page
// does the one thing the band exists for.
//
// **The address is data.** `site.reviewsUrl` is an admin setting, and an
// empty value makes the band ABSENT (ADR-047 §2) rather than a button that
// goes nowhere. The words around it are interface text, so they are catalog
// keys.
export async function ReviewsBand({
  tone = "default",
}: {
  /** Chosen by the page, so the band alternates with its neighbours. */
  tone?: "default" | "muted";
}) {
  const [url, t] = await Promise.all([getSetting("site.reviewsUrl"), getTranslations("public")]);
  if (!url) return null;

  return (
    <Section spacing="lg" tone={tone}>
      <Container size="narrow">
        <Reveal variant="up" className="flex flex-col items-center gap-6 text-center">
          <SectionHeading align="center" title={t("reviews.title")} lead={t("reviews.lead")} />
          {/* A plain anchor dressed as a button, not `Button render={<a>}`:
              that stamps `role="button"` on the anchor, which suits an
              in-app card action and misdescribes a link that leaves the site. */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "lg" })}
          >
            <Star data-icon="inline-start" aria-hidden />
            {t("reviews.cta")}
            <ExternalLink data-icon="inline-end" aria-hidden />
            {/* A new tab is announced, not just drawn. */}
            <span className="sr-only">{t("reviews.newTab")}</span>
          </a>
        </Reveal>
      </Container>
    </Section>
  );
}
