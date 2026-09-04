"use client";

// Global admin search (changes-01): ⌘K palette over a static page index
// (permission-filtered server-side, passed in) plus live server results
// from searchAdminAction — every data section re-filtered by can() on the
// server; the page index here is UX, not authorization.
import * as React from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Kbd, KbdGroup } from "@repo/ui/components/kbd";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command";
import { searchAdminAction } from "../_actions/search-actions.ts";

interface SearchItem {
  value: string; // unique key
  label: string;
  sublabel: string | null;
  href: string;
}

interface SearchGroup {
  value: string; // group heading
  items: SearchItem[];
}

export interface AdminSearchLabels {
  placeholder: string;
  trigger: string;
  title: string;
  description: string;
  empty: string;
  pages: string;
  users: string;
  roles: string;
  employees: string;
  settings: string;
  glossary: string;
}

export function AdminSearch({
  pages,
  labels,
}: {
  pages: { href: string; label: string }[];
  labels: AdminSearchLabels;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [remote, setRemote] = React.useState<SearchGroup[]>([]);
  // Client-only value with an SSR fallback — useSyncExternalStore re-renders
  // with the real platform right after hydration, no effect-setState needed.
  const isMac = React.useSyncExternalStore(
    subscribeNever,
    () => /mac|iphone|ipad/i.test(window.navigator.platform || window.navigator.userAgent),
    () => false,
  );

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
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
        const sections: [string, SearchItem[]][] = [
          [labels.users, results.users.map((hit) => toItem("user", hit))],
          [labels.roles, results.roles.map((hit) => toItem("role", hit))],
          [labels.employees, results.employees.map((hit) => toItem("employee", hit))],
          [labels.settings, results.settings.map((hit) => toItem("setting", hit))],
          [labels.glossary, results.glossary.map((hit) => toItem("term", hit))],
        ];
        setRemote(
          sections
            .filter(([, items]) => items.length > 0)
            .map(([value, items]) => ({ value, items })),
        );
      } catch {
        if (seq === requestSeq.current) setRemote([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, labels]);

  const q = query.trim().toLowerCase();
  const matchingPages = pages.filter((page) => !q || page.label.toLowerCase().includes(q));
  const groups: SearchGroup[] = [
    ...(matchingPages.length > 0
      ? [
          {
            value: labels.pages,
            items: matchingPages.map((page) => ({
              value: `page:${page.href}`,
              label: page.label,
              sublabel: page.href,
              href: page.href,
            })),
          },
        ]
      : []),
    ...(q ? remote : []),
  ];

  const go = (item: SearchItem) => {
    setOpen(false);
    setQuery("");
    router.push(item.href);
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full min-w-0 max-w-64 justify-start gap-2 text-muted-foreground sm:max-w-xs"
        onClick={() => setOpen(true)}
      >
        <SearchIcon aria-hidden className="size-4" />
        <span className="flex-1 truncate text-start text-sm font-normal">{labels.trigger}</span>
        <KbdGroup aria-hidden className="hidden md:inline-flex">
          <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        title={labels.title}
        description={labels.description}
      >
        <Command
          items={groups}
          filteredItems={groups}
          value={query}
          onValueChange={setQuery}
          itemToStringValue={(item) => (item as SearchItem).label}
        >
          <CommandInput placeholder={labels.placeholder} aria-label={labels.title} />
          <CommandEmpty>{labels.empty}</CommandEmpty>
          <CommandList>
            {(group: SearchGroup) => (
              <CommandGroup key={group.value} items={group.items}>
                <CommandGroupLabel>{group.value}</CommandGroupLabel>
                <CommandCollection>
                  {(item: SearchItem) => (
                    <CommandItem key={item.value} value={item} onClick={() => go(item)}>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.sublabel && (
                        <span className="max-w-40 shrink-0 truncate text-xs text-muted-foreground">
                          {item.sublabel}
                        </span>
                      )}
                    </CommandItem>
                  )}
                </CommandCollection>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function subscribeNever() {
  return () => {};
}

function toItem(
  prefix: string,
  hit: { id: string; label: string; sublabel: string | null; href: string },
): SearchItem {
  return { value: `${prefix}:${hit.id}`, label: hit.label, sublabel: hit.sublabel, href: hit.href };
}
