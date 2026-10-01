// `translation` — fill a locale's draft (B3).
//
// The builder receives NAMED FIELDS and nothing else (ADR-097 #11): no Prisma
// row, no settings object, no `User`. That is what makes the negative list in
// ADR-097 enforceable by type rather than by review — there is no shape through
// which a password hash or an email address could arrive here.
//
// Slugs are deliberately not translatable input: a slug change writes a
// `Redirect` and is an SEO act, so it stays a human decision. B3 leaves `slug`
// untouched entirely, and this builder would refuse it anyway.
import type { AiPayload } from "@repo/contracts";

import { JSON_ONLY, asData, buildSystem, localeName, type BuiltPrompt } from "./shared.ts";

/** Fields a translation call will not carry, whatever a caller passes. */
const NEVER_TRANSLATE = new Set(["slug", "id", "key", "url", "href", "email"]);

export function buildTranslationPrompt(
  payload: AiPayload<"translation">,
  extraInstructions?: string | null,
): BuiltPrompt {
  const from = localeName(payload.sourceLocale);
  const to = localeName(payload.targetLocale);

  const entries = Object.entries(payload.fields).filter(
    ([name, value]) => !NEVER_TRANSLATE.has(name) && value.trim().length > 0,
  );

  // ADR-160 #7: a field with a draft is REFINED, not retranslated. Only drafts
  // for fields actually being sent count, and the same exclusions apply.
  const drafts = entries.flatMap(([name]) => {
    const draft = payload.drafts?.[name];
    return draft && draft.trim().length > 0 ? [[name, draft] as const] : [];
  });

  const system = buildSystem(
    [
      `You translate website content from ${from} into ${to} for a forex and trading education site.`,
      "Translate meaning, not words. Keep the register, the paragraph structure and the reading level.",
      "Keep any HTML tags and attributes exactly as they are and translate only the text between them.",
      "Leave numbers, currency codes, instrument symbols, brand names and product names untranslated.",
      "Never add, remove, explain, or comment on the content.",
      ...(drafts.length > 0
        ? [
            `Some fields come with an existing ${to} draft. For those, correct the draft against the source: fix mistranslations, grammar and terminology, keep every sentence that is already right, and keep every number exactly as in the source.`,
          ]
        : []),
      "",
      'Return this JSON shape: { "fields": { "<field name>": "<translated text>" } }',
      "Use exactly the field names you were given, and return every one of them.",
      JSON_ONLY,
    ].join("\n"),
    extraInstructions,
  );

  const body = [
    ...entries.map(([name, value]) => asData(`field: ${name}`, value)),
    ...drafts.map(([name, value]) => asData(`draft: ${name}`, value)),
  ].join("\n\n");

  return {
    system,
    messages: [
      {
        role: "user",
        content: [`Translate these ${entries.length} field(s) into ${to}.`, body].join("\n\n"),
      },
    ],
  };
}
