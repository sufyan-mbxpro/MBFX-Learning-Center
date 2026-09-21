// The ONE FAQ treatment on a public detail page.
//
// changes-22 gave /news's FAQ its own surface: sitting on the page background
// under the body it read as more article, and the accordion's triggers were
// the only sign that the content had changed KIND. The glossary term page
// carried the same block and had never had that pass — same words, a flat
// `<dl>`, no surface — so the owner reported the same thing twice. Fixing it
// in place would have left a third detail page free to invent a fourth shape,
// so the treatment is a component and both call sites use it.
//
// What makes it read as a different kind of content, in order of how early a
// reader notices it: a tinted surface with its own ring, a labelled icon, and
// only then the accordion. The tint is `bg-muted/40` — the page's existing
// second surface (`Section tone="muted"`), not a new one.
//
// `format` is the only thing the two call sites disagree about. An article's
// answers are sanitized rich text from the editor; a glossary term's are plain
// textarea text stored unparsed. Both render here so the answer's prose
// styling has one home and cannot drift between the two pages.
//
// Sanitization is the SAVE path's job (ADR-009 / security.md #8) — `format`
// selects a renderer, it is not a trust boundary.
import { MessageCircleQuestionMark } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";
import { cn } from "@repo/ui/lib/utils";

export type FaqPanelItem = {
  question: string;
  /** Sanitized HTML when `format` is `"html"`, plain text when it is `"text"`. */
  answer: string;
};

/** The answer's prose, shared by both formats' containers. */
const ANSWER_CLASS =
  "flex flex-col gap-2 leading-relaxed text-muted-foreground [&_a]:text-primary-interactive [&_a]:underline [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5";

function FaqPanel({
  title,
  lead,
  items,
  format = "html",
  className,
}: {
  title: string;
  /** One line on what the block is. Optional — the accordion reads fine alone. */
  lead?: string;
  items: readonly FaqPanelItem[];
  format?: "html" | "text";
  className?: string;
}) {
  // Nothing renders at all when there is nothing to ask. An empty "Common
  // questions" heading over a blank panel is worse than the page ending.
  if (items.length === 0) return null;

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-lg bg-muted/40 p-6 ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {/* bg-primary/10, not --primary-subtle: the latter is a fixed
            near-white tint that does not adapt to dark mode, and Lighthouse
            measured 1.65:1 on exactly that pairing with
            --primary-interactive (badge.tsx, card.tsx, icon-card.tsx all
            carry the same note). An alpha tint blends over the surface that
            is actually there, in both modes. */}
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive"
        >
          <MessageCircleQuestionMark className="size-4.5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {lead && <p className="text-sm text-muted-foreground">{lead}</p>}
        </div>
      </div>

      {/* The first answer is OPEN. Base UI unmounts a closed panel, so an
          all-closed accordion is a stack of triggers and nothing else — the
          block would say "there are questions here" without showing that it
          answers any of them, which is half of what the owner asked for. One
          open answer makes it read as content; the rest stay collapsed so a
          long FAQ still cannot push the page's own ending out of reach. */}
      <Accordion defaultValue={["faq-0"]}>
        {items.map((item, i) => (
          // Authored rows have no stable id on a public view; order is their
          // identity, as in @repo/blocks' faq block.
          <AccordionItem
            key={i}
            value={"faq-" + i}
            // The item divider is the panel's ring, not the page's border:
            // `border-b` against a tinted surface reads as a seam. The last
            // item loses its rule so the stack ends on the panel's padding.
            className="border-foreground/10 last:border-b-0"
          >
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>
              {format === "html" ? (
                <div className={ANSWER_CLASS} dangerouslySetInnerHTML={{ __html: item.answer }} />
              ) : (
                // `whitespace-pre-wrap`: a textarea answer's line breaks are
                // the author's paragraphs, and nothing else will restore them.
                <p className={cn(ANSWER_CLASS, "whitespace-pre-wrap")}>{item.answer}</p>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export { FaqPanel };
