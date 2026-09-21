// Homepage FAQ (changes-03-plan.md §6.2) — the reference's accordion block.
// Questions live in the message catalogs (code-style.md #2: interface text
// is catalog-owned), keyed q1..qN so all four locales stay in lockstep and
// `limit` can trim the list without a deploy.
//
// ─── `columns` — the page's close (changes-35, ADR-116 §1 band E) ────────
//
// The reference ends on a centred heading over a TWO-column accordion, with a
// "view all" beside it. Six pairs rather than four, because two columns of two
// is a thinner block than one column of four — the two added pairs are the
// owner's "add new content where needed".
//
// What belongs in this file and what does not: everything here is interface
// copy ABOUT THE SITE. A claim about a brokerage — a minimum deposit, a
// leverage ratio, a withdrawal window — goes in `SUPPORT_FAQ`, the facts file,
// for the reason ADR-113 gives: a translator should not be the one deciding
// what a withdrawal window says. "All questions" points there.
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import type { SectionProps } from "./registry.ts";

// How many q/a pairs exist in the catalogs. A section `limit` trims this;
// it can never exceed it, or t() would throw on a missing key.
const FAQ_COUNT = 6;

interface FaqItem {
  value: string;
  question: string;
  answer: string;
}

function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Accordion>
      {items.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export async function Faq({ locale, variant = "accordion", limit }: SectionProps) {
  const t = await getTranslations({ locale, namespace: "home" });
  const count = Math.min(limit ?? FAQ_COUNT, FAQ_COUNT);
  const items: FaqItem[] = Array.from({ length: count }, (_, i) => ({
    value: `q${i + 1}`,
    question: t(`faqQ${i + 1}` as "faqQ1"),
    answer: t(`faqA${i + 1}` as "faqA1"),
  }));

  const allLink = (
    <Link
      href={ROUTE_PATHS.support}
      className="link-underline inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary-interactive"
    >
      {t("faqAll")}
      <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
    </Link>
  );

  if (variant === "columns") {
    // Dealt COLUMN-MAJOR: the first half fills the first column, the second
    // the second, so reading down one column and then down the next follows
    // q1..q6 in order. Dealing them alternately would put q2 at the top of the
    // right column, which reads correctly only if you zig-zag.
    const half = Math.ceil(items.length / 2);
    const columns = [items.slice(0, half), items.slice(half)];

    return (
      <Section spacing="md">
        <Container className="flex flex-col gap-(--section-gap)">
          <SectionHeading align="center" eyebrow={t("faqEyebrow")} title={t("faqTitle")} />
          {/* `items-start`: a column whose questions are all collapsed must not
              stretch to the height of the one with an answer open. */}
          <div className="grid grid-cols-1 items-start gap-x-8 gap-y-2 md:grid-cols-2">
            {columns.map((column, index) =>
              column.length > 0 ? (
                // An odd count leaves the second column shorter, which is fine;
                // an empty one must not render an empty accordion shell.
                <Reveal key={index} variant={index === 0 ? "start" : "end"}>
                  <FaqAccordion items={column} />
                </Reveal>
              ) : null,
            )}
          </div>
          <div className="flex justify-center">{allLink}</div>
        </Container>
      </Section>
    );
  }

  // `split` puts the heading beside the accordion (the reference's older
  // layout); `accordion` stacks them.
  if (variant === "split") {
    return (
      <Section spacing="md">
        <Container className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
          <SectionHeading eyebrow={t("faqEyebrow")} title={t("faqTitle")} lead={t("faqLead")} />
          <Reveal variant="up">
            <FaqAccordion items={items} />
          </Reveal>
        </Container>
      </Section>
    );
  }

  return (
    <Section spacing="md">
      <Container size="narrow" className="flex flex-col gap-(--section-gap)">
        <SectionHeading align="center" eyebrow={t("faqEyebrow")} title={t("faqTitle")} />
        <Reveal variant="up">
          <FaqAccordion items={items} />
        </Reveal>
      </Container>
    </Section>
  );
}
