// CardTemplate services (ADR-023, plan v2.2 §12 PR 4.3). "Referenced, not
// copied": editing a template updates every placement; deletion is refused
// while any `ContentReference` still points at it — the exact same guard
// `styles.ts` already uses for `StylePreset`, `refType: "CARD_TEMPLATE"`
// (that enum value has existed since Phase 1/2's schema, ADR-033 §4).
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { db } from "@repo/db";
import { can, ForbiddenError, type Subject } from "@repo/rbac";
import type { CreateCardTemplateInput, UpdateCardTemplateInput } from "@repo/contracts";
import { recordAudit } from "../index.ts";
import {
  CardTemplateInUseError,
  CardTemplateIsSystemError,
  CardTemplateKeyInUseError,
  CardTemplateNotFoundError,
} from "./errors.ts";

const PERMISSION = "cms.cards.manage";

export interface CardTemplateRow {
  id: string;
  key: string;
  name: string;
  contentType: string | null;
  variant: string;
  config: unknown;
  isSystem: boolean;
  previewImageId: string | null;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

async function usageCountsByTemplateId(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db.contentReference.groupBy({
    by: ["refId"],
    where: { refType: "CARD_TEMPLATE", refId: { in: ids } },
    _count: { refId: true },
  });
  return new Map(rows.map((r) => [r.refId, r._count.refId]));
}

export async function listCardTemplates(): Promise<CardTemplateRow[]> {
  const rows = await db.cardTemplate.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
  const usage = await usageCountsByTemplateId(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, usageCount: usage.get(r.id) ?? 0 }));
}

export async function getCardTemplate(id: string): Promise<CardTemplateRow | null> {
  const row = await db.cardTemplate.findUnique({ where: { id } });
  if (!row) return null;
  const usage = await usageCountsByTemplateId([id]);
  return { ...row, usageCount: usage.get(id) ?? 0 };
}

/** Cached read the renderer resolves a `collection`/`featured-content` block's `cardTemplateId` through — tagged so `updateCardTemplate` invalidates every placement in one call, no re-publish needed (ADR-023 §2). */
export async function getCardTemplateConfig(
  id: string,
): Promise<{ variant: string; config: unknown } | null> {
  "use cache";
  cacheTag(`card-template:${id}`);
  cacheLife({ revalidate: 300 });
  const row = await db.cardTemplate.findUnique({
    where: { id },
    select: { variant: true, config: true },
  });
  return row;
}

export async function createCardTemplate(
  actor: Subject,
  input: CreateCardTemplateInput,
): Promise<string> {
  if (!can(actor, PERMISSION)) throw new ForbiddenError(PERMISSION);

  const existing = await db.cardTemplate.findUnique({
    where: { key: input.key },
    select: { id: true },
  });
  if (existing) throw new CardTemplateKeyInUseError(input.key);

  const row = await db.cardTemplate.create({
    data: {
      key: input.key,
      name: input.name,
      contentType: input.contentType ?? null,
      variant: input.variant,
      config: input.config,
      createdById: actor.id,
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "cms.cards.create",
    entityType: "cardTemplate",
    entityId: row.id,
    changes: { after: input },
  });
  return row.id;
}

export async function updateCardTemplate(
  actor: Subject,
  id: string,
  input: UpdateCardTemplateInput,
): Promise<void> {
  if (!can(actor, PERMISSION)) throw new ForbiddenError(PERMISSION);

  const existing = await db.cardTemplate.findUnique({ where: { id } });
  if (!existing) throw new CardTemplateNotFoundError(id);
  if (existing.isSystem) throw new CardTemplateIsSystemError(existing.key);

  await db.cardTemplate.update({
    where: { id },
    data: {
      name: input.name,
      contentType: input.contentType,
      variant: input.variant,
      config: input.config,
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "cms.cards.update",
    entityType: "cardTemplate",
    entityId: id,
    changes: { after: input },
  });
  // Every placement re-resolves this template on next render — no
  // re-publish needed, the entire point of "referenced, not copied"
  // (ADR-023 §2).
  revalidateTag(`card-template:${id}`, { expire: 0 });
}

export async function deleteCardTemplate(actor: Subject, id: string): Promise<void> {
  if (!can(actor, PERMISSION)) throw new ForbiddenError(PERMISSION);

  const existing = await db.cardTemplate.findUnique({ where: { id } });
  if (!existing) throw new CardTemplateNotFoundError(id);
  if (existing.isSystem) throw new CardTemplateIsSystemError(existing.key);

  const usage = await usageCountsByTemplateId([id]);
  const usageCount = usage.get(id) ?? 0;
  if (usageCount > 0) throw new CardTemplateInUseError(usageCount);

  await db.cardTemplate.delete({ where: { id } });
  await recordAudit({
    userId: actor.id,
    action: "cms.cards.delete",
    entityType: "cardTemplate",
    entityId: id,
    changes: { before: { key: existing.key } },
  });
}
