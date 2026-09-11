// The lesson sidebar's "put your knowledge into practice" card (changes-11
// §9.5, the FOREX.com CTA slot).
//
// **Static and code-owned, per ADR-042.** The plan is explicit that this is not
// an admin-editable block: site composition lives in code, and only content
// DATA is dynamic. Changing where this points is a code change.
//
// One entry per registered track, so a forex lesson can point somewhere
// different from a crypto one. `default` covers a track added to
// `LEARN_TRACKS` before anyone writes its promo — the card still renders
// rather than disappearing from half the lessons unnoticed.
import { ROUTE_PATHS, type LearnTrackKey } from "@repo/contracts";
import type { MessageKey } from "@repo/i18n";

export interface PracticeCta {
  readonly titleKey: MessageKey<"learn">;
  readonly descriptionKey: MessageKey<"learn">;
  readonly actionKey: MessageKey<"learn">;
  readonly href: string;
}

const DEFAULT_CTA: PracticeCta = {
  titleKey: "cta.title",
  descriptionKey: "cta.description",
  actionKey: "cta.action",
  href: ROUTE_PATHS.analysis,
};

/**
 * Per-track overrides. Empty today — both tracks point at analysis, which is
 * the honest destination while `/tools` and `/markets` have no route (the
 * homepage's `soon` cards record the same constraint). An entry added here
 * takes precedence without any change at the call site.
 */
const BY_TRACK: Partial<Record<LearnTrackKey, PracticeCta>> = {};

export function practiceCtaFor(track: string): PracticeCta {
  return BY_TRACK[track as LearnTrackKey] ?? DEFAULT_CTA;
}
