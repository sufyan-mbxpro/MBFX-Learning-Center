// StylePreset services (ADR-033 §1-2/§4-5). "Linked": editing a preset
// updates every placement; deletion is refused while any
// `ContentReference` still points at it. System rows (seeded) are
// clone-only — the same posture ADR-016/ADR-023 already use for roles and
// card templates.
import { revalidateTag } from "next/cache";
import { db } from "@repo/db";
import { can, ForbiddenError, type Subject } from "@repo/rbac";
import type { CreateStylePresetInput, UpdateStylePresetInput } from "@repo/contracts";
import { recordAudit } from "../index.ts";
import {
  StylePresetInUseError,
  StylePresetIsSystemError,
  StylePresetKeyInUseError,
  StylePresetNotFoundError,
} from "./errors.ts";

const PERMISSION = "cms.styles.manage";

export interface StylePresetRow {
  id: string;
  key: string;
  name: string;
  scope: string;
  config: unknown;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

async function usageCountsByPresetId(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db.contentReference.groupBy({
    by: ["refId"],
    where: { refType: "STYLE_PRESET", refId: { in: ids } },
    _count: { refId: true },
  });
  return new Map(rows.map((r) => [r.refId, r._count.refId]));
}

export async function listStylePresets(): Promise<StylePresetRow[]> {
  const rows = await db.stylePreset.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
  const usage = await usageCountsByPresetId(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, usageCount: usage.get(r.id) ?? 0 }));
}

export async function getStylePreset(id: string): Promise<StylePresetRow | null> {
  const row = await db.stylePreset.findUnique({ where: { id } });
  if (!row) return null;
  const usage = await usageCountsByPresetId([id]);
  return { ...row, usageCount: usage.get(id) ?? 0 };
}

export async function createStylePreset(
  actor: Subject,
  input: CreateStylePresetInput,
): Promise<string> {
  if (!can(actor, PERMISSION)) throw new ForbiddenError(PERMISSION);

  const existing = await db.stylePreset.findUnique({
    where: { key: input.key },
    select: { id: true },
  });
  if (existing) throw new StylePresetKeyInUseError(input.key);

  const row = await db.stylePreset.create({
    data: {
      key: input.key,
      name: input.name,
      scope: input.scope,
      config: input.config,
      createdById: actor.id,
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "cms.styles.create",
    entityType: "stylePreset",
    entityId: row.id,
    changes: { after: input },
  });
  return row.id;
}

export async function updateStylePreset(
  actor: Subject,
  id: string,
  input: UpdateStylePresetInput,
): Promise<void> {
  if (!can(actor, PERMISSION)) throw new ForbiddenError(PERMISSION);

  const existing = await db.stylePreset.findUnique({ where: { id } });
  if (!existing) throw new StylePresetNotFoundError(id);
  if (existing.isSystem) throw new StylePresetIsSystemError(existing.key);

  await db.stylePreset.update({
    where: { id },
    data: {
      name: input.name,
      scope: input.scope,
      config: input.config,
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "cms.styles.update",
    entityType: "stylePreset",
    entityId: id,
    changes: { after: input },
  });
  // Every placement re-resolves this preset on next render — no re-publish
  // needed, which is the entire point of "linked" (ADR-033 §2).
  revalidateTag(`style-preset:${id}`, { expire: 0 });
}

export async function deleteStylePreset(actor: Subject, id: string): Promise<void> {
  if (!can(actor, PERMISSION)) throw new ForbiddenError(PERMISSION);

  const existing = await db.stylePreset.findUnique({ where: { id } });
  if (!existing) throw new StylePresetNotFoundError(id);
  if (existing.isSystem) throw new StylePresetIsSystemError(existing.key);

  const usage = await usageCountsByPresetId([id]);
  const usageCount = usage.get(id) ?? 0;
  if (usageCount > 0) throw new StylePresetInUseError(usageCount);

  await db.stylePreset.delete({ where: { id } });
  await recordAudit({
    userId: actor.id,
    action: "cms.styles.delete",
    entityType: "stylePreset",
    entityId: id,
    changes: { before: { key: existing.key } },
  });
}
