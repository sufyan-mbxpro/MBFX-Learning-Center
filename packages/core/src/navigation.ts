// buildNavigation (Module 08) — the architecture's proof-of-concept demo:
// admin reorders a menu item → public header reflects it via tag
// invalidation, no deploy.
//
// Cache shape, deliberately: the DB read (menu tree + translations + flags
// + locales) is what's cached under the frozen `navigation` tag —
// subject-dependent filtering happens OUTSIDE the cache, per request.
// Caching per-subject would key the cache on a user-sized space for zero
// hit-rate, and a Subject (with its permission Sets) isn't a stable cache
// key anyway. An anonymous/public render passes subject: null and stays
// fully static.
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { db, type FeatureVisibility } from "@repo/db";
import { can, type Subject } from "@repo/rbac";
import { evaluateVisibility } from "@repo/settings";
import { pickTranslation, type LocaleFallbackInfo } from "@repo/i18n";
import { isRouteKey, ROUTE_PATHS } from "@repo/contracts";

export interface NavItem {
  id: string;
  label: string;
  title: string | null;
  href: string;
  isExternal: boolean;
  openInNewTab: boolean;
  icon: string | null;
  badge: string | null;
  children: NavItem[];
}

interface RawMenuItem {
  id: string;
  parentId: string | null;
  url: string | null;
  routeKey: string | null;
  icon: string | null;
  badge: string | null;
  sortOrder: number;
  isActive: boolean;
  openInNewTab: boolean;
  visibility: FeatureVisibility;
  requiresFeature: string | null;
  requiresPermission: string | null;
  translations: { locale: string; label: string; title: string | null }[];
}

export interface MenuData {
  /** The menu's own name — the footer renders it as its column heading. */
  name: string | null;
  items: RawMenuItem[];
  /** key → isEnabled, for requiresFeature checks. Flag VISIBILITY is evaluated per subject at build time. */
  flags: Record<string, { isEnabled: boolean; visibility: FeatureVisibility }>;
  locales: LocaleFallbackInfo[];
  defaultLocale: string;
}

/** Pure DB read, exported for tests (ADR-004: `"use cache"` is inert outside a real Next.js process). */
export async function loadMenuData(menuKey: string): Promise<MenuData> {
  const [menu, flags, locales] = await Promise.all([
    db.menu.findUnique({
      where: { key: menuKey },
      select: {
        name: true,
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            parentId: true,
            url: true,
            routeKey: true,
            icon: true,
            badge: true,
            sortOrder: true,
            isActive: true,
            openInNewTab: true,
            visibility: true,
            requiresFeature: true,
            requiresPermission: true,
            translations: { select: { locale: true, label: true, title: true } },
          },
        },
      },
    }),
    db.featureFlag.findMany({ select: { key: true, isEnabled: true, visibility: true } }),
    db.locale.findMany({ select: { code: true, fallbackCode: true, isDefault: true } }),
  ]);

  return {
    name: menu?.name ?? null,
    items: menu?.items ?? [],
    flags: Object.fromEntries(
      flags.map((f) => [f.key, { isEnabled: f.isEnabled, visibility: f.visibility }]),
    ),
    locales: locales.map((l) => ({ code: l.code, fallbackCode: l.fallbackCode })),
    defaultLocale: locales.find((l) => l.isDefault)?.code ?? "en",
  };
}

async function getCachedMenuData(menuKey: string): Promise<MenuData> {
  "use cache";
  cacheTag("navigation");
  cacheLife({ revalidate: 300 });
  return loadMenuData(menuKey);
}

/** Call after any menu/menu-item/flag write that should reflect in navigation. */
export async function invalidateNavigation(): Promise<void> {
  revalidateTag("navigation", { expire: 0 });
}

function resolveHref(item: RawMenuItem): { href: string; isExternal: boolean } | null {
  // Exactly-one rule (contract-enforced on write, Module 09) — the builder
  // is defensive about bad rows rather than crashing the header.
  if (item.routeKey && !item.url) {
    if (!isRouteKey(item.routeKey)) return null;
    return { href: ROUTE_PATHS[item.routeKey], isExternal: false };
  }
  if (item.url && !item.routeKey) return { href: item.url, isExternal: true };
  return null;
}

function resolveLabel(
  item: RawMenuItem,
  locale: string,
  data: MenuData,
): { label: string; title: string | null } | null {
  const picked = pickTranslation(item.translations, locale, data.defaultLocale, data.locales);
  if (picked) return { label: picked.label, title: picked.title };

  // Nav labels are interface furniture, not content: the frozen no-fallback
  // rule for RTL locales (ADR-007) protects article BODIES from rendering
  // as LTR English walls — a single untranslated menu word is the lesser
  // harm vs. a menu item silently vanishing, so chrome labels take the
  // default-locale label as a last resort.
  const fallback = item.translations.find((t) => t.locale === data.defaultLocale);
  return fallback ? { label: fallback.label, title: fallback.title } : null;
}

export function assembleNavigation(
  data: MenuData,
  locale: string,
  subject: Subject | null,
): NavItem[] {
  const visible = (item: RawMenuItem): boolean => {
    if (!item.isActive) return false;
    if (!evaluateVisibility(item.visibility, subject)) return false;
    if (item.requiresFeature) {
      const flag = data.flags[item.requiresFeature];
      if (!flag || !flag.isEnabled || !evaluateVisibility(flag.visibility, subject)) return false;
    }
    if (item.requiresPermission && !can(subject, item.requiresPermission)) return false;
    return true;
  };

  const toNavItem = (item: RawMenuItem, children: NavItem[]): NavItem | null => {
    const link = resolveHref(item);
    const text = resolveLabel(item, locale, data);
    if (!link || !text) return null;
    return {
      id: item.id,
      label: text.label,
      title: text.title,
      href: link.href,
      isExternal: link.isExternal,
      openInNewTab: item.openInNewTab,
      icon: item.icon,
      badge: item.badge,
      children,
    };
  };

  // Max depth 2 (SKILL.md): roots and their direct children only — a
  // grandchild row is ignored outright rather than flattened upward.
  const roots = data.items.filter((i) => i.parentId === null);
  const result: NavItem[] = [];
  for (const root of roots) {
    if (!visible(root)) continue;
    const children = data.items
      .filter((i) => i.parentId === root.id)
      .filter(visible)
      .map((child) => toNavItem(child, []))
      .filter((c): c is NavItem => c !== null);

    // A parent that only exists to hold children is pruned when all its
    // children are pruned. A parent with its own link stands on its own.
    const hadChildRows = data.items.some((i) => i.parentId === root.id);
    if (hadChildRows && children.length === 0 && !root.routeKey && !root.url) continue;

    const nav = toNavItem(root, children);
    if (nav) result.push(nav);
  }
  return result;
}

/**
 * Production entry point. `subject` comes from the caller's own auth
 * context: null for the public/anonymous render (keeps it static), a
 * loaded Subject for staff surfaces (sidebar, Module 09).
 */
export async function buildNavigation(
  menuKey: string,
  locale: string,
  subject: Subject | null,
): Promise<NavItem[]> {
  const data = await getCachedMenuData(menuKey);
  return assembleNavigation(data, locale, subject);
}

export interface MenuWithName {
  key: string;
  /** Null when the menu row doesn't exist — callers render no heading. */
  name: string | null;
  items: NavItem[];
}

/**
 * buildNavigation plus the menu's own name (changes-03-plan.md §5.3). The
 * footer renders titled columns ("About Us", "Platforms", "Support"), and
 * buildNavigation returns items only — there was no way to get the heading
 * without a second query. Same cached read, same `navigation` tag: this
 * costs nothing extra over buildNavigation.
 *
 * The name is NOT translated — Menu has no translation table (MenuITEMs do).
 * Callers that need a localized heading pass their own from a catalog.
 */
export async function buildMenu(
  menuKey: string,
  locale: string,
  subject: Subject | null,
): Promise<MenuWithName> {
  const data = await getCachedMenuData(menuKey);
  return { key: menuKey, name: data.name, items: assembleNavigation(data, locale, subject) };
}
