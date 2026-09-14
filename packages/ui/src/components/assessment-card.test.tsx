// Guards for the assessment panel (ADR-084 #2, #3).
//
// Two of these assert things no type and no lint rule can:
//
//   • `locked` must not be REACHABLE. The lock is UX rather than a boundary
//     (ADR-084 #3), so nothing breaks if a reader reaches the quiz — but a
//     control that looks disabled and navigates anyway is a lie about the
//     page's own state, and a `<Button disabled>` that kept its `href` would
//     be exactly that. Asserted on `[href]`, not on the `link` ROLE: a
//     `Button render={<a>}` is announced as a button, which `course-card.
//     test.tsx` documents as the repo's deliberate position — the CTA is a
//     control, not a destination, in the accessibility tree. Counting hrefs
//     tests navigability, which is the actual claim, and cannot be broken by
//     revisiting that convention.
//   • No APPLIED `opacity-*`. Dimming the ink is the obvious way to draw a
//     locked card, it types, it lints, it passes axe — and axe cannot compute
//     contrast through an opacity on an ancestor. It is the defect ADR-082 #3
//     took out of `LessonNav`, and this is the guard that stops it coming
//     back in a new component.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AssessmentCard, type AssessmentState } from "./assessment-card.tsx";

afterEach(cleanup);

const HREF = "/learn/forex/quizzes/final-exam";

const LABELS = {
  eyebrow: "Final assessment",
  questions: "12 questions",
  passMark: "Pass mark 80%",
  attempts: "Unlimited attempts",
  openBody: "Pass it to complete the course.",
  lockedBody: "Finish the 3 remaining lessons to unlock this.",
  passedLabel: "Passed",
  bestLabel: "Your best score: 90%",
  start: "Start the assessment",
  retake: "Retake",
};

function renderCard(state: AssessmentState) {
  return render(
    <AssessmentCard href={HREF} title="Risk Management Final" state={state} labels={LABELS} />,
  );
}

/**
 * Every opacity utility on the rendered card that could fade ink a reader is
 * meant to READ.
 *
 * A bare `opacity-40` counts, and so does a `hover:` or `group-hover:` one —
 * those fade the ink in a state the reader can be in. `disabled:opacity-*` is
 * the one exemption: on an active control it is inert, and on an inactive one
 * WCAG 1.4.3 drops the contrast requirement altogether, which is what lets
 * the design system keep its `disabled:opacity-50` on the locked CTA.
 *
 * The blanket `[class*="opacity-"]` this replaces could not draw that line —
 * it matched Button's own base class list in every state, including the two
 * where nothing is disabled at all.
 */
function readableInkOpacityClasses(container: HTMLElement): string[] {
  const found: string[] = [];
  for (const element of container.querySelectorAll<HTMLElement>("*")) {
    for (const token of element.classList) {
      if (!token.includes("opacity-")) continue;
      if (token.startsWith("disabled:")) continue;
      found.push(token);
    }
  }
  return found;
}

describe("AssessmentCard", () => {
  it("offers exactly one way to the quiz when it is open", () => {
    const { container } = renderCard("open");
    const cta = screen.getByRole("button", { name: LABELS.start });
    expect(cta.getAttribute("href")).toBe(HREF);
    expect(container.querySelectorAll("[href]")).toHaveLength(1);
  });

  it("offers a retake, not a start, once the learner has passed", () => {
    renderCard("passed");
    expect(screen.getByRole("button", { name: LABELS.retake }).getAttribute("href")).toBe(HREF);
    expect(screen.queryByRole("button", { name: LABELS.start })).toBeNull();
    expect(screen.getByText(LABELS.passedLabel)).toBeTruthy();
    expect(screen.getByText(LABELS.bestLabel)).toBeTruthy();
  });

  it("gives a locked card a disabled control and nothing to navigate to", () => {
    const { container } = renderCard("locked");
    expect(container.querySelectorAll("[href]")).toHaveLength(0);
    expect(screen.getByRole("button", { name: LABELS.start })).toHaveProperty("disabled", true);
  });

  it("says what is outstanding rather than only that it is locked", () => {
    renderCard("locked");
    expect(screen.getByText(LABELS.lockedBody)).toBeTruthy();
  });

  it("states what the assessment IS in every state, locked included", () => {
    // These are properties of the quiz, not of the reader. A guest, a
    // mid-course learner and a graduate all see the same three facts.
    for (const state of ["open", "locked", "passed"] as const) {
      renderCard(state);
      expect(screen.getByText(LABELS.questions)).toBeTruthy();
      expect(screen.getByText(LABELS.passMark)).toBeTruthy();
      expect(screen.getByText(LABELS.attempts)).toBeTruthy();
      expect(screen.getByText(LABELS.eyebrow)).toBeTruthy();
      cleanup();
    }
  });

  it("announces the state line, which is the part that changes after paint", () => {
    const { container } = renderCard("open");
    expect(container.querySelector("[aria-live='polite']")?.textContent).toBe(LABELS.openBody);
  });

  it("dims no ink it expects to be read, in any state", () => {
    for (const state of ["open", "locked", "passed"] as const) {
      const { container } = renderCard(state);
      expect(
        readableInkOpacityClasses(container),
        `${state} must not fade its own text`,
      ).toHaveLength(0);
      cleanup();
    }
  });
});
