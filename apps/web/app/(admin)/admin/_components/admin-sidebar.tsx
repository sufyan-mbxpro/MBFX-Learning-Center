"use client";

// The desktop admin sidebar, made collapsible. Expanded it shows the logo,
// icons and labels; collapsed it is an icon rail and the content column
// takes the reclaimed width automatically (the shell's content wrapper is
// `flex-1`, so nothing has to be told about it).
//
// State lives in a COOKIE, not localStorage, and the server hands the
// initial value in as `initialCollapsed`. localStorage is only readable
// after hydration, which would mean either a visible width flip on every
// admin page load or a hydration mismatch. The admin root layout is
// already fully dynamic (`instant = false`, ADR-006), so reading a cookie
// there costs nothing and the first paint is correct.
import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { Button } from "@repo/ui/components/button";
import { AdminSidebarNav, type AdminNavGroup, type VisitSiteLink } from "./admin-sidebar-nav.tsx";
import { SignOutButton } from "./sign-out-button.tsx";

/** Read by the admin layout on the server; written here on toggle. */
export const SIDEBAR_COOKIE = "mbfx_admin_sidebar";

export interface AdminSidebarLabels {
  brand: string;
  signOut: string;
  collapse: string;
  expand: string;
}

export function AdminSidebar({
  groups,
  visitSite,
  initialCollapsed,
  logoLight,
  logoDark,
  userName,
  email,
  labels,
}: {
  groups: AdminNavGroup[];
  visitSite: VisitSiteLink;
  initialCollapsed: boolean;
  logoLight: string | null;
  logoDark: string | null;
  userName: string;
  email: string;
  labels: AdminSidebarLabels;
}) {
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    // One year, path=/ so every admin route sees it. Not httpOnly by
    // necessity — the client is what writes it — and it carries no
    // security meaning whatsoever: it is a width preference.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"};path=/;max-age=31536000;samesite=lax`;
  };

  return (
    // Sidebar below md would crush the content column — the mobile nav in
    // the topbar carries the same permission-filtered groups. Sticky +
    // h-dvh so it stays pinned while long lists scroll; the inner nav
    // scrolls independently.
    <aside
      data-collapsed={collapsed ? "" : undefined}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-e bg-card py-4 transition-[width] duration-200 ease-out md:flex",
        collapsed ? "w-16 px-2" : "w-[var(--width-sidebar)] px-4",
      )}
    >
      <div
        className={cn("mb-4 flex h-8 items-center gap-2", collapsed ? "justify-center" : "ps-2.5")}
      >
        {!collapsed && (
          <div className="flex min-w-0 flex-1 items-center">
            <BrandLogo
              light={logoLight}
              dark={logoDark}
              alt={labels.brand}
              className="h-7"
              fallback={<p className="truncate text-sm font-semibold">{labels.brand}</p>}
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={collapsed ? labels.expand : labels.collapse}
          aria-expanded={!collapsed}
          title={collapsed ? labels.expand : labels.collapse}
        >
          {/* Both icons point inline-start by design; RTL flips them so
              "close" still reads as "toward the edge the panel lives on". */}
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="size-4 rtl:rotate-180" />
          ) : (
            <PanelLeftClose aria-hidden className="size-4 rtl:rotate-180" />
          )}
        </Button>
      </div>

      <AdminSidebarNav groups={groups} collapsed={collapsed} visitSite={visitSite} />

      <div className="mt-4 flex flex-col gap-2 border-t pt-4">
        {!collapsed && (
          <div className="px-2.5">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        )}
        <SignOutButton label={labels.signOut} iconOnly={collapsed} />
      </div>
    </aside>
  );
}
