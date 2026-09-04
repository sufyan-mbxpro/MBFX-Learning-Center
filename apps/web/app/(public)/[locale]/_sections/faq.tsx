// Homepage FAQ (changes-03-plan.md §6.2) — the reference's accordion block.
// Questions live in the message catalogs (code-style.md #2: interface text
// is catalog-owned), keyed q1..qN so all four locales stay in lockstep and
// `limit` can trim the list without a deploy.
import { getTranslations } from "next-intl/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import type { SectionProps } from "./registry.ts";

// How many q/a pairs exist in the catalogs. A section `limit` trims this;
// it can never exceed it, or t() would throw on a missing key.
const FAQ_COUNT = 4;

export async function Faq({ locale, variant = "accordion", limit }: SectionProps) {
  const t = await getTranslations({ locale, namespace: "home" });
  const count = Math.min(limit ?? FAQ_COUNT, FAQ_COUNT);
  const items = Array.from({ length: count }, (_, i) => ({
    value: `q${i + 1}`,
    question: t(`faqQ${i + 1}` as "faqQ1"),
    answer: t(`faqA${i + 1}` as "faqA1"),
  }));

  const accordion = (
    <Accordion>
      {items.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );

  // `split` puts the heading beside the accordion (the reference's layout);
  // `accordion` stacks them.
  if (variant === "split") {
    return (
      <Section spacing="md">
        <Container className="grid items-start gap-10 lg:grid-cols-2">
          <SectionHeading eyebrow={t("faqEyebrow")} title={t("faqTitle")} lead={t("faqLead")} />
          <Reveal variant="up">{accordion}</Reveal>
        </Container>
      </Section>
    );
  }

  return (
    <Section spacing="md">
      <Container size="narrow" className="flex flex-col gap-(--section-gap)">
        <SectionHeading align="center" eyebrow={t("faqEyebrow")} title={t("faqTitle")} />
        <Reveal variant="up">{accordion}</Reveal>
      </Container>
    </Section>
  );
}
