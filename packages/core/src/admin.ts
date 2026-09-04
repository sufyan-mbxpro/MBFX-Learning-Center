// Admin-shell mutation services (Module 09). Pattern per ADR-011: these
// are the already-authorized writes — the Server Action call site runs
// requirePermission() FIRST, then calls these; each writes its own audit
// row (security.md #5) and revalidates the tags it dirties. Keeping the
// logic here (not in the actions) keeps apps thin and makes the mutations
// integration-testable at the DB level without a Next request context.
import { revalidateTag } from "next/cache";
import { db } from "@repo/db";
import {
  validateTheme,
  type BrandColors,
  type BrandOverrides,
  type LayoutTokens,
  type SurfacePalette,
  type ContrastIssue,
} from "@repo/theme";
import { recordAudit } from "./index.ts";

// ─── Navigation manager ──────────────────────────────────────

export async function moveMenuItem(
  actorId: string,
  itemId: string,
  direction: "up" | "down",
): Promise<void> {
  const item = await db.menuItem.findUniqueOrThrow({ where: { id: itemId } });
  const sibling = await db.menuItem.findFirst({
    where: {
      menuId: item.menuId,
      parentId: item.parentId,
      sortOrder: direction === "up" ? { lt: item.sortOrder } : { gt: item.sortOrder },
    },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!sibling) return; // already at the edge

  await db.$transaction([
    db.menuItem.update({ where: { id: item.id }, data: { sortOrder: sibling.sortOrder } }),
    db.menuItem.update({ where: { id: sibling.id }, data: { sortOrder: item.sortOrder } }),
  ]);
  await recordAudit({
    userId: actorId,
    action: "navigation.reorder",
    entityType: "menuItem",
    entityId: itemId,
    changes: { before: { sortOrder: item.sortOrder }, after: { sortOrder: sibling.sortOrder } },
  });
  revalidateTag("navigation", { expire: 0 });
}

export async function setMenuItemActive(
  actorId: string,
  itemId: string,
  isActive: boolean,
): Promise<void> {
  const before = await db.menuItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { isActive: true },
  });
  await db.menuItem.update({ where: { id: itemId }, data: { isActive } });
  await recordAudit({
    userId: actorId,
    action: "navigation.toggle",
    entityType: "menuItem",
    entityId: itemId,
    changes: { before: { isActive: before.isActive }, after: { isActive } },
  });
  revalidateTag("navigation", { expire: 0 });
}

// ─── Social links ────────────────────────────────────────────

export async function setSocialLinkActive(
  actorId: string,
  platform: string,
  isActive: boolean,
): Promise<void> {
  const before = await db.socialLink.findUniqueOrThrow({
    where: { platform },
    select: { isActive: true },
  });
  await db.socialLink.update({ where: { platform }, data: { isActive } });
  await recordAudit({
    userId: actorId,
    action: "social.toggle",
    entityType: "socialLink",
    entityId: platform,
    changes: { before: { isActive: before.isActive }, after: { isActive } },
  });
  revalidateTag("navigation", { expire: 0 });
}

export interface SocialLinkInput {
  label: string;
  url: string;
  handle?: string;
  isActive?: boolean;
  openInNewTab?: boolean;
  showInHeader?: boolean;
  showInFooter?: boolean;
}

/** Full CRUD (changes-01): the toggle above predates it and stays for the
 * quick active/inactive flip; these own create/edit/delete. All under
 * `social.manage`, all invalidating `navigation` (the tag social shares
 * with the header/footer chrome it renders in). */
export async function createSocialLink(
  actorId: string,
  platform: string,
  input: SocialLinkInput,
): Promise<void> {
  const existing = await db.socialLink.findUnique({ where: { platform }, select: { id: true } });
  if (existing) throw new Error(`Social link "${platform}" already exists`);
  const last = await db.socialLink.aggregate({ _max: { sortOrder: true } });

  await db.socialLink.create({
    data: {
      platform,
      label: input.label,
      url: input.url,
      // Icon key defaults to the platform slug — the renderer falls back to
      // a generic link icon for keys it doesn't recognize.
      icon: platform,
      handle: input.handle,
      isActive: input.isActive ?? true,
      openInNewTab: input.openInNewTab ?? true,
      showInHeader: input.showInHeader ?? false,
      showInFooter: input.showInFooter ?? true,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  });
  await recordAudit({
    userId: actorId,
    action: "social.create",
    entityType: "socialLink",
    entityId: platform,
    changes: { after: { label: input.label, url: input.url } },
  });
  revalidateTag("navigation", { expire: 0 });
}

export async function updateSocialLink(
  actorId: string,
  platform: string,
  input: Partial<SocialLinkInput>,
): Promise<void> {
  const before = await db.socialLink.findUniqueOrThrow({
    where: { platform },
    select: { label: true, url: true, handle: true, isActive: true },
  });
  await db.socialLink.update({
    where: { platform },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(input.handle !== undefined ? { handle: input.handle } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.openInNewTab !== undefined ? { openInNewTab: input.openInNewTab } : {}),
      ...(input.showInHeader !== undefined ? { showInHeader: input.showInHeader } : {}),
      ...(input.showInFooter !== undefined ? { showInFooter: input.showInFooter } : {}),
    },
  });
  await recordAudit({
    userId: actorId,
    action: "social.update",
    entityType: "socialLink",
    entityId: platform,
    changes: { before, after: input },
  });
  revalidateTag("navigation", { expire: 0 });
}

export async function deleteSocialLink(actorId: string, platform: string): Promise<void> {
  const before = await db.socialLink.findUniqueOrThrow({
    where: { platform },
    select: { label: true, url: true },
  });
  await db.socialLink.delete({ where: { platform } });
  await recordAudit({
    userId: actorId,
    action: "social.delete",
    entityType: "socialLink",
    entityId: platform,
    changes: { before },
  });
  revalidateTag("navigation", { expire: 0 });
}

// ─── Theme editor ────────────────────────────────────────────

export interface SaveThemeInput {
  themeKey: string;
  brandColors: BrandColors;
  lightSurface: SurfacePalette;
  darkSurface: SurfacePalette;
  darkBrandOverrides?: BrandOverrides;
  layoutTokens: LayoutTokens;
}

export interface SaveThemeResult {
  saved: boolean;
  issues: ContrastIssue[];
}

/**
 * The validateTheme gate is SERVER-side and blocking (SKILL.md: blocking
 * errors disable save) — the editor UI shows the same issues inline, but
 * this is the enforcement, not the form.
 */
export async function saveTheme(actorId: string, input: SaveThemeInput): Promise<SaveThemeResult> {
  const { issues, canSave } = validateTheme(
    input.brandColors,
    input.lightSurface,
    input.darkSurface,
    input.darkBrandOverrides,
  );
  if (!canSave) return { saved: false, issues };

  const before = await db.theme.findUnique({ where: { key: input.themeKey } });
  await db.theme.upsert({
    where: { key: input.themeKey },
    update: {
      brandColors: input.brandColors as never,
      lightSurface: input.lightSurface as never,
      darkSurface: input.darkSurface as never,
      darkBrandOverrides: (input.darkBrandOverrides ?? undefined) as never,
      layoutTokens: input.layoutTokens as never,
    },
    create: {
      key: input.themeKey,
      name: input.themeKey,
      brandColors: input.brandColors as never,
      lightSurface: input.lightSurface as never,
      darkSurface: input.darkSurface as never,
      darkBrandOverrides: (input.darkBrandOverrides ?? undefined) as never,
      layoutTokens: input.layoutTokens as never,
      isActive: false,
      scope: "both",
    },
  });
  await recordAudit({
    userId: actorId,
    action: "theme.update",
    entityType: "theme",
    entityId: input.themeKey,
    changes: { before: before?.brandColors ?? null, after: input.brandColors },
  });
  revalidateTag("theme", { expire: 0 });
  return { saved: true, issues };
}

/** Preset switch: activates one theme for its scope and deactivates the others (instant rollback = activate the previous row again). */
export async function activateTheme(actorId: string, themeKey: string): Promise<void> {
  const target = await db.theme.findUniqueOrThrow({ where: { key: themeKey } });
  await db.$transaction([
    db.theme.updateMany({ where: { NOT: { id: target.id } }, data: { isActive: false } }),
    db.theme.update({ where: { id: target.id }, data: { isActive: true } }),
  ]);
  await recordAudit({
    userId: actorId,
    action: "theme.activate",
    entityType: "theme",
    entityId: themeKey,
  });
  revalidateTag("theme", { expire: 0 });
}

export interface ThemePreset {
  key: string;
  name: string;
  isActive: boolean;
  scope: string;
}

export async function loadThemePresets(): Promise<ThemePreset[]> {
  const rows = await db.theme.findMany({
    orderBy: { createdAt: "asc" },
    select: { key: true, name: true, isActive: true, scope: true },
  });
  return rows;
}
