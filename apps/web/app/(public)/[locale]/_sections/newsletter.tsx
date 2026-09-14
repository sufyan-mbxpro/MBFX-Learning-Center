// Homepage newsletter CTA band (changes-03-plan.md §6.2). Reuses the
// CtaBand primitive; `full-width` bleeds edge-to-edge, `default` sits
// inside the page container as a rounded panel.
import { getTranslations } from "next-intl/server";
import { isFeatureVisible } from "@repo/settings";
import { isNewsletterPlacementEnabled } from "@repo/core";
import { CtaBand } from "@repo/ui/components/cta-band";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { NewsletterForm } from "../_components/newsletter-form.tsx";
import { newsletterFormLabels } from "../_components/newsletter-labels.ts";
import type { SectionProps } from "./registry.ts";

export async function Newsletter({ locale, variant = "full-width" }: SectionProps) {
  // TWO switches, and they mean different things (ADR-080 #5): the `newsletter`
  // FLAG decides whether signup exists at all, and the placement SETTING
  // decides whether it is drawn here. This used to read one setting,
  // `footer.newsletterEnabled`, which F7 deleted — it lived in the `layout`
  // group ADR-038 paused, so it had become uneditable.
  const [enabled, placed] = await Promise.all([
    isFeatureVisible("newsletter", null),
    isNewsletterPlacementEnabled("home"),
  ]);
  if (!enabled || !placed) return null;

  const [t, tFooter] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "footer" }),
  ]);

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
              locale={locale}
              source="home"
              labels={newsletterFormLabels(tFooter)}
            />
          </div>
        </CtaBand>
      </Reveal>
    </Section>
  );
}
