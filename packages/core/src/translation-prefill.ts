// "Translate with Google" in an editor (plan §3, "Editor flow"): the source
// locale's CURRENT form text goes to Google and comes back to fill another
// locale's form. The current form text, not the saved row, so an English edit
// not yet saved is translated as the admin sees it.
//
// It WRITES NOTHING. The admin reads the result, edits it, maybe refines it
// with AI, and the editor's own Save writes it — through the action, schema
// and permission check that save already has. The caller has checked the
// entity's own update permission (the key the save needs).
import type { TranslatePrefillInput } from "@repo/contracts";
import {
  recentRequestsBy,
  translateHtmlMany,
  translateTexts,
  TranslateError,
} from "@repo/translate";

import { loadGlossaryPairs } from "./article-translation.ts";
import { sanitizeRichText } from "./content.ts";

/** Per person, per minute (plan §3). Each call is up to two requests. */
export const PREFILL_REQUESTS_PER_MINUTE = 20;

export interface PrefillResult {
  texts: Record<string, string>;
  html: Record<string, string>;
}

export async function prefillTranslation(
  actorId: string,
  input: TranslatePrefillInput,
): Promise<PrefillResult> {
  if ((await recentRequestsBy(actorId, 60_000)) >= PREFILL_REQUESTS_PER_MINUTE) {
    throw new TranslateError("rate_limited", "Too many translation requests this minute");
  }

  // Blank fields are not sent and do not come back: an empty source field
  // must not overwrite what the admin has in the target.
  const textNames = Object.keys(input.texts).filter((name) => input.texts[name]!.trim() !== "");
  const htmlNames = Object.keys(input.html).filter((name) => input.html[name]!.trim() !== "");
  const options = {
    source: input.sourceLocale,
    target: input.targetLocale,
    userId: actorId,
    entity: input.entity,
  };

  const [texts, htmls] = await Promise.all([
    textNames.length > 0
      ? translateTexts(
          textNames.map((name) => input.texts[name]!),
          options,
        )
      : Promise.resolve([]),
    htmlNames.length > 0
      ? loadGlossaryPairs(input.targetLocale, input.sourceLocale).then((glossary) =>
          translateHtmlMany(
            htmlNames.map((name) => input.html[name]!),
            { ...options, glossary },
          ),
        )
      : Promise.resolve([]),
  ]);

  return {
    texts: Object.fromEntries(textNames.map((name, i) => [name, texts[i] ?? ""])),
    // Google's HTML is external input: sanitized as any save is (security.md #8).
    html: Object.fromEntries(htmlNames.map((name, i) => [name, sanitizeRichText(htmls[i] ?? "")])),
  };
}
