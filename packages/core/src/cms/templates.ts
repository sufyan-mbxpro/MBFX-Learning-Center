// LayoutTemplate services (ADR-033 §1/§3/§5). "Start from": inserting a
// template copies its layout; the placed copy carries no id back to the
// template (no propagation, no deletion guard needed for that reason).
// `PageVersion.templateKey` (ADR-032 §6) records provenance for reporting
// only — usage counts here are informational, never a deletion blocker.
import { db, type LayoutTemplateKind } from "@repo/db";
import { can, ForbiddenError, type Subject } from "@repo/rbac";
import type { CreateLayoutTemplateInput, UpdateLayoutTemplateInput } from "@repo/contracts";
import { recordAudit } from "../index.ts";
import {
  LayoutTemplateIsSystemError,
  LayoutTemplateKeyInUseError,
  LayoutTemplateNotFoundError,
} from "./errors.ts";

const PERMISSION = "cms.templates.manage";

export interface LayoutTemplateRow {
  id: string;
  key: string;
  name: string;
  kind: LayoutTemplateKind;
  pageKind: string | null;
  partKey: string | null;
  layout: unknown;
  previewImageId: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

async function usageCountsByKey(keys: string[]): Promise<Map<string, number>> {
  if (keys.length === 0) return new Map();
  const rows = await db.pageVersion.groupBy({
    by: ["templateKey"],
    where: { templateKey: { in: keys } },
    _count: { templateKey: true },
  });
  return new Map(rows.map((r) => [r.templateKey as string, r._count.templateKey]));
}

export async function listLayoutTemplates(kind?: LayoutTemplateKind): Promise<LayoutTemplateRow[]> {
  const rows = await db.layoutTemplate.findMany({
    where: kind ? { kind } : undefined,
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  const usage = await usageCountsByKey(rows.map((r) => r.key));
  return rows.map((r) => ({ ...r, usageCount: usage.get(r.key) ?? 0 }));
}

export async function getLayoutTemplate(id: string): Promise<LayoutTemplateRow | null> {
  const row = await db.layoutTemplate.findUnique({ where: { id } });
  if (!row) return null;
  const usage = await usageCountsByKey([row.key]);
  return { ...row, usageCount: usage.get(row.key) ?? 0 };
}

export async function createLayoutTemplate(
  actor: Subject,
  input: CreateLayoutTemplateInput,
): Promise<string> {
  if (!can(actor, PERMISSION)) throw new ForbiddenError(PERMISSION);

  const existing = await db.layoutTemplate.findUnique({
    where: { key: input.key },
    select: { id: true },
  });
  if (existing) throw new LayoutTemplateKeyInUseError(input.key);

  const row = await db.layoutTemplate.create({
    data: {
      key: input.key,
      name: input.name,
      kind: input.kind,
      pageKind: input.pageKind ?? null,
      partKey: input.partKey ?? null,
      layout: input.layout as never,
      previewImageId: input.previewImageId ?? null,
      createdById: actor.id,
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "cms.templates.create",
    entityType: "layoutTemplate",
    entityId: row.id,
    changes: { after: { key: input.key, name: input.name, kind: input.kind } },
  });
  return row.id;
}

export async function updateLayoutTemplate(
  actor: Subject,
  id: string,
  input: UpdateLayoutTemplateInput,
): Promise<void> {
  if (!can(actor, PERMISSION)) throw new ForbiddenError(PERMISSION);

  const existing = await db.layoutTemplate.findUnique({ where: { id } });
  if (!existing) throw new LayoutTemplateNotFoundError(id);
  if (existing.isSystem) throw new LayoutTemplateIsSystemError(existing.key);

  await db.layoutTemplate.update({
    where: { id },
    data: {
      name: input.name,
      layout: input.layout as never,
      previewImageId: input.previewImageId,
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "cms.templates.update",
    entityType: "layoutTemplate",
    entityId: id,
    changes: { after: { name: input.name } },
  });
}

export async function deleteLayoutTemplate(actor: Subject, id: string): Promise<void> {
  if (!can(actor, PERMISSION)) throw new ForbiddenError(PERMISSION);

  const existing = await db.layoutTemplate.findUnique({ where: { id } });
  if (!existing) throw new LayoutTemplateNotFoundError(id);
  if (existing.isSystem) throw new LayoutTemplateIsSystemError(existing.key);

  await db.layoutTemplate.delete({ where: { id } });
  await recordAudit({
    userId: actor.id,
    action: "cms.templates.delete",
    entityType: "layoutTemplate",
    entityId: id,
    changes: { before: { key: existing.key } },
  });
}
