"use client";

// The locale row's translation half (changes-29 B3), shared by the course,
// lesson, video topic and glossary term editors: the translation's own status,
// and "Translate from <default locale>".
//
// The status matters because it is what the public site reads: only a
// translation a person saved appears in the reading-language menu (ADR-127 #2).
// A draft whose words are untouched AI output shows "Machine translated" before
// it is saved, because that is what Save will write.
import { AiTranslateButton } from "../ai-translate-button.tsx";
import type { EditorAi } from "../../_lib/editor-ai.ts";
import { StatusBadge, TRANSLATION_STATUS_TONE, statusTone } from "../status-badge.tsx";

export function TranslationControls({
  translate,
  locale,
  defaultLocale,
  translationStatus,
  machineTranslated,
  canUpdate,
  entity,
  sourceFields,
  wouldOverwrite,
  onApply,
}: {
  /** Absent when AI translation is off or this person cannot use it. */
  translate: EditorAi["translate"];
  locale: string;
  defaultLocale: string;
  translationStatus: string;
  machineTranslated: boolean | undefined;
  canUpdate: boolean;
  entity: { type: string; id: string };
  /** The DEFAULT locale's words, by field name. */
  sourceFields: Record<string, string>;
  wouldOverwrite: boolean;
  onApply: (translated: Record<string, string>) => void;
}) {
  // Nothing to say on the source locale: there is nothing it was translated from.
  if (!translate || locale === defaultLocale) return null;
  const shown = machineTranslated ? "MACHINE_TRANSLATED" : translationStatus;

  return (
    <>
      <StatusBadge tone={statusTone(TRANSLATION_STATUS_TONE, shown)}>
        {translate.statusLabels[shown] ?? translate.statusLabels.DRAFT}
      </StatusBadge>
      {canUpdate && Object.keys(sourceFields).length > 0 && (
        <AiTranslateButton
          labels={translate.labels}
          sourceLocale={defaultLocale}
          targetLocale={locale}
          entity={entity}
          fields={sourceFields}
          wouldOverwrite={wouldOverwrite}
          onApply={onApply}
        />
      )}
    </>
  );
}
