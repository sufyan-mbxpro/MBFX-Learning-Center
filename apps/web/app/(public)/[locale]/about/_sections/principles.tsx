// "How we teach" — four editorial commitments, as a tick list.
//
// These are the only claims on this page that are not gated by
// ABOUT_FACTS, and deliberately so: each one describes how the Learning
// Center is written, which is checkable against the content itself. None
// of them asserts a number, a regulator, or anything about MBX beyond
// this site (ADR-047 §2).
import { getTranslations } from "next-intl/server";
import { CheckList } from "@repo/ui/components/check-list";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";

const ITEMS = ["plainLanguage", "workedExamples", "riskIncluded", "notAdvice"] as const;

export async function Principles({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <Section spacing="lg" tone="muted">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-16">
        <Reveal variant="up">
          <SectionHeading
            eyebrow={t("overview.principles.eyebrow")}
            title={t("overview.principles.title")}
            lead={t("overview.principles.lead")}
          />
        </Reveal>
        <Reveal variant="up" delay={80}>
          <CheckList items={ITEMS.map((key) => t(`overview.principles.${key}`))} />
        </Reveal>
      </Container>
    </Section>
  );
}
