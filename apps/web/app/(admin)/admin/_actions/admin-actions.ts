"use server";

// Admin mutations (Module 09). Every action follows security.md #1/#5/#6:
// requirePermission() is the FIRST line, input is parsed before use, the
// service writes the audit row, tags revalidate inside the service. These
// stay thin — the logic lives in @repo/core / @repo/settings where it's
// integration-tested at the DB level.
import { z } from "zod";
import {
  activateTheme,
  createSocialLink,
  deleteSocialLink,
  moveMenuItem,
  recordAudit,
  saveTheme,
  setMenuItemActive,
  setSocialLinkActive,
  updateSocialLink,
  type SaveThemeResult,
} from "@repo/core";
import { requirePermission } from "@repo/rbac";
import {
  createSocialLinkSchema,
  isKnownSettingKey,
  saveThemeSchema,
  updateSettingsBatchSchema,
  updateSocialLinkSchema,
  type SettingKey,
} from "@repo/contracts";
import { setFeatureFlagEnabled, updateSettings } from "@repo/settings";
import { DEFAULT_LAYOUT, isCuratedFontKey } from "@repo/theme";

/**
 * One Save per settings section (changes-02): every changed key in one
 * call. @repo/settings validates all entries before writing any; one audit
 * row per key so the log reads the same as single-field saves did.
 */
export async function updateSettingsAction(input: unknown): Promise<void> {
  const subject = await requirePermission("settings.update");
  const entries = updateSettingsBatchSchema.parse(input);
  const unknown = entries.filter((e) => !isKnownSettingKey(e.key));
  if (unknown.length > 0) {
    throw new Error(`Unknown setting keys: ${unknown.map((e) => e.key).join(", ")}`);
  }
  const results = await updateSettings(
    entries.map((e) => ({ key: e.key as SettingKey, value: e.value })),
    subject.id,
  );
  for (const result of results) {
    await recordAudit({
      userId: subject.id,
      action: "settings.update",
      entityType: "setting",
      entityId: result.key,
      changes: { before: result.before, after: result.after },
    });
  }
}

export async function toggleFeatureFlagAction(key: string, isEnabled: boolean): Promise<void> {
  const subject = await requirePermission("features.manage");
  const parsed = z
    .object({ key: z.string().min(1), isEnabled: z.boolean() })
    .parse({ key, isEnabled });

  const result = await setFeatureFlagEnabled(parsed.key, parsed.isEnabled);
  await recordAudit({
    userId: subject.id,
    action: "features.toggle",
    entityType: "featureFlag",
    entityId: parsed.key,
    changes: { before: { isEnabled: result.before }, after: { isEnabled: result.after } },
  });
}

export async function moveMenuItemAction(itemId: string, direction: "up" | "down"): Promise<void> {
  const subject = await requirePermission("navigation.manage");
  const parsed = z
    .object({ itemId: z.string().min(1), direction: z.enum(["up", "down"]) })
    .parse({ itemId, direction });
  await moveMenuItem(subject.id, parsed.itemId, parsed.direction);
}

export async function toggleMenuItemAction(itemId: string, isActive: boolean): Promise<void> {
  const subject = await requirePermission("navigation.manage");
  const parsed = z
    .object({ itemId: z.string().min(1), isActive: z.boolean() })
    .parse({ itemId, isActive });
  await setMenuItemActive(subject.id, parsed.itemId, parsed.isActive);
}

export async function toggleSocialLinkAction(platform: string, isActive: boolean): Promise<void> {
  const subject = await requirePermission("social.manage");
  const parsed = z
    .object({ platform: z.string().min(1), isActive: z.boolean() })
    .parse({ platform, isActive });
  await setSocialLinkActive(subject.id, parsed.platform, parsed.isActive);
}

// ─── Social links CRUD (changes-01) ──────────────────────────

export async function createSocialLinkAction(input: unknown): Promise<void> {
  const subject = await requirePermission("social.manage");
  const { platform, ...rest } = createSocialLinkSchema.parse(input);
  await createSocialLink(subject.id, platform, rest);
}

export async function updateSocialLinkAction(platform: string, input: unknown): Promise<void> {
  const subject = await requirePermission("social.manage");
  await updateSocialLink(
    subject.id,
    z.string().min(1).parse(platform),
    updateSocialLinkSchema.parse(input),
  );
}

export async function deleteSocialLinkAction(platform: string): Promise<void> {
  const subject = await requirePermission("social.manage");
  await deleteSocialLink(subject.id, z.string().min(1).parse(platform));
}

export async function saveThemeAction(input: unknown): Promise<SaveThemeResult> {
  const subject = await requirePermission("theme.update");
  const parsed = saveThemeSchema.parse(input);
  // fontSans/fontMono/baseFontSize are loosely typed in the schema (contracts
  // doesn't depend on @repo/theme for one enum, and some pre-existing rows
  // predate baseFontSize) — resolve them into the strict SaveThemeInput
  // shape here, same defensive fallback loadActiveTheme already uses for an
  // invalid/removed curated font key.
  return saveTheme(subject.id, {
    ...parsed,
    layoutTokens: {
      ...parsed.layoutTokens,
      fontSans: isCuratedFontKey(parsed.layoutTokens.fontSans) ? parsed.layoutTokens.fontSans : "system",
      fontMono: isCuratedFontKey(parsed.layoutTokens.fontMono)
        ? parsed.layoutTokens.fontMono
        : "systemmono",
      baseFontSize: parsed.layoutTokens.baseFontSize ?? DEFAULT_LAYOUT.baseFontSize,
    },
  });
}

export async function activateThemeAction(themeKey: string): Promise<void> {
  const subject = await requirePermission("theme.update");
  await activateTheme(subject.id, z.string().min(1).parse(themeKey));
}
