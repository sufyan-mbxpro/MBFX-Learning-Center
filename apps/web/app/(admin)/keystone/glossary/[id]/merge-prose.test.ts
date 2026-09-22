import { describe, expect, it } from "vitest";
import { mergeGlossaryProse } from "./merge-prose.ts";

const HEADINGS = {
  detailed: "In more detail",
  advanced: "Going deeper",
  example: "Worked example",
};

describe("mergeGlossaryProse", () => {
  it("leaves a single-body term untouched", () => {
    const prose = {
      simpleExplanation: "<p>A pip.</p>",
      detailedExplanation: null,
      advancedExplanation: "",
      exampleScenario: "<p></p>",
    };
    expect(mergeGlossaryProse(prose, HEADINGS)).toBe("<p>A pip.</p>");
  });

  it("appends every non-empty section under its public heading, in order", () => {
    const merged = mergeGlossaryProse(
      {
        simpleExplanation: "<p>A pip.</p>",
        detailedExplanation: "<p>More.</p>",
        advancedExplanation: null,
        exampleScenario: "<p>1.1000 → 1.1001</p>",
      },
      HEADINGS,
    );
    expect(merged).toBe(
      "<p>A pip.</p><h2>In more detail</h2><p>More.</p><h2>Worked example</h2><p>1.1000 → 1.1001</p>",
    );
  });

  it("keeps an image-only section and escapes the heading", () => {
    const merged = mergeGlossaryProse(
      {
        simpleExplanation: "<p>A.</p>",
        detailedExplanation: '<img src="/x.png" alt="">',
        advancedExplanation: null,
        exampleScenario: null,
      },
      { ...HEADINGS, detailed: "<b>More</b>" },
    );
    expect(merged).toBe('<p>A.</p><h2>&lt;b&gt;More&lt;/b&gt;</h2><img src="/x.png" alt="">');
  });
});
