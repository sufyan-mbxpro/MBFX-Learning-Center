// @repo/settings — typed settings reader/writer + feature flags (Module 05,
// SKILL.md). Cache per ADR-004; tags `settings:{group}` (architecture.md
// #12, frozen).
//
// Deliberately has NO dependency on @repo/rbac or @repo/core, even though
// the SKILL.md write flow is "guarded by settings.update, writing audit
// rows" — architecture.md #8 fixes the direction as core → …/settings, so
// settings must not depend back on core (ADR-011 already chose this same
// split for recordAudit: core owns the write, call sites compose it with
// rbac's requirePermission). `updateSetting` here is the pure, already-
// authorized write; the future Server Action call site (Module 09's
// settings screen) is what does
//   requirePermission("settings.update") → updateSetting(...) → recordAudit(...)
// exactly as ADR-011 describes for every other mutation. This file's own
// integration test composes all three to prove the guarded path works end
// to end, without settings itself taking the dependency.
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { db, type FeatureVisibility } from "@repo/db";
import {
  SETTINGS_SCHEMAS,
  SETTING_GROUPS,
  isKnownSettingKey,
  type SettingKey,
  type SettingValue,
} from "@repo/contracts";

// ─────────────────────────────────────────────────────────────
// Settings — reads
// ─────────────────────────────────────────────────────────────

/**
 * Pure DB read, exported so tests and the writer can exercise it without
 * Next's `"use cache"` transform (ADR-004 — inert outside a real Next.js
 * build/dev process).
 *
 * Returns `null` for a genuinely missing key (not yet seeded) — never
 * throws for that case, since a missing optional setting is normal. A row
 * that exists but fails its own declared schema IS a data-integrity bug and
 * throws, surfacing it rather than silently returning a wrong-shaped value.
 */
export async function loadSetting<K extends SettingKey>(key: K): Promise<SettingValue<K> | null> {
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return null;
  const schema = SETTINGS_SCHEMAS[key];
  return schema.parse(row.value) as SettingValue<K>;
}

/**
 * Production entry point for a single typed setting, public or not. Callers
 * are responsible for their own authorization — this function does not
 * check `isPublic`, unlike `getPublicSettings` below, which enforces it
 * structurally. Use this only from server-only code that has already
 * decided the caller may see the value.
 */
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K> | null> {
  "use cache";
  cacheTag(`settings:${SETTING_GROUPS[key]}`);
  cacheLife({ revalidate: 300 });
  return loadSetting(key);
}

/**
 * Pure DB read, scoped to `isPublic: true` **in the query itself** —
 * security.md #12's leak test needs the non-public row to never leave the
 * database in the first place, not to be filtered out of an
 * already-fetched result after the fact.
 */
export async function loadPublicSettings(group: string): Promise<Record<string, unknown>> {
  const rows = await db.setting.findMany({
    where: { groupName: group, isPublic: true },
    orderBy: { sortOrder: "asc" },
  });

  const result: Record<string, unknown> = {};
  for (const row of rows) {
    result[row.key] = isKnownSettingKey(row.key)
      ? SETTINGS_SCHEMAS[row.key].parse(row.value)
      : row.value;
  }
  return result;
}

/** Production entry point for a group's public settings (safe for RSC props passed to Client Components). */
export async function getPublicSettings(group: string): Promise<Record<string, unknown>> {
  "use cache";
  cacheTag(`settings:${group}`);
  cacheLife({ revalidate: 300 });
  return loadPublicSettings(group);
}

// ─────────────────────────────────────────────────────────────
// Settings — admin reads (server-only; the settings screens are behind
// the STAFF gate + settings.view, and these deliberately include
// non-public rows — never pass the result to a Client Component prop on a
// public surface (security.md #12).
// ─────────────────────────────────────────────────────────────

export interface AdminSetting {
  key: string;
  groupName: string;
  value: unknown;
  type: string;
  label: string;
  description: string | null;
  isPublic: boolean;
  isTranslatable: boolean;
  sortOrder: number;
}

export async function loadAllSettings(): Promise<AdminSetting[]> {
  const rows = await db.setting.findMany({
    orderBy: [{ groupName: "asc" }, { sortOrder: "asc" }, { key: "asc" }],
  });
  return rows.map((r) => ({
    key: r.key,
    groupName: r.groupName,
    value: r.value,
    type: r.type,
    label: r.label,
    description: r.description,
    isPublic: r.isPublic,
    isTranslatable: r.isTranslatable,
    sortOrder: r.sortOrder,
  }));
}

export interface AdminFeatureFlag {
  key: string;
  label: string;
  description: string | null;
  isEnabled: boolean;
  visibility: FeatureVisibility;
  groupName: string;
  sortOrder: number;
}

export async function loadAllFeatureFlags(): Promise<AdminFeatureFlag[]> {
  const rows = await db.featureFlag.findMany({
    orderBy: [{ groupName: "asc" }, { sortOrder: "asc" }, { key: "asc" }],
  });
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    description: r.description,
    isEnabled: r.isEnabled,
    visibility: r.visibility,
    groupName: r.groupName,
    sortOrder: r.sortOrder,
  }));
}

// ─────────────────────────────────────────────────────────────
// Settings — writes
// ─────────────────────────────────────────────────────────────

export interface UpdateSettingResult<K extends SettingKey> {
  key: K;
  group: string;
  before: SettingValue<K> | null;
  after: SettingValue<K>;
}

/**
 * Pure, already-authorized write: validates the new value against the
 * key's declared schema (no number into an image slot), writes it, and
 * revalidates the group's cache tag. Does NOT check permissions and does
 * NOT write an audit row — see the file header. `actorId` only fills the
 * `Setting.updatedBy` column, a display convenience, not the audit trail.
 */
export async function updateSetting<K extends SettingKey>(
  key: K,
  value: SettingValue<K>,
  actorId: string,
): Promise<UpdateSettingResult<K>> {
  const schema = SETTINGS_SCHEMAS[key];
  const parsed = schema.parse(value) as SettingValue<K>;
  const group = SETTING_GROUPS[key];

  const before = await loadSetting(key);
  await db.setting.update({
    where: { key },
    data: { value: parsed as never, updatedBy: actorId },
  });
  revalidateTag(`settings:${group}`, { expire: 0 });

  return { key, group, before, after: parsed };
}

export interface UpdateSettingsEntry {
  key: SettingKey;
  value: unknown;
}

/**
 * One Save per settings section (changes-02). Validates EVERY entry against
 * its schema before writing ANY — a form with one bad field saves nothing,
 * so the admin never ends up half-applied — then writes each key and
 * invalidates each touched group's tag once.
 */
export async function updateSettings(
  entries: UpdateSettingsEntry[],
  actorId: string,
): Promise<UpdateSettingResult<SettingKey>[]> {
  const parsedEntries = entries.map(({ key, value }) => {
    const schema = SETTINGS_SCHEMAS[key];
    const result = schema.safeParse(value);
    if (!result.success) {
      const detail = result.error.issues.map((i) => i.message).join("; ");
      throw new Error(`${key}: ${detail}`);
    }
    return { key, value: result.data as SettingValue<typeof key> };
  });

  const results: UpdateSettingResult<SettingKey>[] = [];
  const groups = new Set<string>();
  for (const { key, value } of parsedEntries) {
    const group = SETTING_GROUPS[key];
    const before = await loadSetting(key);
    await db.setting.update({
      where: { key },
      data: { value: value as never, updatedBy: actorId },
    });
    groups.add(group);
    results.push({ key, group, before, after: value });
  }
  for (const group of groups) revalidateTag(`settings:${group}`, { expire: 0 });
  return results;
}

// ─────────────────────────────────────────────────────────────
// Feature flags
// ─────────────────────────────────────────────────────────────

/** Enough of a Subject to evaluate visibility — deliberately not `@repo/rbac`'s type, to avoid the dependency (see file header). */
export interface VisibilitySubject {
  userType: "LEARNER" | "STAFF";
}

export interface FeatureFlagState {
  key: string;
  isEnabled: boolean;
  visibility: FeatureVisibility;
}

export async function loadFeatureFlag(key: string): Promise<FeatureFlagState | null> {
  const row = await db.featureFlag.findUnique({ where: { key } });
  if (!row) return null;
  return { key: row.key, isEnabled: row.isEnabled, visibility: row.visibility };
}

/** Not one of architecture.md #12's frozen tags — feature flags are a separate model with no assigned tag there; minted here and noted in DEVLOG rather than silently reusing an unrelated one. */
const FEATURE_FLAGS_TAG = "feature-flags";

export async function getFeatureFlag(key: string): Promise<FeatureFlagState | null> {
  "use cache";
  cacheTag(FEATURE_FLAGS_TAG);
  cacheLife({ revalidate: 300 });
  return loadFeatureFlag(key);
}

export async function invalidateFeatureFlags(): Promise<void> {
  revalidateTag(FEATURE_FLAGS_TAG, { expire: 0 });
}

export interface SetFlagResult {
  key: string;
  before: boolean;
  after: boolean;
}

/**
 * Pure, already-authorized write (same split as updateSetting: the caller
 * runs requirePermission and writes the audit row). Revalidates both the
 * flags tag and — because flags feed navigation pruning — `navigation`.
 */
export async function setFeatureFlagEnabled(
  key: string,
  isEnabled: boolean,
): Promise<SetFlagResult> {
  const before = await db.featureFlag.findUniqueOrThrow({
    where: { key },
    select: { isEnabled: true },
  });
  await db.featureFlag.update({ where: { key }, data: { isEnabled } });
  revalidateTag(FEATURE_FLAGS_TAG, { expire: 0 });
  revalidateTag("navigation", { expire: 0 });
  return { key, before: before.isEnabled, after: isEnabled };
}

/**
 * `enabled × visibility × subject`. `PUBLIC` needs no session;
 * `AUTHENTICATED` needs any session; `ADMIN` and `PREMIUM` both require
 * staff — `PREMIUM`'s default is deliberate and conservative (ADR-012: no
 * entitlement model exists yet, so a learner never gets a tier that was
 * never actually granted).
 */
export function evaluateVisibility(
  visibility: FeatureVisibility,
  subject: VisibilitySubject | null,
): boolean {
  switch (visibility) {
    case "PUBLIC":
      return true;
    case "AUTHENTICATED":
      return subject !== null;
    case "PREMIUM": // ADR-012
    case "ADMIN":
      return subject?.userType === "STAFF";
  }
}

export function isFlagVisible(flag: FeatureFlagState, subject: VisibilitySubject | null): boolean {
  return flag.isEnabled && evaluateVisibility(flag.visibility, subject);
}

/** Production entry point: cached lookup + visibility evaluation for one flag. A missing/unseeded key is never visible. */
export async function isFeatureVisible(
  key: string,
  subject: VisibilitySubject | null,
): Promise<boolean> {
  const flag = await getFeatureFlag(key);
  return flag !== null && isFlagVisible(flag, subject);
}
