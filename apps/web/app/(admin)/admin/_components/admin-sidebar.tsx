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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { Button } from "@repo/ui/components/button";
import { AdminSidebarNav, type AdminNavGroup, type VisitSiteLink } from "./admin-sidebar-nav.tsx";
import { SignOutButton } from "./sign-out-button.tsx";

/** Read by the admin layout on the server; written here on toggle. */
export const SIDEBAR_COOKIE = "mbx_admin_sidebar";

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
      // tokens.md §3.1: a 64px logo band, a px-3 scroll area and a p-4
      // footer, each band ruled off — the reference's sidebar.
      className={cn(
        "sticky top-0 z-40 hidden h-dvh shrink-0 flex-col border-e bg-background transition-(--transition-size) duration-200 ease-in-out md:flex",
        collapsed ? "w-16" : "w-(--width-sidebar)",
      )}
    >
      {/* The collapse toggle sits OUTSIDE the menu (changes-43): a round
          button straddling the sidebar's inline-end edge, level with the
          brand band. Inside the band it pushed the logo off-centre and read
          as one more menu control. `-end-3` is logical, so in RTL it
          straddles the left edge; the chevrons mirror with `rtl:rotate-180`.
          The ASIDE carries `z-40` (sticky makes it a stacking context, so a
          z-index on the button alone could not escape it): the half of the
          button that overhangs must paint over the content column's sticky
          `z-30` header. */}
      <Button
        variant="outline"
        size="icon-2xs"
        onClick={toggle}
        aria-label={collapsed ? labels.expand : labels.collapse}
        aria-expanded={!collapsed}
        title={collapsed ? labels.expand : labels.collapse}
        className="absolute top-5 -end-3 rounded-full bg-background shadow-sm"
      >
        {collapsed ? (
          <ChevronRight aria-hidden className="rtl:rotate-180" />
        ) : (
          <ChevronLeft aria-hidden className="rtl:rotate-180" />
        )}
      </Button>

      {/* The brand band: the logo CENTRED (changes-43). Collapsed, the band
          stays — empty — so its rule still lines up with the header's. */}
      <div className="flex min-h-16 items-center justify-center border-b px-4">
        {!collapsed && (
          <div className="flex min-w-0 justify-center">
            <BrandLogo
              light={logoLight}
              dark={logoDark}
              alt={labels.brand}
              className="h-9"
              fallback={<p className="truncate text-sm font-semibold">{labels.brand}</p>}
            />
          </div>
        )}
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col py-2", collapsed ? "px-2" : "px-3")}>
        <AdminSidebarNav groups={groups} collapsed={collapsed} visitSite={visitSite} />
      </div>

      <div className={cn("flex flex-col gap-2 border-t", collapsed ? "p-2" : "p-4")}>
        {!collapsed && (
          <div>
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        )}
        <SignOutButton label={labels.signOut} iconOnly={collapsed} />
      </div>
    </aside>
  );
}
