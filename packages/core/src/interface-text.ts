// Settings → Translation → Interface text (ADR-178 #3–#5): the site's fixed
// public strings, language by language, with the English beside each one.
//
// The shipped text is the catalog FILES; what an admin changes is a
// `MessageOverride` row laid over them at request time (`@repo/i18n`
// `catalog.ts`). Only PUBLIC namespaces: the admin portal is English-only by
// design (ADR-043 #2), so an admin key is refused here, not just hidden.
//
// Callers have run `requirePermission()` (`translations.update` to edit,
// `translations.approve` to machine-fill, which spends) and parsed the input
// with `@repo/contracts`.
import { db } from "@repo/db";
import {
  ADMIN_MESSAGE_NAMESPACES,
  catalogValueAt,
  checkMessageShape,
  flattenMessageKeys,
  invalidateMessages,
  loadCatalogFile,
  loadMergedCatalog,
  loadMessageOverrides,
  type Catalog,
  type MessageShapeProblem,
} from "@repo/i18n";
import {
  planMessage,
  reasonOf,
  translateCatalogMessages,
  translateSegments,
} from "@repo/translate";
import type {
  InterfaceTextFillInput,
  InterfaceTextResetInput,
  InterfaceTextSaveInput,
  TranslateReason,
} from "@repo/contracts";

import { recordAudit } from "./index.ts";

/** Keys "Translate missing with Google" fills per press (ADR-178 #5). */
export const INTERFACE_TEXT_FILL_LIMIT = 200;

/**
 * - `shipped`: the catalog file's text, untouched.
 * - `edited`: a person replaced it (or wrote it, for a key the file lacks).
 * - `machine`: Google wrote it and no person has saved it since.
 * - `missing`: nothing in this language; readers see the English.
 */
export type InterfaceTextState = "shipped" | "edited" | "machine" | "missing";

export interface InterfaceTextRow {
  key: string;
  /** The English a reader of the English site sees, overrides included. */
  english: string;
  /** This language's text, or null when missing. */
  value: string | null;
  state: InterfaceTextState;
}

export interface InterfaceTextNamespace {
  name: string;
  total: number;
  missing: number;
}

export interface InterfaceTextView {
  locale: string;
  isDefault: boolean;
  namespaces: InterfaceTextNamespace[];
  /** The namespace shown; null when there is none. */
  namespace: string | null;
  rows: InterfaceTextRow[];
}

const namespaceOf = (key: string) => key.split(".")[0] ?? "";
const isPublicKey = (key: string) => !ADMIN_MESSAGE_NAMESPACES.has(namespaceOf(key));

/** Every public key in the English FILE: the set of strings the code uses. */
function publicKeys(englishFile: Catalog): string[] {
  return flattenMessageKeys(englishFile).filter(
    (key) => isPublicKey(key) && typeof catalogValueAt(englishFile, key) === "string",
  );
}

async function defaultLocaleCode(): Promise<string> {
  return (
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en"
  );
}

/** One language's interface text, one namespace at a time (3,000+ keys in all). */
export async function loadInterfaceText(
  locale: string,
  requestedNamespace?: string,
): Promise<InterfaceTextView> {
  const defaultLocale = await defaultLocaleCode();
  const isDefault = locale === defaultLocale;
  const [englishFile, englishMerged, localeFile, overrides] = await Promise.all([
    loadCatalogFile(defaultLocale),
    loadMergedCatalog(defaultLocale),
    loadCatalogFile(locale),
    loadMessageOverrides(locale),
  ]);
  const byKey = new Map(overrides.map((row) => [row.key, row]));

  const rows: InterfaceTextRow[] = publicKeys(englishFile).map((key) => {
    const override = byKey.get(key);
    const shipped = catalogValueAt(isDefault ? englishFile : localeFile, key);
    const english = catalogValueAt(isDefault ? englishFile : englishMerged, key);
    const value = override?.value ?? (typeof shipped === "string" ? shipped : null);
    const state: InterfaceTextState = override
      ? override.isMachine
        ? "machine"
        : "edited"
      : value === null
        ? "missing"
        : "shipped";
    return { key, english: typeof english === "string" ? english : "", value, state };
  });

  const counts = new Map<string, InterfaceTextNamespace>();
  for (const row of rows) {
    const name = namespaceOf(row.key);
    const entry = counts.get(name) ?? { name, total: 0, missing: 0 };
    entry.total += 1;
    if (row.state === "missing") entry.missing += 1;
    counts.set(name, entry);
  }
  const namespaces = [...counts.values()].sort((a, b) => a.name.localeCompare(b.name));
  const namespace =
    namespaces.find((n) => n.name === requestedNamespace)?.name ??
    namespaces.find((n) => n.missing > 0)?.name ??
    namespaces[0]?.name ??
    null;

  return {
    locale,
    isDefault,
    namespaces,
    namespace,
    rows: rows.filter((row) => namespaceOf(row.key) === namespace),
  };
}

export type InterfaceTextRefusal =
  | "unknownLocale"
  | "unknownKey"
  | "adminKey"
  | MessageShapeProblem;

export type InterfaceTextSaveResult = { ok: true } | { ok: false; reason: InterfaceTextRefusal };

/**
 * Saves a person's text for one key. A value equal to the shipped text
 * removes the override instead, so the table holds only real changes.
 */
export async function saveInterfaceText(
  userId: string,
  input: InterfaceTextSaveInput,
): Promise<InterfaceTextSaveResult> {
  if (!isPublicKey(input.key)) return { ok: false, reason: "adminKey" };
  if ((await db.locale.count({ where: { code: input.locale } })) === 0) {
    return { ok: false, reason: "unknownLocale" };
  }
  const defaultLocale = await defaultLocaleCode();
  const english = catalogValueAt(await loadCatalogFile(defaultLocale), input.key);
  if (typeof english !== "string") return { ok: false, reason: "unknownKey" };
  const problem = checkMessageShape(english, input.value);
  if (problem) return { ok: false, reason: problem };

  const where = { locale_key: { locale: input.locale, key: input.key } };
  const before = await db.messageOverride.findUnique({ where, select: { value: true } });
  const shipped = catalogValueAt(await loadCatalogFile(input.locale), input.key);

  if (shipped === input.value) {
    await db.messageOverride.deleteMany({ where: { locale: input.locale, key: input.key } });
  } else {
    await db.messageOverride.upsert({
      where,
      create: {
        locale: input.locale,
        key: input.key,
        value: input.value,
        isMachine: false,
        updatedBy: userId,
      },
      update: { value: input.value, isMachine: false, updatedBy: userId },
    });
  }
  await recordAudit({
    userId,
    action: "messages.update",
    entityType: "MessageOverride",
    entityId: `${input.locale}:${input.key}`,
    changes: { before: before?.value ?? null, after: input.value },
  });
  await invalidateMessages();
  return { ok: true };
}

/** Removes one override: the key goes back to its shipped text, or to missing. */
export async function resetInterfaceText(
  userId: string,
  input: InterfaceTextResetInput,
): Promise<{ ok: true }> {
  const { count } = await db.messageOverride.deleteMany({
    where: { locale: input.locale, key: input.key },
  });
  if (count > 0) {
    await recordAudit({
      userId,
      action: "messages.reset",
      entityType: "MessageOverride",
      entityId: `${input.locale}:${input.key}`,
    });
    await invalidateMessages();
  }
  return { ok: true };
}

export type InterfaceTextFillResult =
  | {
      ok: true;
      translated: number;
      failed: number;
      /** Missing keys the machine can translate, still to do. */
      remaining: number;
      /** Missing keys whose English the pipeline cannot take; a person writes these. */
      manual: number;
    }
  | { ok: false; reason: "unknownLocale" | "isDefault" | TranslateReason };

/**
 * "Translate missing with Google" (ADR-178 #5): up to
 * `INTERFACE_TEXT_FILL_LIMIT` missing public keys, through the ICU-safe
 * pipeline `pnpm translate:catalog` uses and the one metered door. Writes only
 * keys that still have no row when it commits (`skipDuplicates`), so a
 * person's text saved meanwhile is never replaced.
 */
export async function fillInterfaceText(
  userId: string,
  input: InterfaceTextFillInput,
): Promise<InterfaceTextFillResult> {
  const row = await db.locale.findUnique({
    where: { code: input.locale },
    select: { code: true, isDefault: true },
  });
  if (!row) return { ok: false, reason: "unknownLocale" };
  if (row.isDefault) return { ok: false, reason: "isDefault" };
  const defaultLocale = await defaultLocaleCode();

  const [englishFile, englishMerged, target] = await Promise.all([
    loadCatalogFile(defaultLocale),
    loadMergedCatalog(defaultLocale),
    loadMergedCatalog(row.code),
  ]);
  const missing = publicKeys(englishFile).filter(
    (key) => typeof catalogValueAt(target, key) !== "string",
  );
  // A message the pipeline cannot plan fails the same way on every press, so
  // left in the queue it would sit at the front of every batch for ever.
  const machinable = missing.filter((key) => {
    try {
      planMessage(catalogValueAt(englishMerged, key) as string);
      return true;
    } catch {
      return false;
    }
  });
  const manual = missing.length - machinable.length;
  const batch = machinable.slice(0, INTERFACE_TEXT_FILL_LIMIT);
  if (batch.length === 0) return { ok: true, translated: 0, failed: 0, remaining: 0, manual };

  const source = Object.fromEntries(
    batch.map((key) => [key, catalogValueAt(englishMerged, key) as string]),
  );
  let result;
  try {
    result = await translateCatalogMessages(source, row.code, (units) =>
      translateSegments(units, "html", {
        source: defaultLocale,
        target: row.code,
        userId,
        entity: { type: "catalog", id: row.code },
      }),
    );
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }

  const translated = Object.entries(result.translated);
  if (translated.length > 0) {
    await db.messageOverride.createMany({
      data: translated.map(([key, value]) => ({
        locale: row.code,
        key,
        value,
        isMachine: true,
        updatedBy: userId,
      })),
      skipDuplicates: true,
    });
    await invalidateMessages();
  }
  await recordAudit({
    userId,
    action: "messages.fill",
    entityType: "Locale",
    entityId: row.code,
    changes: { after: { translated: translated.length, failed: result.failed.length } },
  });
  return {
    ok: true,
    translated: translated.length,
    failed: result.failed.length,
    remaining: machinable.length - translated.length,
    manual,
  };
}
