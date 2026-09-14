// One pure builder per `AI_FEATURES` key.
//
// The map is exhaustive by type: a registry entry with no builder does not
// compile, which is the first of the five things adding a feature touches
// (ADR-097 #3). `ai.test.ts` names the other four.
import type { AiFeatureKey, AiPayload } from "@repo/contracts";

import { buildAltTextPrompt } from "./alt-text.ts";
import { buildQuizGenerationPrompt } from "./quiz-generation.ts";
import { buildSeoGenerationPrompt } from "./seo-generation.ts";
import type { BuiltPrompt } from "./shared.ts";
import { buildSummarizationPrompt } from "./summarization.ts";
import { buildTranslationPrompt } from "./translation.ts";
import { buildWritingAssistantPrompt } from "./writing-assistant.ts";

export type PromptBuilder<K extends AiFeatureKey> = (
  payload: AiPayload<K>,
  extraInstructions?: string | null,
) => BuiltPrompt;

export const PROMPT_BUILDERS: { [K in AiFeatureKey]: PromptBuilder<K> } = {
  writing_assistant: buildWritingAssistantPrompt,
  seo_generation: buildSeoGenerationPrompt,
  translation: buildTranslationPrompt,
  summarization: buildSummarizationPrompt,
  alt_text: buildAltTextPrompt,
  quiz_generation: buildQuizGenerationPrompt,
};

export function buildPrompt<K extends AiFeatureKey>(
  feature: K,
  payload: AiPayload<K>,
  extraInstructions?: string | null,
): BuiltPrompt {
  return PROMPT_BUILDERS[feature](payload, extraInstructions);
}

export { asData, buildSystem, localeName, type BuiltPrompt } from "./shared.ts";
export { buildAltTextPrompt } from "./alt-text.ts";
export { buildQuizGenerationPrompt } from "./quiz-generation.ts";
export { buildSeoGenerationPrompt } from "./seo-generation.ts";
export { buildSummarizationPrompt } from "./summarization.ts";
export { buildTranslationPrompt } from "./translation.ts";
export { buildWritingAssistantPrompt } from "./writing-assistant.ts";
