// Admin shell chrome (Module 09, reworked by changes-01): permission-
// filtered grouped sidebar with icons + active state, topbar with global
// search (⌘K), notification bell, mode toggle, and profile dropdown.
// Server component — the layout passes the already-loaded Subject in; a
// hidden sidebar entry is UX, the real boundary is each action's
// requirePermission (a hidden button is not security).
import { getTranslations } from "next-intl/server";
import { can, canAny, type Subject } from "@repo/rbac";
import { countUnreadNotifications, getBrandAssets, listNotifications } from "@repo/core";
import { Toaster } from "@repo/ui/components/sonner";
import { ModeToggle } from "@repo/ui/components/mode-toggle";
import { AdminBreadcrumbs } from "./breadcrumbs.tsx";
import { AdminMobileNav } from "./admin-mobile-nav.tsx";
import { AdminSearch } from "./admin-search.tsx";
import { AdminSidebarNav, type AdminNavGroup } from "./admin-sidebar-nav.tsx";
import { NotificationBell, type NotificationItem } from "./notification-bell.tsx";
import { ProfileMenu } from "./profile-menu.tsx";
import { SignOutButton } from "./sign-out-button.tsx";

interface NavEntryDef {
  href: string;
  labelKey:
    | "dashboard"
    | "users"
    | "roles"
    | "employees"
    | "glossary"
    | "articles"
    | "settings"
    | "features"
    | "navigation"
    | "homepage"
    | "theme";
  icon: string;
  permission: string | string[] | null;
  exact?: boolean;
}

const ADMIN_NAV_GROUPS: {
  labelKey: "navPeople" | "navContent" | "navSystem" | null;
  entries: NavEntryDef[];
}[] = [
  {
    labelKey: null,
    entries: [
      { href: "/admin", labelKey: "dashboard", icon: "dashboard", permission: null, exact: true },
    ],
  },
  {
    labelKey: "navPeople",
    entries: [
      { href: "/admin/users", labelKey: "users", icon: "users", permission: "users.view" },
      { href: "/admin/roles", labelKey: "roles", icon: "roles", permission: "roles.view" },
      {
        href: "/admin/employees",
        labelKey: "employees",
        icon: "employees",
        permission: "employees.view",
      },
    ],
  },
  {
    labelKey: "navContent",
    entries: [
      {
        href: "/admin/glossary",
        labelKey: "glossary",
        icon: "glossary",
        permission: "glossary.view",
      },
      // News & Analysis (Module 15) — either key opens the section; each
      // action re-checks the kind-specific gate (ADR-015 #5).
      {
        href: "/admin/articles",
        labelKey: "articles",
        icon: "articles",
        permission: ["analysis.view", "news.manage"],
      },
    ],
  },
  {
    labelKey: "navSystem",
    entries: [
      // Settings is the ONLY system entry in the main sidebar (changes-05):
      // Features, Navigation, Homepage and Theme are all settings-shaped
      // screens the hub already fronts as cards, each reachable from any
      // settings page's own SettingsNav sub-sidebar (settings-shared.ts) —
      // duplicating them here just re-lists the same destinations twice.
      // The settings hub also fronts social links (social.manage) — anyone
      // holding either key gets the entry; each sub-page re-checks its own.
      {
        href: "/admin/settings",
        labelKey: "settings",
        icon: "settings",
        permission: ["settings.view", "social.manage"],
      },
    ],
  },
];

function allows(subject: Subject, permission: string | string[] | null): boolean {
  if (permission === null) return true;
  return Array.isArray(permission) ? canAny(subject, permission) : can(subject, permission);
}

export async function AdminShell({
  subject,
  userName,
  email,
  image,
  children,
}: {
  subject: Subject;
  userName: string;
  email: string;
  image: string | null;
  children: React.ReactNode;
}) {
  const [t, unreadCount, notifications, brandAssets] = await Promise.all([
    getTranslations("admin"),
    countUnreadNotifications(subject.id),
    listNotifications(subject.id),
    getBrandAssets(),
  ]);

  const groups: AdminNavGroup[] = ADMIN_NAV_GROUPS.map((group) => ({
    label: group.labelKey ? t(group.labelKey) : null,
    entries: group.entries
      .filter((entry) => allows(subject, entry.permission))
      .map((entry) => ({
        href: entry.href,
        label: t(entry.labelKey),
        icon: entry.icon,
        exact: entry.exact,
      })),
  })).filter((group) => group.entries.length > 0);

  const flatEntries = groups.flatMap((group) => group.entries);
  const searchPages = [
    ...flatEntries.map((entry) => ({ href: entry.href, label: entry.label })),
    { href: "/admin/profile", label: t("profile") },
  ];

  // Notification text renders HERE (type → catalog string, detail
  // interpolated) so the client bell stays a dumb list.
  const items: NotificationItem[] = notifications.map((n) => ({
    id: n.id,
    text: t.has(`notifications.${n.type}`)
      ? t(`notifications.${n.type}`, { detail: n.detail })
      : n.type,
    href: n.href,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="flex min-h-full">
      <Toaster />
      {/* Sidebar below md would crush the content column — the mobile nav
          in the topbar carries the same permission-filtered groups. Sticky
          + h-dvh so it stays pinned while long lists scroll; the inner nav
          scrolls independently. */}
      <aside className="sticky top-0 hidden h-dvh w-[var(--width-sidebar)] shrink-0 flex-col border-e bg-card p-4 md:flex">
        <div className="mb-4 flex items-center px-2.5">
          {brandAssets.logo_light || brandAssets.logo_dark ? (
            <>
              {brandAssets.logo_light && (
                // eslint-disable-next-line @next/next/no-img-element -- served by our own route (ADR-017)
                <img
                  src={brandAssets.logo_light.url}
                  alt={t("adminPortal")}
                  className={brandAssets.logo_dark ? "h-7 w-auto dark:hidden" : "h-7 w-auto"}
                />
              )}
              {brandAssets.logo_dark && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brandAssets.logo_dark.url}
                  alt={t("adminPortal")}
                  className={brandAssets.logo_light ? "hidden h-7 w-auto dark:block" : "h-7 w-auto"}
                />
              )}
            </>
          ) : (
            <p className="text-sm font-semibold">{t("adminPortal")}</p>
          )}
        </div>
        <AdminSidebarNav groups={groups} />
        <div className="mt-4 flex flex-col gap-2 border-t pt-4">
          <div className="px-2.5">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <SignOutButton label={t("signOut")} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[var(--height-header)] items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:gap-4 md:px-6">
          <AdminMobileNav groups={groups} menuLabel={t("adminPortal")} closeLabel={t("close")} />
          <AdminSearch
            pages={searchPages}
            labels={{
              placeholder: t("searchPlaceholder"),
              trigger: t("searchTrigger"),
              title: t("searchTitle"),
              description: t("searchDescription"),
              empty: t("noResults"),
              pages: t("searchPages"),
              users: t("users"),
              roles: t("roles"),
              employees: t("employees"),
              settings: t("settings"),
              glossary: t("glossary"),
            }}
          />
          <div className="ms-auto flex items-center gap-1 md:gap-2">
            <NotificationBell
              items={items}
              unreadCount={unreadCount}
              labels={{
                title: t("notificationsTitle"),
                empty: t("notificationsEmpty"),
                markAllRead: t("markAllRead"),
                openMenu: t("openNotifications"),
              }}
            />
            <ModeToggle label={t("toggleTheme")} />
            <ProfileMenu
              userName={userName}
              email={email}
              image={image}
              labels={{
                profile: t("profile"),
                settings: t("settings"),
                signOut: t("signOut"),
                openMenu: t("openProfileMenu"),
              }}
            />
          </div>
        </header>
        <div className="border-b px-4 py-2 md:px-6">
          <AdminBreadcrumbs />
        </div>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
