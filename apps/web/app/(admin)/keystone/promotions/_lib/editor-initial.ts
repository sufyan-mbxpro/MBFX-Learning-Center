// The editor's starting state, built on the server from @repo/core's detail
// view (or from defaults for a new promotion). One builder for both pages, so
// "new" and "edit" cannot disagree about what a blank field looks like.
import type { PromotionDetail } from "@repo/core";
import type { PromotionEditorInitial, PromotionWords } from "../_components/promotion-editor.tsx";

const BLANK: PromotionWords = { title: "", body: "", badge: "", ctaLabel: "", imageAlt: "" };

/** A new promotion: a standalone announcement on the home page, as a popup. */
export function newPromotionInitial(locales: readonly string[]): PromotionEditorInitial {
  return {
    id: null,
    status: "DRAFT",
    phase: "DRAFT",
    kind: "ANNOUNCEMENT",
    placements: ["home"],
    showAsPopup: true,
    showInBand: false,
    showAsBar: false,
    barPosition: "BOTTOM",
    priority: 0,
    startsAt: "",
    endsAt: "",
    eventStartsAt: "",
    eventEndsAt: "",
    frequency: "PER_SESSION",
    delaySeconds: 5,
    audience: "ALL",
    untranslated: "HIDE",
    image: { id: null, url: null },
    linkKind: "NONE",
    target: null,
    targetPath: "",
    targetUrl: "",
    recording: null,
    words: Object.fromEntries(locales.map((code) => [code, BLANK])),
    languageStates: Object.fromEntries(locales.map((code) => [code, "MISSING"])),
  };
}

export function editPromotionInitial(
  detail: PromotionDetail,
  locales: readonly string[],
): PromotionEditorInitial {
  const words: Record<string, PromotionWords> = {};
  const languageStates: Record<string, string> = {};
  for (const code of locales) {
    const row = detail.translations.find((t) => t.locale === code);
    words[code] = row
      ? {
          title: row.title ?? "",
          body: row.body ?? "",
          badge: row.badge ?? "",
          ctaLabel: row.ctaLabel ?? "",
          imageAlt: row.imageAlt ?? "",
        }
      : BLANK;
    languageStates[code] = row?.translationStatus ?? "MISSING";
  }

  return {
    id: detail.id,
    status: detail.status,
    phase: detail.phase,
    kind: detail.kind,
    placements: detail.placements,
    showAsPopup: detail.showAsPopup,
    showInBand: detail.showInBand,
    showAsBar: detail.showAsBar,
    barPosition: detail.barPosition,
    priority: detail.priority,
    startsAt: detail.startsAt.toISOString(),
    endsAt: detail.endsAt.toISOString(),
    eventStartsAt: detail.eventStartsAt?.toISOString() ?? "",
    eventEndsAt: detail.eventEndsAt?.toISOString() ?? "",
    frequency: detail.frequency,
    delaySeconds: detail.delaySeconds,
    audience: detail.audience,
    untranslated: detail.untranslated,
    image: { id: detail.imageAssetId, url: detail.imageUrl },
    linkKind: detail.linkKind,
    target: detail.target,
    targetPath: detail.targetPath ?? "",
    targetUrl: detail.targetUrl ?? "",
    recording: detail.recording,
    words,
    languageStates,
  };
}
