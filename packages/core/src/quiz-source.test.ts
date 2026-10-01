// The invariant the quiz translation stands on (plan §4.3, Phase 5 "quizzes
// last, with the id/order-invariance test in place first"): `correctAnswer`
// is an option INDEX, so a translation must keep every option, in order.
import { describe, expect, it } from "vitest";

import { buildQuestionTranslation, hashQuizQuestionSource } from "./quiz-source.ts";

describe("buildQuestionTranslation", () => {
  const source = {
    prompt: "What is a pip?",
    options: ["A price move", "A fee", "A lot size"],
    explanations: ["Correct.", "", "No, that is a lot."],
  };

  it("keeps the option count and order, so every answer index names the same choice", () => {
    const words = buildQuestionTranslation(source, {
      prompt: "¿Qué es un pip?",
      "opt.0": "Un movimiento",
      "opt.1": "Una comisión",
      "opt.2": "Un lote",
      "exp.0": "Correcto.",
      "exp.2": "No, eso es un lote.",
    });
    expect(words.options).toEqual(["Un movimiento", "Una comisión", "Un lote"]);
    expect(words.explanations).toEqual(["Correcto.", "", "No, eso es un lote."]);
  });

  it("keeps the English for a blank result rather than dropping a choice", () => {
    const words = buildQuestionTranslation(source, { "opt.1": "  " });
    expect(words.options).toEqual(source.options);
    expect(words.prompt).toBe(source.prompt);
  });

  it("never changes the shape, whatever comes back", () => {
    // Every option count the editor allows, against answers that are missing,
    // blank, extra, or keyed for options that do not exist.
    const answers: Array<Record<string, string>> = [
      {},
      { "opt.0": "" },
      { "opt.0": "a", "opt.9": "stray", "exp.3": "stray" },
      { prompt: "", "opt.1": "b", "exp.0": "e" },
    ];
    for (let count = 2; count <= 8; count += 1) {
      const options = Array.from({ length: count }, (_, i) => `option ${i}`);
      for (const translated of answers) {
        const words = buildQuestionTranslation(
          { prompt: "Q", options, explanations: options.map(() => "") },
          translated,
        );
        expect(words.options).toHaveLength(count);
        expect(words.explanations).toEqual(options.map(() => ""));
      }
    }
  });
});

describe("hashQuizQuestionSource", () => {
  it("moves when an option is reordered", () => {
    const a = { prompt: "Q", options: ["x", "y"], explanations: ["", ""] };
    const b = { prompt: "Q", options: ["y", "x"], explanations: ["", ""] };
    expect(hashQuizQuestionSource(a)).not.toBe(hashQuizQuestionSource(b));
  });
});
