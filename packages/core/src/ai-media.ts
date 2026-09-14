// Alt text for a stored image (changes-29 B5).
//
// **`@repo/ai` never touches storage and never fetches a URL** — that is
// security.md #9 restated for a client that would happily follow one. So the
// bytes are read HERE, through `readStoredFile`, which serves only keys the
// `MediaAsset` table knows and carries the MIME recorded at upload rather than
// one re-sniffed from anything.
//
// **Nothing here writes `altText`.** The suggestion goes back to a form field
// and the admin saves it through the existing action, with the existing schema
// and the existing `media.update` check (ADR-097 #4). The bulk screen is the
// one place that would be tempting to break, and it is why the return type is
// a LIST of suggestions rather than a count of rows updated.
import { altTextSuggestionSchema, type AiFeatureKey } from "@repo/contracts";
import { AiError, runAiTask } from "@repo/ai";
import { db } from "@repo/db";

import { readStoredFile } from "./media.ts";

const FEATURE: AiFeatureKey = "alt_text";

/**
 * The largest image we will send inline.
 *
 * An image over this is REFUSED with `content_too_large` and the UI says so —
 * an honest empty state (ADR-087 #11's pattern). Adding `sharp` to downscale
 * is the obvious future PR and deliberately not this one: a new native
 * dependency in `onlyBuiltDependencies` is a supply-chain decision
 * (security.md #15), not a convenience.
 */
export const AI_ALT_TEXT_MAX_BYTES = 4 * 1024 * 1024;

export interface AltTextSuggestion {
  assetId: string;
  fileName: string;
  /** The suggestion, or null when this one could not be described. */
  altText: string | null;
  /** A taxonomy reason when `altText` is null. Never a provider message. */
  reason: string | null;
}

async function suggestOne(
  actorId: string,
  asset: { id: string; key: string; fileName: string; mimeType: string; size: number },
  locale?: string,
): Promise<AltTextSuggestion> {
  const base = { assetId: asset.id, fileName: asset.fileName };

  if (asset.size > AI_ALT_TEXT_MAX_BYTES) {
    return { ...base, altText: null, reason: "content_too_large" };
  }

  const stored = await readStoredFile(asset.key);
  if (!stored) return { ...base, altText: null, reason: "content_too_large" };

  try {
    const result = await runAiTask({
      feature: FEATURE,
      payload: {
        // Base64 of bytes we already hold. Never a URL, in either direction.
        imageBase64: Buffer.from(stored.bytes).toString("base64"),
        mimeType: stored.mimeType,
        filename: asset.fileName,
        ...(locale ? { locale } : {}),
      },
      actorId,
      entity: { type: "media", id: asset.id },
      images: [
        {
          mimeType: stored.mimeType,
          base64: Buffer.from(stored.bytes).toString("base64"),
        },
      ],
    });

    // Parsed with the form's own schema (ADR-097 #13): a model that writes a
    // paragraph where a sentence was asked for is a FAILED generation, not a
    // 500-character alt attribute.
    const parsed = altTextSuggestionSchema.safeParse(JSON.parse(stripFence(result.text)));
    if (!parsed.success) return { ...base, altText: null, reason: "invalid_output" };
    return { ...base, altText: parsed.data.altText, reason: null };
  } catch (error) {
    return {
      ...base,
      altText: null,
      reason: error instanceof AiError ? error.reason : "provider_error",
    };
  }
}

/** A model that wraps its JSON in a code fence — common, harmless, unambiguous. */
function stripFence(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (fenced?.[1] ?? text).trim();
}

/** One image. The drawer's Generate button. */
export async function suggestAltText(input: {
  actorId: string;
  assetId: string;
  locale?: string;
}): Promise<AltTextSuggestion> {
  const asset = await db.mediaAsset.findUnique({
    where: { id: input.assetId },
    select: { id: true, key: true, fileName: true, mimeType: true, size: true, kind: true },
  });
  if (!asset || asset.kind !== "IMAGE") {
    return { assetId: input.assetId, fileName: "", altText: null, reason: "content_too_large" };
  }
  return suggestOne(input.actorId, asset, input.locale);
}

/**
 * The review list: "suggest alt text for images that have none".
 *
 * **It writes nothing.** The admin accepts the rows they want and saves them
 * through the media action, which is the shortcut §2.2 #7 exists to forbid —
 * a background writer would be one `updateMany` away and would make the model
 * an editor.
 *
 * Bounded by `limit` AND by the per-user hourly window `runAiTask` enforces on
 * every call, so a bulk run cannot outrun the budget check.
 */
export async function suggestAltTextForUndescribed(input: {
  actorId: string;
  assetIds?: string[];
  limit?: number;
  locale?: string;
}): Promise<AltTextSuggestion[]> {
  const limit = Math.min(Math.max(1, input.limit ?? 10), 25);

  const assets = await db.mediaAsset.findMany({
    where: {
      kind: "IMAGE",
      deletedAt: null,
      ...(input.assetIds?.length
        ? { id: { in: input.assetIds } }
        : { OR: [{ altText: null }, { altText: "" }] }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, key: true, fileName: true, mimeType: true, size: true },
  });

  // Sequential, not `Promise.all`: these are provider calls against one budget
  // and one rate window, and firing twenty at once is how a bulk screen turns
  // a cap into a race.
  const suggestions: AltTextSuggestion[] = [];
  for (const asset of assets) {
    suggestions.push(await suggestOne(input.actorId, asset, input.locale));
  }
  return suggestions;
}
