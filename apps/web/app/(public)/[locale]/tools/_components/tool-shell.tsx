import { getTranslations } from "next-intl/server";
import { Container } from "@repo/ui/components/container";
import { FaqPanel } from "@repo/ui/components/faq-panel";
import { RichText } from "@repo/ui/components/rich-text";
import { Section } from "@repo/ui/components/section";
import { PageHero } from "@repo/ui/components/page-hero";

// The six-band flow, in ONE place (ADR-086 #9).
//
// Every tool page is: masthead → widget → explainer → FAQ → related →
// read-next, then the risk disclaimer. Holding the ORDER here is what stops
// eight pages drifting into eight layouts — the same reason `learn`'s sections
// come from a registry rather than from each page.
//
// The band order is code. Every word inside every band is data (ADR-086 #1).
export async function ToolShell({
  title,
  tagline,
  intro,
  body,
  faq,
  backdrop,
  widget,
  related,
  readNext,
  disclaimer,
}: {
  title: string;
  tagline: string | null;
  /** Rich text, already sanitised on save (security.md #8). */
  intro: string | null;
  body: string | null;
  faq: { question: string; answer: string }[];
  backdrop?: React.ReactNode;
  widget: React.ReactNode;
  related?: React.ReactNode;
  readNext?: React.ReactNode;
  disclaimer?: React.ReactNode;
}) {
  const t = await getTranslations("tools");

  return (
    <>
      <PageHero
        eyebrow={t("eyebrow")}
        title={title}
        lead={tagline ?? undefined}
        backdrop={backdrop}
      />

      <Section>
        <Container>
          <div className="flex flex-col gap-8">
            {/* Prose measure is `Container size="narrow"`, never a `max-w-*`
                utility — the utility loses to `.container-page` at equal
                specificity (changes-17's finding, kept). */}
            {intro && (
              <Container size="narrow" className="px-0">
                <RichText html={intro} />
              </Container>
            )}
            {widget}
          </div>
        </Container>
      </Section>

      {body && (
        <Section>
          <Container size="narrow">
            <RichText html={body} />
          </Container>
        </Section>
      )}

      {faq.length > 0 && (
        <Section>
          <Container size="narrow">
            {/* FaqPanel owns its own heading and renders NOTHING when the list
                is empty — the guard above is belt and braces, not a second
                opinion about the empty state. */}
            <FaqPanel title={t("faqTitle")} lead={t("faqLead")} items={faq} />
          </Container>
        </Section>
      )}

      {related}
      {readNext}
      {disclaimer}
    </>
  );
}
