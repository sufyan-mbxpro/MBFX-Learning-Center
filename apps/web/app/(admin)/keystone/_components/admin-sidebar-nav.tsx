"use client";

// Grouped, icon-carrying sidebar nav (changes-01: mirror the MBX Pro
// sidebar's structure). Client component solely for the active-route
// highlight — entries arrive permission-filtered from the server shell,
// icons resolve here because component functions can't cross the RSC
// boundary as props.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  CandlestickChart,
  Sparkles,
  ChartLine,
  CircleHelp,
  BookOpen,
  GraduationCap,
  IdCard,
  Image,
  LayoutDashboard,
  ListChecks,
  ListTree,
  Mail,
  Newspaper,
  Palette,
  Settings,
  Shield,
  Home,
  Users,
  Globe,
  ExternalLink,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { NavItem } from "@repo/ui/components/nav-item";
import { MicroHeading } from "@repo/ui/components/typography";

/** Shared with the ⌘K palette, so a destination has one glyph in both places. */
export const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  roles: Shield,
  employees: IdCard,
  newsletter: Mail,
  glossary: BookOpen,
  learnCourses: GraduationCap,
  learnLessons: ListChecks,
  learnQuizzes: CircleHelp,
  learnProgress: ChartLine,
  learnVideos: Video,
  articles: Newspaper,
  websiteMedia: Image,
  website: Globe,
  market: CandlestickChart,
  tools: Calculator,
  ai: Sparkles,
  settings: Settings,
  navigation: ListTree,
  homepage: Home,
  theme: Palette,
};

export interface AdminNavEntry {
  href: string;
  label: string;
  icon: string;
  /** Match the href exactly (dashboard) instead of by prefix. */
  exact?: boolean;
}

export interface AdminNavGroup {
  label: string | null;
  entries: AdminNavEntry[];
}

/** changes-08 #8 — the way out to the public site, from either nav. */
export interface VisitSiteLink {
  href: string;
  label: string;
  hint: string;
}

export function AdminSidebarNav({
  groups,
  collapsed = false,
  visitSite,
}: {
  groups: AdminNavGroup[];
  /** Icon rail: labels and group headings hide, icons stay. */
  collapsed?: boolean;
  /** Rendered pinned to the end of the nav, below every group. */
  visitSite?: VisitSiteLink;
}) {
  const pathname = usePathname();

  // Collapsed, the row is a 40px icon-only square: no label span to
  // offset the glyph, so the gap and inline padding go.
  const railClass = collapsed ? "justify-center gap-0 px-0" : undefined;

  return (
    // Two parts since changes-37: the groups SCROLL, and "Visit site" does
    // not. It used to be the last child of the scrolling nav with `mt-auto`,
    // which pins it to the bottom only while the groups are shorter than the
    // sidebar — on a laptop screen with every group granted it scrolled away
    // below the fold with the rest ("fixed visit site in admin side").
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <nav
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto",
          collapsed ? "gap-2" : "gap-4",
        )}
      >
        {groups.map((group, index) => (
          <div key={group.label ?? index} className="flex flex-col gap-1">
            {group.label &&
              (collapsed ? (
                // A visible heading has nowhere to go on a 64px rail, but the
                // grouping is still real to a screen reader — keep it as the
                // separator's label rather than dropping the structure.
                <hr aria-label={group.label} className="mx-2 my-1 border-t" />
              ) : (
                <MicroHeading render={<p />} className="px-4 pb-1">
                  {group.label}
                </MicroHeading>
              ))}
            {group.entries.map((entry) => {
              const Icon = ICONS[entry.icon];
              const isActive = entry.exact
                ? pathname === entry.href
                : pathname === entry.href || pathname.startsWith(`${entry.href}/`);
              return (
                <NavItem
                  key={entry.href}
                  render={<Link href={entry.href} />}
                  active={isActive}
                  icon={Icon && <Icon aria-hidden />}
                  // Collapsed, the icon is the only visible content — the
                  // label has to reach both the accessibility tree
                  // (aria-label) and the pointer user (native tooltip).
                  aria-label={collapsed ? entry.label : undefined}
                  title={collapsed ? entry.label : undefined}
                  className={railClass}
                >
                  {!collapsed && entry.label}
                </NavItem>
              );
            })}
          </div>
        ))}
      </nav>

      {visitSite && (
        // Pinned below every group, OUTSIDE the scroll: this leaves the admin
        // rather than navigating within it, so it must not read as one more
        // section, and it must not scroll out of reach. A rule above it says
        // the same thing. A new tab — the admin was mid-task — which is
        // exactly what target=_blank + rel=noopener is for.
        <NavItem
          href={visitSite.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={collapsed ? `${visitSite.label} — ${visitSite.hint}` : undefined}
          title={collapsed ? visitSite.label : visitSite.hint}
          icon={<Globe aria-hidden />}
          trailing={collapsed ? undefined : <ExternalLink aria-hidden className="opacity-70" />}
          className={cn("shrink-0 text-muted-foreground", railClass)}
        >
          {!collapsed && visitSite.label}
        </NavItem>
      )}
    </div>
  );
}
