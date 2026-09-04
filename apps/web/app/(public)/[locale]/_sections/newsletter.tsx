// Homepage newsletter CTA band (changes-03-plan.md §6.2). Reuses the
// CtaBand primitive; `full-width` bleeds edge-to-edge, `default` sits
// inside the page container as a rounded panel.
import { getTranslations } from "next-intl/server";
import { getSetting } from "@repo/settings";
import { CtaBand } from "@repo/ui/components/cta-band";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { NewsletterForm } from "../_components/newsletter-form.tsx";
import type { SectionProps } from "./registry.ts";

export async function Newsletter({ locale, variant = "full-width" }: SectionProps) {
  const [t, enabled] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getSetting("footer.newsletterEnabled"),
  ]);
  // One switch for the whole newsletter feature — the footer form reads the
  // same setting, so an admin turning it off removes both.
  if (!enabled) return null;

  const tFooter = await getTranslations({ locale, namespace: "footer" });

  return (
    <Section spacing="md">
      <Reveal variant="up">
        {/* CtaBand's `default` variant already carries .container-page —
            wrapping it in <Container> too would nest the gutter twice. */}
        <CtaBand
          variant={variant === "default" ? "default" : "full-width"}
          title={t("newsletterTitle")}
          description={t("newsletterBody")}
        >
          <div className="w-full sm:w-80">
            <NewsletterForm
              tone="onFill"
              id="newsletter-band-unavailable"
              placeholder={tFooter("newsletterPlaceholder")}
              label={tFooter("newsletterLabel")}
              submitLabel={tFooter("newsletterSubmit")}
              unavailableLabel={tFooter("newsletterUnavailable")}
            />
          </div>
        </CtaBand>
      </Reveal>
    </Section>
  );
}
