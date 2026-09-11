// Guards for the quiz index design pass (2026-09-09).
//
// Three things here are load-bearing and none of them shows up in a type or a
// lint error when it breaks:
//
//   1. The card is ONE link to the quiz, painted over the whole card by a
//      stretched `::after`. Wrap it in an anchor instead and you nest anchors
//      (invalid, and it swallows the CTA); drop the overlay class and the
//      artwork stops being clickable with nothing on screen to say so.
//   2. The CTA is raised above that overlay. A control that is not raised is
//      present, focusable, keyboard-operable — and dead to a pointer.
//   3. The meter tells the truth in both states. Before any attempt it shows
//      the quiz's PASS MARK and fills nothing; a fill drawn from the pass mark
//      would tell every reader they were 70% done. It only claims
//      `role="progressbar"` when there is a real value to announce.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { QuizCard } from "./quiz-card.tsx";

afterEach(cleanup);

const LABELS = {
  start: "Start",
  retake: "Retake",
  passMark: "Pass mark",
  yourBest: "Your best",
  passed: "Passed",
  meterLabel: "Your best score",
  noArtwork: "Quiz artwork",
} as const;

function renderCard(overrides: Partial<React.ComponentProps<typeof QuizCard>> = {}) {
  return render(
    <QuizCard
      href="/learn/forex/quizzes/pips"
      title="Pips and lots"
      description="Ten questions on position sizing."
      questionsLabel="10 questions"
      passingScore={70}
      passingScoreLabel="70%"
      labels={LABELS}
      {...overrides}
    />,
  );
}

describe("QuizCard — the whole card opens the quiz", () => {
  it("links the title with a stretched overlay rather than wrapping the card in an anchor", () => {
    const { container } = renderCard();

    const title = screen.getByRole("link", { name: "Pips and lots" });
    expect(title.getAttribute("href")).toBe("/learn/forex/quizzes/pips");
    expect(title.className).toContain("after:absolute");
    expect(title.className).toContain("after:inset-0");

    const article = container.querySelector("article");
    expect(article?.closest("a")).toBeNull();
  });

  it("resolves that overlay against the whole card, not a header row", () => {
    // Unlike CourseCard there is no expandable region below the click target,
    // so the overlay is meant to cover everything — and it only does if the
    // <article> is the nearest positioned ancestor.
    //
    // Two halves, both required. `.sheen` is what supplies the article's
    // `position: relative` (it is a CSS rule in globals.css, not a utility
    // class, which is why this asserts the class name rather than looking for
    // `.relative`); and nothing BETWEEN the title and the article may be
    // positioned, or the overlay shrinks to that box instead — silently, with
    // the card still looking exactly right.
    const { container } = renderCard();
    const article = container.querySelector("article");
    expect(article?.className).toContain("sheen");

    const title = screen.getByRole("link", { name: "Pips and lots" });
    const positioned = title.closest(".relative, .absolute, .fixed, .sticky");
    expect(positioned).toBeNull();
    expect(article?.contains(title)).toBe(true);
  });

  it("raises the CTA above the overlay", () => {
    renderCard();
    // Button stamps role="button" on its anchor — it is a control, not a
    // second destination, which is also why the link count below is 1.
    const cta = screen.getByRole("button", { name: "Start" });
    expect(cta.closest(".z-10")).not.toBeNull();
  });

  it("exposes exactly one LINK to the quiz — the stretched title", () => {
    renderCard();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toBe("Pips and lots");
  });
});

describe("QuizCard — the score meter", () => {
  it("shows the pass mark and no progressbar before any attempt", () => {
    renderCard();

    expect(screen.getByText("Pass mark")).not.toBeNull();
    expect(screen.getByText("70%")).not.toBeNull();
    // Nothing to announce, so nothing announced. A progressbar pinned at 0 on
    // every card in a grid is noise in a screen reader's ear.
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("never fills the track from the pass mark", () => {
    const { container } = renderCard();
    const fill = container.querySelector<HTMLElement>('[style*="width"]');
    expect(fill?.style.width).toBe("0%");
  });

  it("fills to the learner's best score once the island answers", () => {
    renderCard({
      progress: { bestPercentage: 85, bestLabel: "85%", passed: true, attemptsLabel: "2 attempts" },
    });

    expect(screen.getByText("Your best")).not.toBeNull();
    const bar = screen.getByRole("progressbar", { name: "Your best score" });
    expect(bar.getAttribute("aria-valuenow")).toBe("85");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  it("tones the caption by outcome, using derived ink rather than the raw hue", () => {
    renderCard({ progress: { bestPercentage: 85, bestLabel: "85%", passed: true } });
    expect(screen.getByText("85%").className).toContain("text-success-interactive");

    cleanup();
    renderCard({ progress: { bestPercentage: 40, bestLabel: "40%", passed: false } });
    expect(screen.getByText("40%").className).toContain("text-warning-interactive");
  });

  it("clamps a drifted percentage into the track", () => {
    const { container } = renderCard({
      progress: { bestPercentage: 140, bestLabel: "140%", passed: true },
    });
    const fill = container.querySelector<HTMLElement>('[style*="width"]');
    expect(fill?.style.width).toBe("100%");
  });

  it("positions the tick with a logical inset so RTL needs no [dir] rule", () => {
    const { container } = renderCard();
    const tick = container.querySelector<HTMLElement>('[style*="inset-inline-start"]');
    expect(tick).not.toBeNull();
    expect(tick?.style.insetInlineStart).toBe("70%");
  });
});

describe("QuizCard — states a reader scans for", () => {
  it("switches the CTA from start to retake once there is a history", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "Start" })).not.toBeNull();

    cleanup();
    renderCard({ progress: { bestPercentage: 40, bestLabel: "40%", passed: false } });
    expect(screen.getByRole("button", { name: "Retake" })).not.toBeNull();
  });

  it("shows the passed chip only on a pass", () => {
    renderCard({ progress: { bestPercentage: 40, bestLabel: "40%", passed: false } });
    expect(screen.queryByText("Passed")).toBeNull();

    cleanup();
    renderCard({ progress: { bestPercentage: 90, bestLabel: "90%", passed: true } });
    expect(screen.getByText("Passed")).not.toBeNull();
  });

  it("colours the category chip with the tone the caller chose", () => {
    renderCard({ categoryLabel: "Risk Management", categoryTone: "warning" });
    const chip = screen.getByText("Risk Management").className;
    expect(chip).toContain("bg-warning/10");
    expect(chip).toContain("text-warning-interactive");
  });

  it("falls back to the no-artwork state when a cover has no renderer", () => {
    // The renderer is the only path to an image (architecture.md #10) — a
    // silent <img> fallback here would opt every panel out of next/image.
    renderCard({ coverUrl: "/learn/quiz-gauge.svg" });
    expect(screen.getByRole("img", { name: "Quiz artwork" })).not.toBeNull();
  });

  it("marks the cards the active filter produced", () => {
    const { container } = renderCard({ highlighted: true });
    expect(container.querySelector("article")?.className).toContain("ring-primary/40");
  });
});
