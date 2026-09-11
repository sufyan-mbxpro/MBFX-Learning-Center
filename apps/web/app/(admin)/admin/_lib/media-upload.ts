// Shared upload gating and FormData parsing for the media surfaces.
//
// Deliberately NOT a "use server" module: every export of one becomes a
// callable server action, and Next.js therefore requires them all to be
// async. These helpers are shared by `media-actions.ts` and the
// XHR-uploadable twins under `api/uploads/*`, so they live here rather
// than being duplicated, forced into an action signature, or published as
// RPC endpoints none of their callers asked for.
import { mediaCategorySchema, type MediaCategory, type UploadPurpose } from "@repo/contracts";
import { requireAnyPermission, requirePermission, type Subject } from "@repo/rbac";

/**
 * ADR-066 §4 — the shelf, parsed and never inferred. `purpose` picks the
 * permission gate; this picks where the asset is filed, and the two are not
 * the same question. A missing or unregistered value is a rejection, not a
 * silent fallback: filing an asset in the wrong category is the failure mode
 * the required argument exists to prevent.
 */
export function readUploadCategory(formData: FormData): MediaCategory {
  return mediaCategorySchema.parse(formData.get("category"));
}

/**
 * The purpose-to-permission mapping, shared by `media-actions.ts` and the
 * XHR-uploadable route handlers under `api/uploads/*` (real upload-progress
 * events; see that folder's comment) so the two transports cannot drift
 * onto different gates.
 *
 * It lives here rather than in the "use server" module because it is a gate
 * helper, not an action: an export of that module is a real RPC endpoint,
 * and this is only ever called by server code that has already parsed the
 * purpose. security.md #1 is unaffected either way — the callers still gate
 * every mutation, and this is what they call to do it.
 */
export async function gateForPurpose(purpose: UploadPurpose): Promise<Subject> {
  switch (purpose) {
    case "brand":
      return requirePermission("theme.update");
    case "setting":
      return requirePermission("settings.update");
    case "article":
    case "content":
      return requireAnyPermission(["analysis.update", "news.manage"]);
  }
}
