"use client";

// Grouped, icon-carrying sidebar nav (changes-01: mirror the MBX Pro
// sidebar's structure). Client component solely for the active-route
// highlight — entries arrive permission-filtered from the server shell,
// icons resolve here because component functions can't cross the RSC
// boundary as props.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Tags,
  ChartLine,
  CircleHelp,
  BookOpen,
  Flag,
  GraduationCap,
  IdCard,
  Image,
  LayoutDashboard,
  ListChecks,
  ListTree,
  Newspaper,
  Palette,
  Settings,
  Shield,
  Home,
  Users,
  Globe,
  ExternalLink,
  FolderOpen,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  roles: Shield,
  employees: IdCard,
  glossary: BookOpen,
  learnCourses: GraduationCap,
  learnLessons: ListChecks,
  learnQuizzes: CircleHelp,
  learnProgress: ChartLine,
  learnVideos: Video,
  videoCategories: FolderOpen,
  glossaryTopics: Tags,
  articles: Newspaper,
  websiteMedia: Image,
  website: Globe,
  settings: Settings,
  features: Flag,
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

  return (
    <nav className={cn("flex flex-1 flex-col overflow-y-auto", collapsed ? "gap-2" : "gap-4")}>
      {groups.map((group, index) => (
        <div key={group.label ?? index} className="flex flex-col gap-1">
          {group.label &&
            (collapsed ? (
              // A visible heading has nowhere to go on a 64px rail, but the
              // grouping is still real to a screen reader — keep it as the
              // separator's label rather than dropping the structure.
              <hr aria-label={group.label} className="mx-2 my-1 border-t" />
            ) : (
              <p className="px-2.5 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.label}
              </p>
            ))}
          {group.entries.map((entry) => {
            const Icon = ICONS[entry.icon];
            const isActive = entry.exact
              ? pathname === entry.href
              : pathname === entry.href || pathname.startsWith(`${entry.href}/`);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                aria-current={isActive ? "page" : undefined}
                // Collapsed, the icon is the only visible content — the
                // label has to reach both the accessibility tree
                // (aria-label) and the pointer user (native tooltip).
                aria-label={collapsed ? entry.label : undefined}
                title={collapsed ? entry.label : undefined}
                className={cn(
                  "flex items-center rounded-md py-1.5 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {Icon && <Icon aria-hidden className="size-4 shrink-0" />}
                {!collapsed && entry.label}
              </Link>
            );
          })}
        </div>
      ))}

      {visitSite && (
        // Pinned below every group (mt-auto), separated by a rule: this
        // leaves the admin rather than navigating within it, so it must
        // not read as one more section. A new tab — the admin was mid-task
        // — which is exactly what target=_blank + rel=noopener is for.
        <a
          href={visitSite.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={collapsed ? `${visitSite.label} — ${visitSite.hint}` : undefined}
          title={collapsed ? visitSite.label : visitSite.hint}
          className={cn(
            "mt-auto flex items-center rounded-md py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
          )}
        >
          <Globe aria-hidden className="size-4 shrink-0" />
          {!collapsed && (
            <>
              {visitSite.label}
              <ExternalLink aria-hidden className="ms-auto size-3.5 opacity-70" />
            </>
          )}
        </a>
      )}
    </nav>
  );
}
