// The AI registry's drift guard (ADR-097 #3), in `learn.test.ts`'s and
// `tools.test.ts`'s shape.
//
// **Adding a feature touches five places and no migration**: an `AI_FEATURES`
// entry, a prompt builder, a payload schema, a seed row and a catalog block.
// This file owns the half that can be answered from the registry itself.
// The other half — a prompt builder, a seed row, a catalog block, the
// permission keys and the settings — is answered by reading SOURCE across
// package boundaries, and lives in `apps/web/app/ai-registry.test.ts`:
// @repo/contracts declares `zod` and nothing else, deliberately, so it has
// no `@types/node` and cannot open a file.
import { describe, expect, it } from "vitest";

import {
  AI_ASSISTANT_ACTIONS,
  AI_ASSISTANT_ACTION_KEYS,
  AI_CAP_BEHAVIORS,
  AI_EFFORTS,
  AI_FEATURES,
  AI_FEATURE_KEYS,
  AI_FILL_FIELDS,
  AI_FILL_MODULES,
  AI_MODEL_ROLES,
  AI_PAYLOAD_SCHEMAS,
  AI_STREAM_ERROR_PREFIX,
  AI_STUDIO_ACTIONS,
  AI_STUDIO_INPUT_MAX,
  AI_STUDIO_LENGTH_PRESETS,
  AI_STUDIO_TONES,
  AI_TONES,
  aiFeature,
  aiFieldSuggestionSchema,
  aiFillField,
  aiFormSuggestionSchema,
  aiFeatureSchema,
  aiLimitsSchema,
  aiModelSchema,
  aiProviderSchema,
  aiRunSchema,
  altTextSuggestionSchema,
  generatedQuizQuestionSchema,
  isAiFeatureKey,
  quizSuggestionSchema,
  seoSuggestionSchema,
  summarySuggestionSchema,
} from "./ai.ts";

describe("AI_FEATURES", () => {
  it("registers eight features, with no duplicate keys", () => {
    expect(AI_FEATURES).toHaveLength(8);
    expect(new Set(AI_FEATURE_KEYS).size).toBe(8);
  });

  it("gives every entry a tier, an effort and an output ceiling", () => {
    for (const feature of AI_FEATURES) {
      expect(AI_MODEL_ROLES, feature.key).toContain(feature.modelRole);
      expect(AI_EFFORTS, feature.key).toContain(feature.effort);
      expect(feature.maxOutputTokens, feature.key).toBeGreaterThan(0);
    }
  });

  it("moves effort and tier together — a light entry never asks for high effort", () => {
    // ADR-099: a `light` entry at `high` effort is a Haiku bill pretending to
    // be a Haiku bill.
    for (const feature of AI_FEATURES) {
      if (feature.modelRole === "light") expect(feature.effort, feature.key).not.toBe("high");
    }
  });

  it("gives every key a payload schema", () => {
    for (const key of AI_FEATURE_KEYS) {
      expect(AI_PAYLOAD_SCHEMAS[key], `no payload schema for "${key}"`).toBeDefined();
    }
  });

  it("registers NO key for the tutor chatbot", () => {
    // ADR-097 / plan §15: a registry key with no builder behind it is a switch
    // an admin can flip into a 500, and the tutor is learner-triggered,
    // public-surface and unbounded — four properties change at once.
    expect(isAiFeatureKey("tutor_chatbot")).toBe(false);
    expect(isAiFeatureKey("chatbot")).toBe(false);
  });

  it("throws on an unknown key rather than returning undefined", () => {
    expect(() => aiFeature("nope" as never)).toThrow();
  });
});

describe("AI_ASSISTANT_ACTIONS", () => {
  it("registers the five the toolbar offers", () => {
    expect(AI_ASSISTANT_ACTION_KEYS).toEqual([
      "draft",
      "expand",
      "change_tone",
      "summarize",
      "fix_grammar",
    ]);
  });

  it("puts the mechanical action on the light tier and drafting on heavy", () => {
    // This IS ADR-099 #4's worked example: `fix_grammar` is an action inside a
    // feature, so a per-feature model column could never express it.
    const byKey = Object.fromEntries(AI_ASSISTANT_ACTIONS.map((a) => [a.key, a]));
    expect(byKey.fix_grammar!.modelRole).toBe("light");
    expect(byKey.draft!.modelRole).toBe("heavy");
    expect(byKey.summarize!.modelRole).toBe("standard");
  });

  it("marks `draft` as the one action needing no selection", () => {
    for (const action of AI_ASSISTANT_ACTIONS) {
      expect(action.needsSelection, action.key).toBe(action.key !== "draft");
    }
  });
});

describe("writing_studio (ADR-129)", () => {
  const schema = AI_PAYLOAD_SCHEMAS.writing_studio;

  it("lives on the global surface and streams", () => {
    const studio = aiFeature("writing_studio");
    expect(studio.surface).toBe("global");
    expect(studio.streams).toBe(true);
  });

  it("puts grammar on the light tier and no action on heavy", () => {
    const byKey = Object.fromEntries(AI_STUDIO_ACTIONS.map((a) => [a.key, a]));
    expect(byKey.fix_grammar!.modelRole).toBe("light");
    for (const action of AI_STUDIO_ACTIONS) {
      expect(action.modelRole, action.key).not.toBe("heavy");
      if (action.modelRole === "light") expect(action.effort, action.key).not.toBe("high");
    }
  });

  it("offers every assistant tone, so the two tone lists cannot disagree", () => {
    for (const tone of AI_TONES) expect(AI_STUDIO_TONES).toContain(tone);
  });

  it("accepts a topic with a tone, a format and a length target", () => {
    expect(
      schema.safeParse({
        action: "draft",
        text: "Why spreads widen at the rollover",
        tone: "educational",
        format: "bullets",
        length: { unit: "words", target: 120 },
        locale: "en",
      }).success,
    ).toBe(true);
  });

  it("refuses empty text, whitespace included", () => {
    expect(schema.safeParse({ action: "rewrite", text: "   " }).success).toBe(false);
  });

  it("refuses text past the input cap", () => {
    expect(
      schema.safeParse({ action: "rewrite", text: "x".repeat(AI_STUDIO_INPUT_MAX + 1) }).success,
    ).toBe(false);
  });

  it("refuses a tone that is not on the list", () => {
    expect(schema.safeParse({ action: "rewrite", text: "hi", tone: "sarcastic" }).success).toBe(
      false,
    );
  });

  it("refuses a zero or fractional length target", () => {
    for (const target of [0, 12.5]) {
      expect(
        schema.safeParse({ action: "shorten", text: "hi", length: { unit: "characters", target } })
          .success,
      ).toBe(false);
    }
  });

  it("gives every preset a unique key and a target the schema accepts", () => {
    expect(new Set(AI_STUDIO_LENGTH_PRESETS.map((p) => p.key)).size).toBe(
      AI_STUDIO_LENGTH_PRESETS.length,
    );
    for (const preset of AI_STUDIO_LENGTH_PRESETS) {
      expect(
        schema.safeParse({
          action: "shorten",
          text: "hi",
          length: { unit: preset.unit, target: preset.target },
        }).success,
        preset.key,
      ).toBe(true);
    }
  });
});

describe("output contracts", () => {
  it("rejects an over-length meta title rather than truncating it", () => {
    // A truncated meta description is a worse artefact than an honest retry.
    expect(
      seoSuggestionSchema.safeParse({
        seoTitle: "x".repeat(71),
        seoDescription: "fine",
      }).success,
    ).toBe(false);
  });

  it("caps focus keywords at five", () => {
    const base = { seoTitle: "t", seoDescription: "d" };
    expect(
      seoSuggestionSchema.safeParse({ ...base, focusKeywords: ["a", "b", "c", "d", "e"] }).success,
    ).toBe(true);
    expect(
      seoSuggestionSchema.safeParse({ ...base, focusKeywords: ["a", "b", "c", "d", "e", "f"] })
        .success,
    ).toBe(false);
  });

  it("wants 3 to 5 takeaways, each short enough to read at a glance", () => {
    expect(summarySuggestionSchema.safeParse({ keyTakeaways: ["a", "b"] }).success).toBe(false);
    expect(summarySuggestionSchema.safeParse({ keyTakeaways: ["a", "b", "c"] }).success).toBe(true);
    expect(
      summarySuggestionSchema.safeParse({ keyTakeaways: ["a", "b", "c", "d", "e", "f"] }).success,
    ).toBe(false);
    expect(
      summarySuggestionSchema.safeParse({ keyTakeaways: ["x".repeat(161), "b", "c"] }).success,
    ).toBe(false);
  });

  it("caps alt text well under the column's own limit", () => {
    expect(altTextSuggestionSchema.safeParse({ altText: "A chart." }).success).toBe(true);
    expect(altTextSuggestionSchema.safeParse({ altText: "x".repeat(161) }).success).toBe(false);
  });

  it("REJECTS a question whose correct answer is not among its options", () => {
    // The one failure mode a generated quiz has that a hand-written one does
    // not (plan §14.6).
    expect(
      generatedQuizQuestionSchema.safeParse({
        prompt: "What is a pip?",
        options: ["A", "B"],
        correctIndex: 2,
      }).success,
    ).toBe(false);

    expect(
      generatedQuizQuestionSchema.safeParse({
        prompt: "What is a pip?",
        options: ["A", "B"],
        correctIndex: 1,
      }).success,
    ).toBe(true);
  });

  it("rejects a whole question SET when one question is malformed", () => {
    expect(
      quizSuggestionSchema.safeParse({
        questions: [
          { prompt: "ok", options: ["A", "B"], correctIndex: 0 },
          { prompt: "bad", options: ["A", "B"], correctIndex: 5 },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("admin form contracts", () => {
  it("treats a blank API key as absent, so blank can mean UNCHANGED", () => {
    // ADR-087's write-only contract, copied verbatim: the field renders empty
    // over a stored key, so "blank = erase" would wipe the credential on every
    // unrelated save.
    const parsed = aiProviderSchema.parse({
      kind: "ANTHROPIC",
      label: "Anthropic",
      isEnabled: true,
      isDefault: false,
    });
    expect(parsed.apiKey).toBeUndefined();
  });

  it("caps extra instructions at 1000 characters", () => {
    const base = { key: "alt_text" as const, isEnabled: true };
    expect(
      aiFeatureSchema.safeParse({ ...base, extraInstructions: "x".repeat(1000) }).success,
    ).toBe(true);
    expect(
      aiFeatureSchema.safeParse({ ...base, extraInstructions: "x".repeat(1001) }).success,
    ).toBe(false);
  });

  it("accepts a budget of 0, which means unlimited", () => {
    const limits = {
      enabled: true,
      maxTokensPerRequest: 2000,
      monthlyBudgetUsd: 0,
      budgetWarnPercent: 80,
      capBehavior: "DISABLE" as const,
      rateLimitPerUserHour: 120,
      modelLight: "a",
      modelStandard: "b",
      modelHeavy: "c",
    };
    expect(aiLimitsSchema.safeParse(limits).success).toBe(true);
    expect(aiLimitsSchema.safeParse({ ...limits, monthlyBudgetUsd: -1 }).success).toBe(false);
  });

  it("offers exactly two cap behaviours", () => {
    expect([...AI_CAP_BEHAVIORS]).toEqual(["DISABLE", "NOTIFY_ONLY"]);
  });

  it("requires a price that is not negative", () => {
    const model = {
      providerId: "p",
      modelId: "m",
      label: "M",
      inputPricePerMTok: 1,
      outputPricePerMTok: 2,
      maxOutputTokens: 4096,
      supportsVision: false,
      supportsStream: true,
      isEnabled: true,
      sortOrder: 0,
    };
    expect(aiModelSchema.safeParse(model).success).toBe(true);
    expect(aiModelSchema.safeParse({ ...model, inputPricePerMTok: -1 }).success).toBe(false);
  });
});

describe("the run endpoint's contract", () => {
  it("accepts a known feature and refuses an unknown one", () => {
    expect(aiRunSchema.safeParse({ feature: "alt_text", payload: {} }).success).toBe(true);
    expect(aiRunSchema.safeParse({ feature: "tutor_chatbot", payload: {} }).success).toBe(false);
  });

  it("marks a streamed error with a control character, not with prose", () => {
    // A stream cannot change its status code once it has started. The marker
    // is 0x1F, which no model emits in prose — and it is built with
    // `fromCharCode` so no source file carries a raw control byte.
    expect(AI_STREAM_ERROR_PREFIX.charCodeAt(0)).toBe(31);
    expect(AI_STREAM_ERROR_PREFIX).toContain("AI_ERROR:");
  });
});

describe("form_fill (ADR-126)", () => {
  it("covers every fill module in the field registry", () => {
    for (const module of AI_FILL_MODULES) {
      expect(AI_FILL_FIELDS[module].length, module).toBeGreaterThan(0);
    }
  });

  it("offers no field a model must not write — URLs, images, slugs, taxonomy, status", () => {
    for (const module of AI_FILL_MODULES) {
      for (const field of AI_FILL_FIELDS[module]) {
        expect(field.key, `${module}.${field.key}`).not.toMatch(
          /url|image|slug|category|track|difficulty|status|cover|video/i,
        );
      }
    }
  });

  it("parses a form suggestion with the column limits and strips unknown keys", () => {
    const schema = aiFormSuggestionSchema("course");
    const parsed = schema.parse({
      title: "Pips",
      seoTitle: "Pips explained",
      description: [{ type: "paragraph", text: "A pip is a move." }],
      slug: "invented",
    });
    expect(parsed).not.toHaveProperty("slug");
    expect(schema.safeParse({ seoTitle: "x".repeat(71) }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("fills a tool's copy and never its configuration or highlights", () => {
    const keys = AI_FILL_FIELDS.tool.map((field) => field.key);
    expect(keys).not.toContain("config");
    expect(keys).not.toContain("highlights");
    const parsed = aiFormSuggestionSchema("tool").parse({
      title: "Pip calculator",
      intro: [{ type: "paragraph", text: "Work out what a pip is worth." }],
      config: { defaultRisk: 50 },
    });
    expect(parsed).not.toHaveProperty("config");
    expect(aiFormSuggestionSchema("tool").safeParse({ tagline: "x".repeat(221) }).success).toBe(
      false,
    );
  });

  it("refuses HTML where blocks are expected", () => {
    const schema = aiFormSuggestionSchema("lesson");
    expect(schema.safeParse({ content: "<p>hello</p>" }).success).toBe(false);
  });

  it("parses a field suggestion in that field's own shape", () => {
    const field = aiFillField("glossary_term", "seoDescription")!;
    expect(aiFieldSuggestionSchema(field).safeParse({ value: "ok" }).success).toBe(true);
    expect(aiFieldSuggestionSchema(field).safeParse({ value: "x".repeat(181) }).success).toBe(
      false,
    );
  });

  it("accepts a form brief and refuses a field mode on a list field", () => {
    const schema = AI_PAYLOAD_SCHEMAS.form_fill;
    expect(schema.safeParse({ mode: "form", module: "quiz", brief: "Pips" }).success).toBe(true);
    expect(schema.safeParse({ mode: "form", module: "quiz", brief: "   " }).success).toBe(false);
    expect(
      schema.safeParse({
        mode: "field",
        module: "lesson",
        field: "learningObjectives",
        action: "improve",
        current: "",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        mode: "field",
        module: "lesson",
        field: "content",
        action: "improve",
        current: "",
      }).success,
    ).toBe(true);
  });
});
