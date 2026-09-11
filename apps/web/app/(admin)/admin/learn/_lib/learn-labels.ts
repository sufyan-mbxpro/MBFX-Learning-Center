// Display labels for the learning area's enums and registry keys.
//
// ADR-044 #5 is the reason this file exists: a raw identifier never renders.
// `BEGINNER`, `SEO_REVIEW` and the `forex` track key all reach the screen
// through a catalog string here, with `humanizeKey()` as the fallback for a
// value the catalog has not been taught yet — so a track added to
// `LEARN_TRACKS` shows "Commodities", not `commodities`, before anyone
// remembers to write its label.
//
// Catalog strings resolve on the SERVER and are passed down as plain records,
// following the articles screens: leaf components take already-translated
// labels rather than reaching for `useTranslations` themselves.
import { humanizeKey } from "@repo/utils";
import { LEARN_TRACK_KEYS } from "@repo/contracts";

type Translate = (key: string) => string;

/** The status machine's seven states (`CONTENT_TRANSITIONS` in @repo/core). */
export function contentStatusLabels(t: Translate): Record<string, string> {
  return {
    DRAFT: t("statusDraft"),
    IN_REVIEW: t("statusInReview"),
    SEO_REVIEW: t("statusSeoReview"),
    APPROVED: t("statusApproved"),
    SCHEDULED: t("statusScheduled"),
    PUBLISHED: t("statusPublished"),
    ARCHIVED: t("statusArchived"),
  };
}

/**
 * What each transition BUTTON says — the action, not the destination state.
 * "Send to review" reads as something to click; "In review" reads as a label
 * that has already happened.
 */
export function transitionLabels(t: Translate): Record<string, string> {
  return {
    DRAFT: t("transitionDraft"),
    IN_REVIEW: t("transitionInReview"),
    SEO_REVIEW: t("transitionSeoReview"),
    APPROVED: t("transitionApproved"),
    SCHEDULED: t("transitionScheduled"),
    PUBLISHED: t("transitionPublished"),
    ARCHIVED: t("transitionArchived"),
  };
}

export function translationStatusLabels(t: Translate): Record<string, string> {
  return {
    DRAFT: t("statusDraft"),
    IN_REVIEW: t("statusInReview"),
    TRANSLATED: t("statusPublished"),
    NEEDS_REVIEW: t("statusInReview"),
    OUTDATED: t("statusOutdated"),
  };
}

export function difficultyLabels(t: Translate): Record<string, string> {
  return {
    BEGINNER: t("difficultyBeginner"),
    INTERMEDIATE: t("difficultyIntermediate"),
    ADVANCED: t("difficultyAdvanced"),
  };
}

export function visibilityLabels(t: Translate): Record<string, string> {
  return {
    PUBLIC: t("visibilityPublic"),
    AUTHENTICATED: t("visibilityAuthenticated"),
    PREMIUM: t("visibilityPremium"),
    ADMIN: t("visibilityAdmin"),
  };
}

export function completionRuleLabels(t: Translate): Record<string, string> {
  return {
    MANUAL: t("completionRuleManual"),
    QUIZ_PASS: t("completionRuleQuizPass"),
  };
}

/**
 * Track keys → display names. `LEARN_TRACKS`'s own `titleKey` points into the
 * PUBLIC `learn` namespace (ADR-043 #1), which is translated for every active
 * locale; the admin is English-only by design, so it carries its own labels
 * rather than borrowing a learner-facing catalog it would then have to keep
 * in step. A track with no admin label falls back to `humanizeKey()`.
 */
export function trackLabels(t: Translate): Record<string, string> {
  const known: Record<string, string> = {
    forex: t("trackForex"),
    crypto: t("trackCrypto"),
  };
  return Object.fromEntries(
    LEARN_TRACK_KEYS.map((key) => [key, known[key] ?? humanizeKey(key)]),
  ) as Record<string, string>;
}

/** Every label map a learning list or editor screen needs, in one call. */
export function learnLabelMaps(t: Translate) {
  return {
    statuses: contentStatusLabels(t),
    transitions: transitionLabels(t),
    translationStatuses: translationStatusLabels(t),
    difficulties: difficultyLabels(t),
    visibilities: visibilityLabels(t),
    completionRules: completionRuleLabels(t),
    tracks: trackLabels(t),
  };
}

export type LearnLabelMaps = ReturnType<typeof learnLabelMaps>;
