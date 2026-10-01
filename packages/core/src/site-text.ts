// Settings → Translation → Site text (ADR-165 #8), and what an English save of
// a translatable setting does to its translations (#7) and to switching a
// language on (#9).
//
// The callers have run `requirePermission()` and parsed input with the
// `@repo/contracts` schema. Every save here writes one audit row.
import {
  TRANSLATABLE_SETTINGS,
  isTranslatableSettingKey,
  settingTranslationSchema,
  type SettingTextFields,
  type SettingTranslationSaveInput,
  type TranslatableSetting,
  type TranslatableSettingKey,
} from "@repo/contracts";
import { TranslationStatus, db } from "@repo/db";
import { invalidateSettingGroup } from "@repo/settings";

import { recordAudit } from "./index.ts";
import {
  hasSettingText,
  hashSettingSource,
  loadSettingSourceByKey,
  loadSettingSources,
} from "./setting-source.ts";
import { afterSourceSave } from "./translation-queue.ts";

async function defaultLocaleCode(): Promise<string> {
  return (
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en"
  );
}

/** The words of a stored translation, by field; anything else is dropped. */
function storedFields(key: TranslatableSettingKey, value: unknown): SettingTextFields {
  const entry: TranslatableSetting = TRANSLATABLE_SETTINGS[key];
  const out: SettingTextFields = {};
  for (const field of Object.keys(entry.fields)) {
    const raw =
      value !== null && typeof value === "object"
        ? (value as Record<string, unknown>)[field]
        : undefined;
    out[field] = typeof raw === "string" ? raw : "";
  }
  return out;
}

// ─── The editor ───────────────────────────────────────────────────────────

export interface SiteTextField {
  name: string;
  max: number;
  multiline: boolean;
  english: string;
  translated: string;
}

export interface SiteTextEntry {
  key: TranslatableSettingKey;
  /** The setting's own admin label (English-only, ADR-043 #2). */
  label: string;
  machine: boolean;
  fields: SiteTextField[];
  /** Null when this language has no row. */
  status: TranslationStatus | null;
  /** A row whose English has moved on since it was written. */
  stale: boolean;
}

/** Every seeded translatable setting in one language, in registry order. */
export async function loadSiteText(locale: string): Promise<SiteTextEntry[]> {
  const sources = await loadSettingSources(db);
  const rows = await db.settingTranslation.findMany({
    where: { locale, settingId: { in: sources.map((s) => s.id) } },
    select: { settingId: true, value: true, translationStatus: true, sourceHash: true },
  });
  const rowOf = new Map(rows.map((row) => [row.settingId, row]));

  return sources.map((source) => {
    const entry: TranslatableSetting = TRANSLATABLE_SETTINGS[source.key];
    const row = rowOf.get(source.id);
    const translated = row ? storedFields(source.key, row.value) : {};
    return {
      key: source.key,
      label: source.label,
      machine: source.machine,
      fields: Object.entries(entry.fields).map(([name, spec]) => ({
        name,
        max: spec.max,
        multiline: spec.multiline,
        english: source.fields[name] ?? "",
        translated: translated[name] ?? "",
      })),
      status: row?.translationStatus ?? null,
      stale: row ? row.sourceHash !== hashSettingSource(source) : false,
    };
  });
}

export type SaveSettingTranslationResult =
  | { ok: true; status: TranslationStatus | null }
  | { ok: false; reason: "unknownLocale" | "isDefault" | "notSeeded" };

/**
 * A person's translation of one setting (ADR-165 #8): TRANSLATED, with the
 * hash of the English it was made from. Every field blank means "no
 * translation" and deletes the row, so the English shows and a `legal` key
 * counts as missing again. Refuses a translation that lost a `{token}`, by
 * the schema the form runs.
 */
export async function saveSettingTranslation(
  actorId: string,
  input: SettingTranslationSaveInput,
): Promise<SaveSettingTranslationResult> {
  const locale = await db.locale.findUnique({
    where: { code: input.locale },
    select: { isDefault: true },
  });
  if (!locale) return { ok: false, reason: "unknownLocale" };
  if (locale.isDefault) return { ok: false, reason: "isDefault" };

  const source = await loadSettingSourceByKey(db, input.key);
  if (!source) return { ok: false, reason: "notSeeded" };
  const fields = settingTranslationSchema(input.key, source.fields).parse(input.fields);

  const before = await db.settingTranslation.findUnique({
    where: { settingId_locale: { settingId: source.id, locale: input.locale } },
    select: { value: true, translationStatus: true },
  });

  let status: TranslationStatus | null = null;
  if (Object.values(fields).every((text) => text === "")) {
    await db.settingTranslation.deleteMany({
      where: { settingId: source.id, locale: input.locale },
    });
  } else {
    status = TranslationStatus.TRANSLATED;
    const data = {
      value: fields,
      translationStatus: status,
      sourceHash: hashSettingSource(source),
      updatedBy: actorId,
    };
    await db.settingTranslation.upsert({
      where: { settingId_locale: { settingId: source.id, locale: input.locale } },
      update: data,
      create: { settingId: source.id, locale: input.locale, ...data },
    });
  }

  await recordAudit({
    userId: actorId,
    action: "settings.translate",
    entityType: "setting",
    entityId: `${source.key}:${input.locale}`,
    changes: {
      before: before ? { value: before.value, status: before.translationStatus } : null,
      after: status ? { value: fields, status } : null,
    },
  });
  invalidateSettingGroup(source.group);
  return { ok: true, status };
}

// ─── An English save ──────────────────────────────────────────────────────

/**
 * After Settings saved these keys in English (ADR-165 #7): a person's
 * TRANSLATED row whose words have moved on becomes OUTDATED, and a machine
 * key is queued. Returns the setting ids the caller should drain in
 * `after()`. A key that is not translatable is ignored.
 */
export async function afterSettingsSaved(keys: readonly string[]): Promise<string[]> {
  const translatable = [...new Set(keys)].filter(isTranslatableSettingKey);
  if (translatable.length === 0) return [];
  const defaultLocale = await defaultLocaleCode();
  const queued: string[] = [];
  for (const key of translatable) {
    const source = await loadSettingSourceByKey(db, key);
    if (!source) continue;
    const enqueue = source.machine && hasSettingText(source);
    await afterSourceSave("setting", source.id, hashSettingSource(source), defaultLocale, {
      enqueue,
    });
    if (enqueue) queued.push(source.id);
  }
  return queued;
}

// ─── Switching a language on ──────────────────────────────────────────────

/**
 * The human-only keys (ADR-165 #6) with English words and no translation in
 * `locale`. Switching the language on is refused while any remain (#9): the
 * machine will never fill them. An OUTDATED row counts as present — it is a
 * person's, and it is served.
 */
export async function siteTextGaps(locale: string): Promise<TranslatableSettingKey[]> {
  const sources = (await loadSettingSources(db)).filter((s) => !s.machine && hasSettingText(s));
  if (sources.length === 0) return [];
  const rows = await db.settingTranslation.findMany({
    where: { locale, settingId: { in: sources.map((s) => s.id) } },
    select: { settingId: true, value: true },
  });
  const present = new Set(
    rows
      .filter((row) => {
        const source = sources.find((s) => s.id === row.settingId);
        return (
          source !== undefined &&
          Object.values(storedFields(source.key, row.value)).some((text) => text.trim() !== "")
        );
      })
      .map((row) => row.settingId),
  );
  return sources.filter((s) => !present.has(s.id)).map((s) => s.key);
}
