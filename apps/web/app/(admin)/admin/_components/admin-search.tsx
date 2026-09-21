"use client";

// Global admin search (changes-01): ⌘K palette over a static page index
// (permission-filtered server-side, passed in) plus live server results
// from searchAdminAction — every data section re-filtered by can() on the
// server; the page index here is UX, not authorization.
//
// ADR-140 §5: drawn by `@repo/ui/components/command-palette`, the shape the
// public palette shares. The page index is grouped by the SIDEBAR's own
// sections with the sidebar's own glyphs, and shown in full while the box is
// empty. No row prints its path any more — `/admin/users` under "Users" was
// an identifier on screen (code-style #5), and for the same reason a role's
// or a setting's KEY is not used as a description either.
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  IdCard,
  SearchIcon,
  Settings,
  Shield,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Kbd, KbdGroup } from "@repo/ui/components/kbd";
import {
  CommandPalette,
  type CommandPaletteGroup,
  type CommandPaletteItem,
  type CommandPaletteLabels,
} from "@repo/ui/components/command-palette";
import { searchAdminAction } from "../_actions/search-actions.ts";
import { ICONS } from "./admin-sidebar-nav.tsx";

interface SearchItem extends CommandPaletteItem {
  href: string;
}

/** One sidebar section as the palette lists it. */
export interface AdminSearchSection {
  label: string;
  entries: { href: string; label: string; icon: string; hint: string | null }[];
}

export interface AdminSearchLabels extends CommandPaletteLabels {
  trigger: string;
  empty: string;
  users: string;
  roles: string;
  employees: string;
  settings: string;
  glossary: string;
}

type RemoteHit = { id: string; label: string; sublabel: string | null; href: string };

export function AdminSearch({
  sections,
  labels,
}: {
  sections: AdminSearchSection[];
  labels: AdminSearchLabels;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [remote, setRemote] = React.useState<CommandPaletteGroup<SearchItem>[]>([]);
  // Client-only value with an SSR fallback — useSyncExternalStore re-renders
  // with the real platform right after hydration, no effect-setState needed.
  const isMac = React.useSyncExternalStore(
    subscribeNever,
    () => /mac|iphone|ipad/i.test(window.navigator.platform || window.navigator.userAgent),
    () => false,
  );

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // `key` is optional: Chrome dispatches a keydown with no `key` when a
      // field is filled from autofill, and this listener sees every one.
      if (event.key?.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced server search; stale responses are dropped by sequence check.
  // An empty query renders with remote results ignored (see `groups` below)
  // rather than clearing state in the effect.
  const requestSeq = React.useRef(0);
  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      requestSeq.current++;
      return;
    }
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      try {
        const results = await searchAdminAction(q);
        if (seq !== requestSeq.current) return;
        // Which sublabel is a DESCRIPTION: an email or a topic name reads as
        // one; a role key or a setting key is an identifier and is dropped.
        const sections: CommandPaletteGroup<SearchItem>[] = [
          group("users", labels.users, UserRound, results.users, true),
          group("roles", labels.roles, Shield, results.roles, false),
          group("employees", labels.employees, IdCard, results.employees, true),
          group("settings", labels.settings, Settings, results.settings, false),
          group("glossary", labels.glossary, BookOpen, results.glossary, true),
        ];
        setRemote(sections.filter((section) => section.items.length > 0));
      } catch {
        if (seq === requestSeq.current) setRemote([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, labels]);

  const q = query.trim().toLowerCase();
  const pageGroups: CommandPaletteGroup<SearchItem>[] = sections
    .map((section, index) => ({
      id: `pages:${index}`,
      label: section.label,
      icon: FileText,
      items: section.entries
        .filter((entry) => !q || entry.label.toLowerCase().includes(q))
        .map((entry) => ({
          id: `page:${entry.href}`,
          title: entry.label,
          description: entry.hint,
          icon: ICONS[entry.icon] ?? FileText,
          href: entry.href,
        })),
    }))
    .filter((section) => section.items.length > 0);
  const groups = [...pageGroups, ...(q ? remote : [])];

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const go = (item: SearchItem) => {
    close();
    router.push(item.href);
  };

  return (
    <>
      {/* `shrink` overrides Button's own `shrink-0`: this trigger is the ONE
          item in the top bar that should give way on a phone. With shrink-0
          it held its 256px and pushed the theme toggle and avatar 74px off
          a 390px screen (admin phone-width pass). */}
      <Button
        variant="outline"
        className="w-full min-w-0 max-w-64 shrink justify-start gap-2 text-muted-foreground sm:max-w-xs"
        onClick={() => setOpen(true)}
      >
        <SearchIcon aria-hidden className="size-4" />
        <span className="flex-1 truncate text-start text-sm font-normal">{labels.trigger}</span>
        <KbdGroup aria-hidden className="hidden md:inline-flex">
          <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>
      <CommandPalette
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        onSelect={go}
        emptyText={labels.empty}
        labels={labels}
      />
    </>
  );
}

function subscribeNever() {
  return () => {};
}

function group(
  id: string,
  label: string,
  icon: LucideIcon,
  hits: RemoteHit[],
  describe: boolean,
): CommandPaletteGroup<SearchItem> {
  return {
    id,
    label,
    icon,
    items: hits.map((hit) => ({
      id: `${id}:${hit.id}`,
      title: hit.label,
      description: describe ? hit.sublabel : null,
      href: hit.href,
    })),
  };
}
