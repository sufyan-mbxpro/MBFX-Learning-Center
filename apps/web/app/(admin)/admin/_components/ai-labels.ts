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
import type { AiSeoLabels } from "./ai-seo-dialog.tsx";
import type { AiTranslateLabels } from "./ai-translate-button.tsx";
import type { TakeawaysLabels } from "./takeaways-field.tsx";
import type { AltTextReviewLabels } from "../media/alt-text-review.tsx";
import type { AiQuizLabels } from "./ai-quiz-dialog.tsx";

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

/**
 * B2's labels. `cancel` comes from the shared admin namespace, so this builder
 * takes both translators rather than pretending every string it needs lives
 * under `admin.ai`.
 */
export function aiSeoLabels(t: Translate, common: Translate): AiSeoLabels {
  return {
    action: t("seoAction"),
    title: t("seoTitle"),
    description: t("seoDescription"),
    current: t("seoCurrent"),
    suggested: t("seoSuggested"),
    empty: t("seoEmpty"),
    apply: t("seoApply"),
    cancel: common("cancel"),
    generating: t("assistantGenerating"),
    failed: t("assistantFailed"),
    reasons: aiReasonLabels(t),
    fields: {
      seoTitle: t("seoFields.seoTitle"),
      seoDescription: t("seoFields.seoDescription"),
      ogTitle: t("seoFields.ogTitle"),
      ogDescription: t("seoFields.ogDescription"),
      focusKeywords: t("seoFields.focusKeywords"),
    },
  };
}

/**
 * B3's labels.
 *
 * `sourceLocale` is interpolated HERE rather than in the component, because the
 * component receives a locale CODE and the sentence wants whatever the page
 * calls that locale.
 */
export function aiTranslateLabels(
  t: (key: string, values?: Record<string, string>) => string,
  common: Translate,
  sourceLocale: string,
): AiTranslateLabels {
  return {
    action: t("translateAction", { source: sourceLocale }),
    confirmTitle: t("translateConfirmTitle"),
    confirmDescription: t("translateConfirmDescription"),
    confirm: t("translateConfirm"),
    cancel: common("cancel"),
    generating: t("assistantGenerating"),
    failed: t("assistantFailed"),
    done: t("translateDone"),
    reasons: aiReasonLabels((key) => t(key)),
  };
}

/**
 * B4's labels.
 *
 * The FIELD's own strings come from the `admin` namespace, not `admin.ai`:
 * the takeaways list is an ordinary content control that happens to have a
 * Generate button, and filing its label under AI would be the first step
 * towards it disappearing when AI does (ADR-097 / §2.2 #8).
 */
export function takeawaysLabels(common: Translate, t: Translate): TakeawaysLabels {
  return {
    label: common("articleKeyTakeaways"),
    hint: common("articleKeyTakeawaysHint"),
    add: common("articleKeyTakeawayAdd"),
    remove: common("articleKeyTakeawayRemove"),
    placeholder: common("articleKeyTakeawayPlaceholder"),
    generate: t("takeawaysGenerate"),
    generating: t("assistantGenerating"),
    failed: t("assistantFailed"),
    done: t("takeawaysDone"),
    reasons: aiReasonLabels(t),
  };
}

/** B5's in-dialog half — the Generate button beside the alt-text field. */
export function altTextFieldLabels(t: Translate): {
  generate: string;
  generating: string;
  failed: string;
  reasons: Record<string, string>;
} {
  return {
    generate: t("altTextGenerate"),
    generating: t("assistantGenerating"),
    failed: t("assistantFailed"),
    reasons: aiReasonLabels(t),
  };
}

/** B5's bulk screen. `costNote` is interpolated by the page, which knows the price. */
export function altTextReviewLabels(
  t: (key: string, values?: Record<string, string | number>) => string,
  costNote: string,
): AltTextReviewLabels {
  return {
    title: t("altTextReviewTitle"),
    description: t("altTextReviewDescription"),
    costNote,
    start: t("altTextStart"),
    running: t("altTextRunning"),
    save: t("altTextSave"),
    saved: t("altTextSaved"),
    accept: t("altTextAccept"),
    empty: t("altTextEmpty"),
    emptyBody: t("altTextEmptyBody"),
    failedRow: t("altTextFailedRow"),
    reasons: aiReasonLabels((key) => t(key)),
  };
}

/**
 * B6's labels.
 *
 * The difficulty names come from the `admin` namespace, not `admin.ai`: they
 * are the LESSON difficulties this repo already has words for, and a second
 * set under AI would be two vocabularies for one idea.
 */
export function aiQuizLabels(
  t: Translate,
  common: Translate,
  difficulties: Record<string, string>,
): AiQuizLabels {
  return {
    action: t("quizAction"),
    title: t("quizTitle"),
    description: t("quizDescription"),
    countLabel: t("quizCountLabel"),
    difficultyLabel: t("quizDifficultyLabel"),
    difficulties,
    generate: t("quizGenerate"),
    generating: t("assistantGenerating"),
    accept: t("quizAccept"),
    add: t("quizAdd"),
    cancel: common("cancel"),
    correct: t("quizCorrect"),
    failed: t("assistantFailed"),
    empty: t("quizEmpty"),
    reasons: aiReasonLabels(t),
  };
}
