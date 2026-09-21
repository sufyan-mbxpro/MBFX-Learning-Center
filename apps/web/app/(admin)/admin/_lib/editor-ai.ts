// What every editor PAGE hands its editor about AI (ADR-126).
//
// One server read per screen, folded the way the article page always folded
// it: `getAiAvailability()` already contains the global switch and the budget,
// `ai.use` gates spending, and the module's own content key gates whether this
// person could SAVE what the AI writes. Each affordance is present or absent on
// its own — an admin may switch the assistant on and leave form fill off.
//
// The absence of the returned object is how an AI-off install ships no AI
// control into the editor (ADR-097 #6). Nothing here is security: the run route
// re-checks all of it, and the editor's save action re-checks the content key
// (security.md #1).
import { getTranslations } from "next-intl/server";
import { getAiAvailability } from "@repo/ai";
import type { AiFillModule } from "@repo/contracts";
import { routing } from "@repo/i18n/routing";
import { can, canAny, type Subject } from "@repo/rbac";

import type { AiAssistantConfig, AiAssistantLabels } from "../_components/ai-assistant.tsx";
import type { AiFillConfig } from "../_components/ai-fill.tsx";
import {
  aiAssistantLabels,
  aiFillLabels,
  aiSeoLabels,
  aiTranslateLabels,
} from "../_components/ai-labels.ts";
import type { AiSeoLabels } from "../_components/ai-seo-dialog.tsx";
import type { AiTranslateLabels } from "../_components/ai-translate-button.tsx";

export interface EditorAi {
  /** The ✨ toolbar menu on every rich-text field. */
  assistant?: { config: AiAssistantConfig; labels: AiAssistantLabels };
  /** The "Generate with AI" bar and every text field's ✨ menu. */
  fill?: AiFillConfig;
  /**
   * "Generate SEO" in the SEO section's header — the article editor's review
   * dialog, on every module that has an SEO section. Its own feature switch.
   */
  seo?: { labels: AiSeoLabels };
  /**
   * "Translate from <default locale>" beside the locale switcher (changes-29
   * B3). Gated on `translations.update` as well, the key the run route checks
   * for this feature, so nobody gets a button whose every press is refused.
   */
  translate?: {
    labels: AiTranslateLabels;
    /** A translation row's status, named — never the raw enum (ADR-044 #5). */
    statusLabels: Record<string, string>;
  };
}

export async function loadEditorAi(
  subject: Subject,
  {
    module,
    entity,
    contentKeys,
  }: {
    module: AiFillModule;
    entity: { type: string; id: string };
    /** Any one of these lets the subject save this editor. */
    contentKeys: string[];
  },
): Promise<EditorAi | undefined> {
  if (!can(subject, "ai.use") || !canAny(subject, contentKeys)) return undefined;

  const availability = await getAiAvailability();
  const assistantOn = availability.features.writing_assistant === true;
  const fillOn = availability.features.form_fill === true;
  const seoOn = availability.features.seo_generation === true;
  const translateOn =
    availability.features.translation === true && can(subject, "translations.update");
  if (!assistantOn && !fillOn && !seoOn && !translateOn) return undefined;

  const [tAi, t] = await Promise.all([getTranslations("admin.ai"), getTranslations("admin")]);
  const tAiKey = (key: string) => tAi(key as "assistantMenu");
  const common = (key: string) => t(key as "cancel");

  return {
    ...(assistantOn
      ? {
          assistant: {
            // The panel shape on every editor; each editor adds its own
            // `locale`, which is state this server read cannot see.
            config: { entity, panel: true, languages: [...routing.locales] },
            labels: aiAssistantLabels(tAiKey),
          },
        }
      : {}),
    ...(fillOn
      ? {
          fill: {
            module,
            entity,
            labels: aiFillLabels(tAiKey, common),
            // A rich-text field already carries the assistant's ✨ in its own
            // toolbar; a second ✨ beside its label would be the same icon twice.
            richHasAssistant: assistantOn,
          },
        }
      : {}),
    ...(seoOn ? { seo: { labels: aiSeoLabels(tAiKey, common) } } : {}),
    ...(translateOn
      ? {
          translate: {
            labels: aiTranslateLabels(
              (key, values) => tAi(key as "translateAction", values),
              common,
              routing.defaultLocale,
            ),
            statusLabels: {
              DRAFT: t("statusDraft"),
              TRANSLATED: t("statusTranslated"),
              OUTDATED: t("statusOutdated"),
              MACHINE_TRANSLATED: t("statusMACHINE_TRANSLATED"),
            },
          },
        }
      : {}),
  };
}

/**
 * The writing assistant ALONE, for a rich-text surface that is not one of the
 * form-fill modules — the email template body (changes-46 #4). Same gates as
 * above: `ai.use`, the key that saves this surface, and the feature switch.
 * The run route checks the same save key for this feature.
 */
export async function loadWritingAssistant(
  subject: Subject,
  { entity, contentKeys }: { entity: { type: string; id: string }; contentKeys: string[] },
): Promise<EditorAi["assistant"]> {
  if (!can(subject, "ai.use") || !canAny(subject, contentKeys)) return undefined;
  const availability = await getAiAvailability();
  if (availability.features.writing_assistant !== true) return undefined;
  const tAi = await getTranslations("admin.ai");
  return {
    config: { entity, panel: true, languages: [...routing.locales] },
    labels: aiAssistantLabels((key: string) => tAi(key as "assistantMenu")),
  };
}
