"use server";

// Tool actions (Module 13, ADR-086 #6).
//
// Gate order per security.md #1: `requirePermission()` first, then the parse,
// then the `@repo/core` service.
//
// **Two keys, and the split is an editorial one.** `tools.update` writes the
// words on a tool page; `tools.publish` decides whether the site offers the
// tool at all. A content manager holds the first and not the second, exactly
// as a header publish stays with admin (seed.ts).
import { saveToolSchema } from "@repo/contracts";
import { reorderTools, saveTool, setToolEnabled } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const key = z.string().min(1).max(40);

/**
 * Tool copy is content, so it drops the `content` tag — not `market`.
 *
 * And `navigation`, because the on/off switch reaches the header (changes-26
 * #1): `loadMenuData` reads `Tool.isEnabled` to prune a row whose page would
 * 404, and that read is cached under the `navigation` tag. Dropped for every
 * write rather than only for `setToolEnabled`, since `saveTool` writes
 * `isEnabled` too — one invalidation nobody has to remember to widen.
 */
function invalidate(): void {
  revalidateTag("content", { expire: 0 });
  revalidateTag("navigation", { expire: 0 });
}

export async function saveToolAction(input: unknown): Promise<void> {
  const subject = await requirePermission("tools.update");
  const parsed = saveToolSchema.parse(input);
  await saveTool(subject, parsed);
  invalidate();
}

export async function setToolEnabledAction(toolKey: string, isEnabled: boolean): Promise<void> {
  // Whether the site OFFERS a tool is not a copy decision.
  const subject = await requirePermission("tools.publish");
  await setToolEnabled(subject, key.parse(toolKey), z.boolean().parse(isEnabled));
  invalidate();
}

export async function reorderToolsAction(orderedKeys: unknown): Promise<void> {
  const subject = await requirePermission("tools.update");
  const parsed = z.array(key).max(50).parse(orderedKeys);
  await reorderTools(subject, parsed);
  invalidate();
}
