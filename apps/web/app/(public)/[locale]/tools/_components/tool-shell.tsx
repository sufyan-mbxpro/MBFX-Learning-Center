import { getTranslations } from "next-intl/server";
import type { ToolHighlight } from "@repo/contracts";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Card, CardContent } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { FaqPanel } from "@repo/ui/components/faq-panel";
import { RichText } from "@repo/ui/components/rich-text";
import { Section } from "@repo/ui/components/section";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal, RevealGroup } from "@repo/ui/components/reveal";
import { TOOL_HIGHLIGHT_ICON_COMPONENTS } from "../../../../_lib/tool-highlight-icons.ts";

// The band flow, in ONE place (ADR-086 #9, reshaped by ADR-114).
//
// Every tool page is: masthead → (widget + common questions | explainer) →
// highlights → reviews →
// related → read-next. Holding the ORDER here is what stops
// eight pages drifting into eight layouts — the same reason `learn`'s sections
// come from a registry rather than from each page.
//
// No risk disclaimer band (changes-38, ADR-122): the disclaimer is printed
// once, by the footer, on every page — not again at the foot of a tool.
//
// The band order is code. Every word inside every band is data (ADR-086 #1).
export async function ToolShell({
  title,
  tagline,
  intro,
  body,
  faq,
  highlights,
  backdrop,
  widget,
  related,
  reviews,
  readNext,
}: {
  title: string;
  tagline: string | null;
  /** Rich text, already sanitised on save (security.md #8). */
  intro: string | null;
  body: string | null;
  faq: { question: string; answer: string }[];
  /** PLAIN text (ADR-114 #3) — printed, never parsed. */
  highlights: ToolHighlight[];
  backdrop?: React.ReactNode;
  widget: React.ReactNode;
  related?: React.ReactNode;
  /** "Share your experience" (ADR-135) — between the argument and the reading. */
  reviews?: React.ReactNode;
  readNext?: React.ReactNode;
}) {
  const t = await getTranslations("tools");

  return (
    <>
      {/* A compact banner. A tool page is not a section front: the reader
          came to type numbers into the widget, and the widget is the band
          directly below this one — at the default `section-lg` height the
          first input sat below the fold on a laptop. `compact` is a height
          change only; the fill, the eyebrow and the backdrop all stay. (A
          tool page passes a backdrop only when its editor uploaded a Cover
          image — ADR-117's photo tone follows the artwork, and a tool
          without one keeps the `brand` fill `PageHero` falls back to.) */}
      <PageHero
        size="compact"
        eyebrow={t("eyebrow")}
        title={title}
        lead={tagline ?? undefined}
        backdrop={backdrop}
        // The reference's masthead is textured, not flat (changes-41). The
        // design system's version of that is the chart motif, CSS-only and
        // masked away from the headline; a tool with a Cover photo keeps the
        // photograph on its own.
        motif={backdrop ? undefined : <AmbientMotif variant="chart" intensity={0.7} />}
      />

      {/* The calculator and its explanation, side by side (ADR-114 #1).
          They were stacked, which put "what is a pip?" below the fold at
          exactly the moment it was wanted: while a reader looks at a field
          labelled "trade size" and decides what to type.

          Still ONE `Section`, which is changes-26 #2's finding and still the
          reason: two stacked sections each pay `section-md`
          (`clamp(3rem, 6vw, 5rem)`), so the calculator and the paragraph about
          it were 160px apart on a laptop. Rhythm separates things a reader
          treats separately, and this is one thing.

          `items-start` so the explainer column does not stretch to the
          widget's height and leave a card with 200px of empty ground under
          its last line. */}
      <Section>
        <Container>
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-(--grid-3-2)">
            {/* The entrance the owner's reference uses (changes-41): the
                calculator arrives from the start edge and its explainer from
                the end, so the two read as a pair. `start`/`end` rather than
                left/right — both flip under RTL. Server components with no
                client JS of their own; the one observer island is the root
                layout's. `min-w-0` moves to the Reveal because IT is now the
                grid item. */}
            <Reveal variant="start" className="flex min-w-0 flex-col gap-6">
              {widget}
              {/* Common questions sit UNDER the calculator, in its own column
                  and at its width (owner, 2026-09-18). As the last card of the
                  explainer stack they began far below the widget's foot and
                  read as more explanation rather than as what a reader asks
                  after using the tool; full width broke the two-column page.

                  FaqPanel owns its own heading and renders NOTHING when the
                  list is empty — the guard is belt and braces, not a second
                  opinion about the empty state. */}
              {faq.length > 0 && (
                <FaqPanel title={t("faqTitle")} lead={t("faqLead")} items={faq} />
              )}
            </Reveal>

            {/* `aside`, not a second `div`: it is supporting material for the
                thing beside it, which is what the element means and what a
                screen reader's landmark list is for. */}
            <Reveal variant="end" className="min-w-0">
              <aside className="flex min-w-0 flex-col gap-6">
                {intro && (
                  <Card>
                    <CardContent>
                      <RichText html={intro} />
                    </CardContent>
                  </Card>
                )}
                {body && (
                  <Card>
                    <CardContent>
                      <RichText html={body} />
                    </CardContent>
                  </Card>
                )}
              </aside>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* Why this tool exists (ADR-114 #3), for the reader who arrived from a
          search result and has not decided to use it yet.

          It pays its OWN rhythm, unlike the explainer above: the calculator
          band is the page, and this is the page's argument for itself — two
          things a reader treats separately, which is exactly when a section
          break is correct. `muted` gives it a ground of its own so the
          argument does not read as more explainer.

          Absent when empty (ADR-047 §2 rule 1), and the seed fills it for all
          eight tools — a gate on a collection nobody fills is what ADR-113
          was written about. */}
      {highlights.length > 0 && (
        <Section tone="muted">
          <Container>
            <div className="flex flex-col gap-8">
              {/* "Why use {tool}?", with no definite article. Two of the eight
                  titles are not "the X" noun phrases — "Forex Market Hours",
                  "Currency Correlation" — and "Why use the Forex Market
                  Hours?" is the sentence a reader stops on. Without the
                  article every title reads as a product name, which is what
                  they are. */}
              <Reveal variant="up">
                <h2 className="text-center text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                  {t("highlights.title", { tool: title })}
                </h2>
              </Reveal>
              {/* Staggered, as the reference's four cards are. RevealGroup IS
                  the grid (its own note says why), so the list semantics move
                  to `role="list"` on it and `role="listitem"` on each card. */}
              <RevealGroup
                variant="up"
                role="list"
                className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4"
              >
                {highlights.map((highlight, index) => {
                  const Icon = TOOL_HIGHLIGHT_ICON_COMPONENTS[highlight.icon];
                  return (
                    // Order is identity: these rows carry no id of their own,
                    // as in `@repo/blocks`' faq block and the FAQ above.
                    <div
                      key={index}
                      role="listitem"
                      className="flex flex-col items-center gap-3 text-center"
                    >
                      <span
                        aria-hidden
                        className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive"
                      >
                        <Icon className="size-6" />
                      </span>
                      <h3 className="font-semibold">{highlight.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {highlight.text}
                      </p>
                    </div>
                  );
                })}
              </RevealGroup>
            </div>
          </Container>
        </Section>
      )}

      {reviews}
      {related}
      {readNext}
    </>
  );
}
