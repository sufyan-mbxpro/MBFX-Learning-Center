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
      {/* A compact banner. A tool page is not a section front: the reader
          came to type numbers into the widget, and the widget is the band
          directly below this one — at the default `section-lg` height the
          first input sat below the fold on a laptop. `compact` is a height
          change only; the brand fill, the eyebrow and the backdrop all
          stay. */}
      <PageHero
        size="compact"
        eyebrow={t("eyebrow")}
        title={title}
        lead={tagline ?? undefined}
        backdrop={backdrop}
      />

      {/* Intro, widget, explainer and FAQ are ONE band, not four (owner,
          changes-26 #2).

          They were four stacked `Section`s, and two stacked sections each pay
          their own rhythm: `section-md` is `clamp(3rem, 6vw, 5rem)` of
          padding-block, so the gap between the calculator and the paragraph
          explaining it was 160px on a laptop — the widget scrolled out of
          sight before the sentence about it arrived. Rhythm is what separates
          things a reader treats separately, and this is one thing: the tool,
          then what it does. So it pays the rhythm ONCE at its edges and uses a
          gap inside.

          The BAND ORDER is unchanged (ADR-086 #9) — this is spacing, not
          sequence, and `tools-area.test.ts` still reads the order from here. */}
      <Section>
        <Container>
          <div className="flex flex-col gap-10">
            {/* Prose measure is `Container size="narrow"`, never a `max-w-*`
                utility — the utility loses to `.container-page` at equal
                specificity (changes-17's finding, kept). `px-0` because the
                outer Container already paid the gutter. */}
            {intro && (
              <Container size="narrow" className="px-0">
                <RichText html={intro} />
              </Container>
            )}
            {widget}
            {body && (
              <Container size="narrow" className="px-0">
                <RichText html={body} />
              </Container>
            )}
            {/* FaqPanel owns its own heading and renders NOTHING when the list
                is empty — the guard is belt and braces, not a second opinion
                about the empty state. */}
            {faq.length > 0 && (
              <Container size="narrow" className="px-0">
                <FaqPanel title={t("faqTitle")} lead={t("faqLead")} items={faq} />
              </Container>
            )}
          </div>
        </Container>
      </Section>

      {related}
      {readNext}
      {disclaimer}
    </>
  );
}
