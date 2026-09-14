// Guard for the one FAQ treatment (changes-22's second round).
//
// The panel exists because the same block had been written twice — styled on
// /news, unstyled on a glossary term — and the owner reported the flat one as
// a bug. What has to hold is: it is a SURFACE (a reader sees the block change
// kind before reading a word), it renders both answer formats, and it is
// absent rather than empty-headed when a page has no questions.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FaqPanel } from "./faq-panel.tsx";

afterEach(cleanup);

const ITEMS = [
  { question: "What is a pip?", answer: "The smallest quoted move.\nUsually 0.0001." },
  { question: "Why does it matter?", answer: "It is how a position's P&L is measured." },
];

describe("FaqPanel", () => {
  it("renders nothing when there are no questions", () => {
    const { container } = render(<FaqPanel title="Common questions" items={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("is its own surface, not prose on the page background", () => {
    render(<FaqPanel title="Common questions" items={ITEMS} />);
    const panel = screen.getByRole("heading", { name: "Common questions" }).closest("section");
    expect(panel).not.toBeNull();
    // The tint and the ring are the distinction the owner asked for. A change
    // here is a design decision; a silent loss of them is the bug returning.
    expect(panel?.className).toContain("bg-muted/40");
    expect(panel?.className).toContain("ring-1");
  });

  it("tints its icon with an alpha blend, not the mode-inconsistent --primary-subtle", () => {
    const { container } = render(<FaqPanel title="Common questions" items={ITEMS} />);
    const disc = container.querySelector("span[aria-hidden]");
    // The same regression badge.tsx, card.tsx and icon-card.tsx each carry a
    // test for: --primary-subtle is a fixed near-white tint that does not
    // adapt to dark mode, and Lighthouse measured 1.65:1 against
    // --primary-interactive on that pairing.
    expect(disc?.className).toContain("bg-primary/10");
    expect(disc?.className).not.toContain("bg-primary-subtle");
  });

  it("renders every question as its own disclosure, with the first answer open", () => {
    render(<FaqPanel title="Common questions" items={ITEMS} />);
    for (const item of ITEMS) {
      expect(screen.getByRole("button", { name: item.question })).toBeDefined();
    }
    // Base UI unmounts a closed panel, so this asserts the block shows an
    // ANSWER and not just a stack of triggers — see the component's comment.
    expect(screen.getByText(/smallest quoted move/)).toBeDefined();
    expect(screen.queryByText(/P&L is measured/)).toBeNull();
  });

  it("renders a text answer as text, tags and all", () => {
    render(
      <FaqPanel
        title="FAQ"
        items={[{ question: "Q", answer: "<b>not markup</b>" }]}
        format="text"
      />,
    );
    // A glossary answer is a plain textarea value. Rendered as HTML it would
    // show bold text; rendered as text it shows what the author typed.
    expect(screen.getByText("<b>not markup</b>")).toBeDefined();
  });

  it("renders an html answer as markup", () => {
    const { container } = render(
      <FaqPanel title="FAQ" items={[{ question: "Q", answer: "<b>bold</b>" }]} />,
    );
    expect(container.querySelector("b")?.textContent).toBe("bold");
  });

  it("renders the lead only when a caller passes one", () => {
    const lead = "Quick answers to what readers ask about this term.";
    const { rerender } = render(<FaqPanel title="Common questions" items={ITEMS} />);
    expect(screen.queryByText(lead)).toBeNull();
    rerender(<FaqPanel title="Common questions" lead={lead} items={ITEMS} />);
    expect(screen.getByText(lead)).toBeDefined();
  });
});
