// Admin shell chrome (Module 09, reworked by changes-01): permission-
// filtered grouped sidebar with icons + active state, topbar with global
// search (⌘K), notification bell, mode toggle, and profile dropdown.
// Server component — the layout passes the already-loaded Subject in; a
// hidden sidebar entry is UX, the real boundary is each action's
// requirePermission (a hidden button is not security).
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { can, canAny, type Subject } from "@repo/rbac";
import { countUnreadNotifications, getBrandAssets, listNotifications } from "@repo/core";
import { Toaster } from "@repo/ui/components/sonner";
import { ModeToggle } from "@repo/ui/components/mode-toggle";
import { AdminBreadcrumbs } from "./breadcrumbs.tsx";
import { AdminMobileNav } from "./admin-mobile-nav.tsx";
import { AdminSearch } from "./admin-search.tsx";
import { AdminSidebar, SIDEBAR_COOKIE } from "./admin-sidebar.tsx";
import { type AdminNavGroup, type VisitSiteLink } from "./admin-sidebar-nav.tsx";
import { IdleTimeout } from "./idle-timeout.tsx";
import { NotificationBell, type NotificationItem } from "./notification-bell.tsx";
import { ProfileMenu } from "./profile-menu.tsx";

// Module 16 (Website Builder / CMS) is paused per ADR-037: hidden from the
// admin UI (sidebar, mobile nav, ⌘K search — all driven by this one nav
// entry) but not deleted. Code, DB tables and the public renderer are
// untouched; flip this back to `true` to restore the nav entry.
const WEBSITE_BUILDER_ADMIN_UI_ENABLED = false;

interface NavEntryDef {
  href: string;
  labelKey:
    | "dashboard"
    | "users"
    | "roles"
    | "employees"
    | "glossary"
    | "articles"
    | "websiteMedia"
    | "website"
    | "settings"
    | "features"
    | "navigation"
    | "homepage"
    | "theme";
  icon: string;
  permission: string | string[] | null;
  exact?: boolean;
  enabled?: boolean;
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
      // Standalone media library (ADR-037 Decision #4's follow-up) — the
      // same MediaLibrary component the paused Website Builder screen uses,
      // reachable independent of it so News & Analysis and other content
      // modules always have a working upload/reuse entry point.
      {
        href: "/admin/media",
        labelKey: "websiteMedia",
        icon: "websiteMedia",
        permission: "media.view",
      },
      // News & Analysis (Module 15) — either key opens the section; each
      // action re-checks the kind-specific gate (ADR-015 #5).
      {
        href: "/admin/articles",
        labelKey: "articles",
        icon: "articles",
        permission: ["analysis.view", "news.manage"],
      },
      // Website builder (Module 16) — paused, ADR-037. Kept in the array
      // (rather than deleted) so re-enabling is a one-line flip of
      // WEBSITE_BUILDER_ADMIN_UI_ENABLED above.
      {
        href: "/admin/website",
        labelKey: "website",
        icon: "website",
        permission: ["cms.pages.view", "redirects.manage"],
        enabled: WEBSITE_BUILDER_ADMIN_UI_ENABLED,
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

function allows(subject: Subject, entry: NavEntryDef): boolean {
  if (entry.enabled === false) return false;
  if (entry.permission === null) return true;
  return Array.isArray(entry.permission)
    ? canAny(subject, entry.permission)
    : can(subject, entry.permission);
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
  const [t, unreadCount, notifications, brandAssets, cookieStore] = await Promise.all([
    getTranslations("admin"),
    countUnreadNotifications(subject.id),
    listNotifications(subject.id),
    getBrandAssets(),
    // Sidebar collapse state is read on the SERVER so the first paint is
    // already the right width (see admin-sidebar.tsx for why not
    // localStorage). This layout is fully dynamic anyway (`instant =
    // false`), so a cookie read costs nothing here.
    cookies(),
  ]);
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";

  const groups: AdminNavGroup[] = ADMIN_NAV_GROUPS.map((group) => ({
    label: group.labelKey ? t(group.labelKey) : null,
    entries: group.entries
      .filter((entry) => allows(subject, entry))
      .map((entry) => ({
        href: entry.href,
        label: t(entry.labelKey),
        icon: entry.icon,
        exact: entry.exact,
      })),
  })).filter((group) => group.entries.length > 0);

  // changes-08 #8. Root-relative, so the proxy applies the visitor's own
  // locale prefix rather than the admin hard-coding one (ADR-043: the
  // public surface is multilingual, the admin portal is not).
  const visitSite: VisitSiteLink = {
    href: "/",
    label: t("visitSite"),
    hint: t("visitSiteHint"),
  };

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
      {/* ADR-041: ten-minute idle auto sign-out. Mounted HERE and nowhere
          else — that is what scopes it to the admin surface. */}
      <IdleTimeout
        labels={{
          title: t("idleTitle"),
          // t.raw, not t: the {seconds} placeholder is filled on the CLIENT
          // once a second as the countdown ticks, so the server must hand
          // over the message with its placeholder intact rather than
          // resolving it (t() would demand a value here and get a stale one).
          description: String(t.raw("idleDescription")),
          stay: t("idleStay"),
          signOut: t("signOut"),
        }}
      />
      <AdminSidebar
        groups={groups}
        visitSite={visitSite}
        initialCollapsed={sidebarCollapsed}
        logoLight={brandAssets.logo_light?.url ?? null}
        logoDark={brandAssets.logo_dark?.url ?? null}
        userName={userName}
        email={email}
        labels={{
          brand: t("adminPortal"),
          signOut: t("signOut"),
          collapse: t("collapseSidebar"),
          expand: t("expandSidebar"),
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[var(--height-header)] items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:gap-4 md:px-6">
          <AdminMobileNav
            groups={groups}
            visitSite={visitSite}
            menuLabel={t("adminPortal")}
            closeLabel={t("close")}
            logoLight={brandAssets.logo_light?.url ?? null}
            logoDark={brandAssets.logo_dark?.url ?? null}
          />
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
