// Guards for the assessment panel (ADR-084 #2, #3).
//
// Two of these assert things no type and no lint rule can:
//
//   • `locked` must not be a LINK. The lock is UX rather than a boundary
//     (ADR-084 #3), so nothing breaks if a reader reaches the quiz — but a
//     control that looks disabled and navigates anyway is a lie about the
//     page's own state, and a `<Button disabled>` that kept its anchor would
//     be exactly that.
//   • No `opacity-*` anywhere. Dimming the ink is the obvious way to draw a
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

describe("AssessmentCard", () => {
  it("offers exactly one link to the quiz when it is open", () => {
    renderCard("open");
    const link = screen.getByRole("link", { name: LABELS.start });
    expect(link.getAttribute("href")).toBe(HREF);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("offers a retake, not a start, once the learner has passed", () => {
    renderCard("passed");
    expect(screen.getByRole("link", { name: LABELS.retake }).getAttribute("href")).toBe(HREF);
    expect(screen.queryByRole("link", { name: LABELS.start })).toBeNull();
    expect(screen.getByText(LABELS.passedLabel)).toBeTruthy();
    expect(screen.getByText(LABELS.bestLabel)).toBeTruthy();
  });

  it("gives a locked card a disabled control and no link at all", () => {
    renderCard("locked");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
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

  it("dims no ink in any state", () => {
    for (const state of ["open", "locked", "passed"] as const) {
      const { container } = renderCard(state);
      const dimmed = container.querySelectorAll('[class*="opacity-"]');
      expect(dimmed, `${state} must not fade its own text`).toHaveLength(0);
      cleanup();
    }
  });
});
