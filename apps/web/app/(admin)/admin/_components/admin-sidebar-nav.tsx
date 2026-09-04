"use client";

// Grouped, icon-carrying sidebar nav (changes-01: mirror the MBX Pro
// sidebar's structure). Client component solely for the active-route
// highlight — entries arrive permission-filtered from the server shell,
// icons resolve here because component functions can't cross the RSC
// boundary as props.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Flag,
  IdCard,
  LayoutDashboard,
  ListTree,
  Newspaper,
  Palette,
  Settings,
  Shield,
  Home,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  roles: Shield,
  employees: IdCard,
  glossary: BookOpen,
  articles: Newspaper,
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

export function AdminSidebarNav({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto">
      {groups.map((group, index) => (
        <div key={group.label ?? index} className="flex flex-col gap-1">
          {group.label && (
            <p className="px-2.5 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group.label}
            </p>
          )}
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
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {Icon && <Icon aria-hidden className="size-4 shrink-0" />}
                {entry.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
