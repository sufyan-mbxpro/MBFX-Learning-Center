// One place to build the AI label bundles, for `editor-labels.ts`'s reason:
// every AI affordance needs the same taxonomy map and the same handful of
// verbs, and three hand-maintained copies is three chances for a screen to fall
// behind by one string — which typechecks fine right up until the day a label
// renders `undefined`.
//
// ADR-043: `admin.*` is English-only by design, so only `en.json` carries
// values. The keys still go through the catalog (code-style.md #2).
import { AI_REASONS } from "@repo/ai";
import type { AiAssistantAction, AiTone } from "@repo/contracts";

import type { AiAssistantLabels } from "./ai-assistant.tsx";

/** Resolves a key under the `admin.ai` namespace. */
type Translate = (key: string) => string;

/**
 * reason → one catalog string.
 *
 * Built from `AI_REASONS` rather than from a hand-written list, so a reason
 * added to the taxonomy without a catalog key fails at the catalog check rather
 * than rendering its own identifier to an admin (ADR-044 #5).
 */
export function aiReasonLabels(t: Translate): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const reason of AI_REASONS) labels[reason] = t(`reasons.${reason}`);
  return labels;
}

const ACTIONS: readonly AiAssistantAction[] = [
  "draft",
  "expand",
  "change_tone",
  "summarize",
  "fix_grammar",
];

const TONES: readonly AiTone[] = ["professional", "friendly", "concise", "plain"];

export function aiAssistantLabels(t: Translate): AiAssistantLabels {
  return {
    menu: t("assistantMenu"),
    actions: Object.fromEntries(
      ACTIONS.map((action) => [action, t(`assistantActions.${action}`)]),
    ) as Record<AiAssistantAction, string>,
    tones: Object.fromEntries(TONES.map((tone) => [tone, t(`assistantTones.${tone}`)])) as Record<
      AiTone,
      string
    >,
    briefLabel: t("assistantBriefLabel"),
    briefPlaceholder: t("assistantBriefPlaceholder"),
    briefSubmit: t("assistantBriefSubmit"),
    panelTitle: t("assistantPanel"),
    generating: t("assistantGenerating"),
    stop: t("assistantStop"),
    insert: t("assistantInsert"),
    replace: t("assistantReplace"),
    discard: t("assistantDiscard"),
    reasons: aiReasonLabels(t),
    failed: t("assistantFailed"),
  };
}
