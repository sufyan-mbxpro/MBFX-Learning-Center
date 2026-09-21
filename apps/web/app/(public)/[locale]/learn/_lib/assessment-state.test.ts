import { describe, expect, it } from "vitest";
import { courseAssessmentState, lessonAssessmentState, quizHref } from "./assessment-state.ts";

const outstanding = { requiredOutstanding: 2, finalQuiz: null };
const clear = {
  requiredOutstanding: 0,
  finalQuiz: { passed: false, bestPercentage: 0, attempts: 0 },
};
const passed = {
  requiredOutstanding: 0,
  finalQuiz: { passed: true, bestPercentage: 90, attempts: 1 },
};

describe("courseAssessmentState (ADR-084 #2)", () => {
  it.each(["loading", "guest", "off", "error"] as const)(
    "paints the card open for %s, whatever the lessons say",
    (status) => {
      expect(courseAssessmentState(status, outstanding)).toBe("open");
    },
  );

  it("locks a signed-in learner with required lessons left", () => {
    expect(courseAssessmentState("ready", outstanding)).toBe("locked");
  });

  it("opens once every required lesson is done", () => {
    expect(courseAssessmentState("ready", clear)).toBe("open");
  });

  it("reports a pass, even if a lesson was later un-completed", () => {
    expect(courseAssessmentState("ready", passed)).toBe("passed");
    expect(courseAssessmentState("ready", { ...passed, requiredOutstanding: 3 })).toBe("passed");
  });

  it("is open with no view at all", () => {
    expect(courseAssessmentState("ready", null)).toBe("open");
  });
});

describe("lessonAssessmentState (ADR-084 #4)", () => {
  it("is never locked", () => {
    for (const status of ["loading", "guest", "off", "error", "ready"] as const) {
      expect(lessonAssessmentState(status, undefined)).toBe("open");
      expect(lessonAssessmentState(status, "in-progress")).toBe("open");
    }
  });

  it("is passed once the lesson is complete", () => {
    expect(lessonAssessmentState("ready", "completed")).toBe("passed");
    expect(lessonAssessmentState("guest", "completed")).toBe("open");
  });
});

describe("quizHref (ADR-084 #1)", () => {
  it("files the quiz under its OWN track, not the course's", () => {
    expect(quizHref({ track: "crypto", slug: "final-exam" })).toBe(
      "/learn/crypto/quizzes/final-exam",
    );
  });
});
