import { describe, expect, it } from "vitest";

import {
  createGlossaryTermSchema,
  GLOSSARY_FAQ_MAX,
  glossaryFaqSchema,
  glossaryTermMetaSchema,
  saveGlossaryTermSchema,
  saveGlossaryTranslationSchema,
} from "./glossary.ts";
import { glossaryTrackSchema } from "./learn.ts";

// ADR-069 §Compliance. `faq` is the column that most needs this: it is
// `Json?`, so anything that gets past the parser is stored verbatim and only
// discovered when a reader renders `undefined` into a page.
describe("glossaryFaqSchema", () => {
  it("accepts a well-formed list", () => {
    const parsed = glossaryFaqSchema.parse([
      { question: "What is a pip?", answer: "The smallest price move." },
    ]);
    expect(parsed).toHaveLength(1);
  });

  it("accepts an empty list — a term with no questions is normal", () => {
    expect(glossaryFaqSchema.parse([])).toEqual([]);
  });

  it.each([
    ["a missing answer", [{ question: "What is a pip?" }]],
    ["a blank question", [{ question: "   ", answer: "Something." }]],
    ["a blank answer", [{ question: "What?", answer: "" }]],
    ["a null entry", [null]],
    ["a bare string", ["What is a pip?"]],
    ["a nested object instead of an array", { question: "What?", answer: "Yes." }],
  ])("rejects %s", (_label, input) => {
    expect(glossaryFaqSchema.safeParse(input).success).toBe(false);
  });

  it(`rejects more than ${GLOSSARY_FAQ_MAX} items`, () => {
    const tooMany = Array.from({ length: GLOSSARY_FAQ_MAX + 1 }, (_, i) => ({
      question: `Q${i}`,
      answer: `A${i}`,
    }));
    expect(glossaryFaqSchema.safeParse(tooMany).success).toBe(false);
    expect(glossaryFaqSchema.safeParse(tooMany.slice(0, GLOSSARY_FAQ_MAX)).success).toBe(true);
  });

  it("strips unknown keys rather than storing them in the Json column", () => {
    const parsed = glossaryFaqSchema.parse([
      { question: "Q", answer: "A", isPublished: true, id: "injected" },
    ]);
    expect(parsed[0]).toEqual({ question: "Q", answer: "A" });
  });
});

// The two nulls that sit one field apart and mean opposite things
// (ADR-069 §3 / ADR-065 §3). The schemas cannot enforce the MEANING, but they
// can both admit null, which is the part a "required track" would break.
describe("track and topic nulls", () => {
  it("accepts null as a track — every school", () => {
    expect(glossaryTrackSchema.parse(null)).toBeNull();
  });

  it("accepts a real track key", () => {
    expect(glossaryTrackSchema.parse("forex")).toBe("forex");
  });

  it("rejects a track that is not in the registry", () => {
    expect(glossaryTrackSchema.safeParse("commodities").success).toBe(false);
  });

  it("accepts null as a topicId — unfiled", () => {
    expect(glossaryTermMetaSchema.parse({ topicId: null }).topicId).toBeNull();
  });

  it("treats an omitted field as untouched, not as null", () => {
    const parsed = glossaryTermMetaSchema.parse({});
    expect("topicId" in parsed).toBe(false);
    expect("track" in parsed).toBe(false);
  });
});

describe("saveGlossaryTranslationSchema", () => {
  const valid = {
    locale: "en",
    term: "Leverage",
    simpleExplanation: "<p>Borrowed capital.</p>",
  };

  it("needs only a locale, a term and a simple explanation", () => {
    expect(saveGlossaryTranslationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty simple explanation — it is what the A–Z renders", () => {
    expect(
      saveGlossaryTranslationSchema.safeParse({ ...valid, simpleExplanation: "" }).success,
    ).toBe(false);
  });

  it("rejects a blank term", () => {
    expect(saveGlossaryTranslationSchema.safeParse({ ...valid, term: "  " }).success).toBe(false);
  });

  it("allows the three optional bodies to be null", () => {
    const parsed = saveGlossaryTranslationSchema.parse({
      ...valid,
      detailedExplanation: null,
      advancedExplanation: null,
      exampleScenario: null,
    });
    expect(parsed.detailedExplanation).toBeNull();
  });

  it("caps seoTitle at 70 and seoDescription at 180", () => {
    expect(
      saveGlossaryTranslationSchema.safeParse({ ...valid, seoTitle: "x".repeat(71) }).success,
    ).toBe(false);
    expect(
      saveGlossaryTranslationSchema.safeParse({ ...valid, seoDescription: "x".repeat(181) })
        .success,
    ).toBe(false);
  });
});

describe("saveGlossaryTermSchema", () => {
  it("carries meta and translation together — one transaction, one payload", () => {
    const parsed = saveGlossaryTermSchema.parse({
      termId: "term_1",
      meta: { topicId: null, track: "forex", difficulty: "BEGINNER" },
      translation: { locale: "en", term: "Pip", simpleExplanation: "<p>A price move.</p>" },
    });
    expect(parsed.meta.track).toBe("forex");
    expect(parsed.translation.term).toBe("Pip");
  });

  it("rejects a payload with no termId", () => {
    expect(
      saveGlossaryTermSchema.safeParse({
        meta: {},
        translation: { locale: "en", term: "Pip", simpleExplanation: "<p>x</p>" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown difficulty", () => {
    expect(
      saveGlossaryTermSchema.safeParse({
        termId: "term_1",
        meta: { difficulty: "EXPERT" },
        translation: { locale: "en", term: "Pip", simpleExplanation: "<p>x</p>" },
      }).success,
    ).toBe(false);
  });
});

describe("createGlossaryTermSchema", () => {
  it("accepts an empty payload — a blank DRAFT term is legal", () => {
    expect(createGlossaryTermSchema.parse({})).toEqual({});
  });

  it("accepts a topic and a track", () => {
    const parsed = createGlossaryTermSchema.parse({ topicId: "topic_1", track: "crypto" });
    expect(parsed).toEqual({ topicId: "topic_1", track: "crypto" });
  });
});
