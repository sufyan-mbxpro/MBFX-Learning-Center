"use client";

// The public site's ⌘K search (ADR-108), in the one palette shape both
// surfaces share (ADR-140 §5: `@repo/ui/components/command-palette`).
//
// It shares no code with `admin-search.tsx`, which may not be imported from a
// public route (architecture.md #5) and whose results come from a
// permission-filtered server action over admin records. What is shared is the
// presentational palette in `@repo/ui`, which takes resolved groups and hands
// back the chosen row — the fetch, the routing and the ⌘K listener stay here.
//
// Things worth knowing:
//
//   * **The shortcut is on `window`, not on the trigger.** The trigger has two
//     forms — an icon below `md`, where the row is already carrying a
//     hamburger, a logo and two auth entry points, and a labelled box with the
//     key cap above it, because printing the shortcut is the only way a reader
//     learns it exists. Neither form gates the listener, so ⌘K works on a
//     narrow window too.
//   * **`href` arrives locale-less** and `useRouter` from `@repo/i18n` adds
//     the prefix. The service returns `/glossary/x`, not `/en/glossary/x`, so
//     a hit found in one locale cannot navigate a reader out of theirs. The
//     href is never RENDERED — a row is a title and a line of description.
//   * **An input event is not a request.** 250ms of quiet before the fetch,
//     and a sequence number so a slow response for "for" cannot land after a
//     fast one for "forex".
//   * **An empty box shows the header's own menu**, grouped under its
//     top-level labels — rows the header already loaded, so a suggestion
//     costs no request and can never name a page the menu does not.
import * as React from "react";
import {
  BookOpen,
  Calculator,
  CircleHelp,
  Compass,
  FileText,
  GraduationCap,
  ListChecks,
  Newspaper,
  Search as SearchIcon,
  Video,
  type LucideIcon,
} from "lucide-react";

import { useRouter } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { Kbd, KbdGroup } from "@repo/ui/components/kbd";
import {
  CommandPalette,
  type CommandPaletteGroup,
  type CommandPaletteItem,
  type CommandPaletteLabels,
} from "@repo/ui/components/command-palette";

import { MEGA_MENU_ICONS, routeKeyForHref } from "../_nav/mega-menu.ts";
import type { SiteNavItem } from "../_nav/site-nav.tsx";

/** Mirrors `SearchHit` in `@repo/core`; the wire shape is JSON, not a type import. */
interface Hit {
  kind: string;
  id: string;
  title: string;
  excerpt: string | null;
  href: string;
}

interface PaletteRow extends CommandPaletteItem {
  href: string;
}

export interface SiteSearchLabels extends CommandPaletteLabels {
  trigger: string;
  /** A query that came back with nothing. */
  empty: string;
  /** The box is empty or too short to search, and there is nothing to suggest. */
  prompt: string;
  /** A query is in flight and nothing has come back for it yet. */
  searching: string;
  /** Heading for the menu's top-level rows that have no children. */
  pages: string;
  /** Group headings by hit kind. The SERVICE returns a kind, never a word. */
  kinds: Record<string, string>;
}

/** The order the groups are drawn in, which the service does not decide. */
const KIND_ORDER = ["article", "glossary", "course", "lesson", "quiz", "video", "tool"];

const KIND_ICONS: Record<string, LucideIcon> = {
  article: Newspaper,
  glossary: BookOpen,
  course: GraduationCap,
  lesson: ListChecks,
  quiz: CircleHelp,
  video: Video,
  tool: Calculator,
};

const DEBOUNCE_MS = 250;
/** A stable default, so the suggestions memo is not rebuilt every render. */
const NO_MENU: SiteNavItem[] = [];
/** Matches `SEARCH_QUERY_MIN` in `@repo/contracts` — below it the API says no. */
const MIN_LENGTH = 2;

export function SiteSearch({
  locale,
  labels,
  menu = NO_MENU,
}: {
  locale: string;
  labels: SiteSearchLabels;
  /** The header's own menu tree, drawn as suggestions while the box is empty. */
  menu?: SiteNavItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  // The query a result ANSWERS, beside the hits — so the palette can tell
  // "nothing matched" from "still asking".
  const [result, setResult] = React.useState<{ q: string; hits: Hit[] }>({ q: "", hits: [] });

  // Client-only, with an SSR fallback — the admin palette's technique, and the
  // reason it is `useSyncExternalStore` rather than an effect: no second
  // render pass, no flash of the wrong key cap.
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

  const requestSeq = React.useRef(0);
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_LENGTH) {
      // Bump the sequence so an in-flight response cannot land after the field
      // was cleared — and do NOT clear state here. A short query renders with
      // the stale hits IGNORED (see `groups`), which is the admin palette's
      // arrangement and the reason neither of them calls setState in an
      // effect.
      requestSeq.current++;
      return;
    }
    const seq = ++requestSeq.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&locale=${encodeURIComponent(locale)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { hits?: Hit[] };
        if (seq !== requestSeq.current) return;
        setResult({ q, hits: body.hits ?? [] });
      } catch {
        // Including the rate limit: an empty palette that says "nothing found"
        // is the honest visible state, and a toast over a search box a reader
        // is still typing in is worse than silence.
        if (seq === requestSeq.current) setResult({ q, hits: [] });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale]);

  const trimmed = query.trim();
  const searching = trimmed.length >= MIN_LENGTH;

  const suggestions = React.useMemo(() => menuSuggestions(menu, labels.pages), [menu, labels]);

  const hitGroups: CommandPaletteGroup<PaletteRow>[] = React.useMemo(() => {
    const byKind = new Map<string, PaletteRow[]>();
    for (const hit of result.hits) {
      const row: PaletteRow = {
        id: hit.id,
        title: hit.title,
        description: hit.excerpt,
        href: hit.href,
      };
      const bucket = byKind.get(hit.kind);
      if (bucket) bucket.push(row);
      else byKind.set(hit.kind, [row]);
    }
    return KIND_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
      id: kind,
      // `kinds[kind]` over the raw key, ADR-044 #5's rule on the public side:
      // a reader never sees `video_topic`.
      label: labels.kinds[kind] ?? kind,
      icon: KIND_ICONS[kind] ?? FileText,
      items: byKind.get(kind) ?? [],
    }));
  }, [result, labels]);

  // The one place a too-short query is answered: the last response's hits are
  // held but not shown, so clearing the box brings the suggestions back
  // without an effect writing state.
  const groups = searching ? hitGroups : suggestions;
  const emptyText = !searching
    ? labels.prompt
    : result.q === trimmed
      ? labels.empty
      : labels.searching;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const go = (row: PaletteRow) => {
    close();
    router.push(row.href);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.trigger}
        onClick={() => setOpen(true)}
        className="md:hidden"
      >
        <SearchIcon aria-hidden className="size-4" />
      </Button>
      {/* Above `md` the trigger says what the shortcut is, which is the only
          way a reader learns it exists. Below it, the icon alone — the row is
          already carrying a hamburger, a logo and two auth entry points. */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden w-48 justify-start gap-2 text-muted-foreground md:inline-flex lg:w-56"
      >
        <SearchIcon aria-hidden className="size-4" />
        <span className="flex-1 truncate text-start text-sm font-normal">{labels.trigger}</span>
        <KbdGroup aria-hidden>
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
        emptyText={emptyText}
        labels={labels}
      />
    </>
  );
}

/**
 * The header menu as palette groups: every top-level row with children is a
 * group of those children, and the childless top-level rows share one group.
 * External rows are left out — the palette navigates with the locale-aware
 * router, which is the wrong tool for another site.
 */
function menuSuggestions(
  menu: SiteNavItem[],
  pagesLabel: string,
): CommandPaletteGroup<PaletteRow>[] {
  const toRow = (item: SiteNavItem["children"][number]): PaletteRow => {
    const key = routeKeyForHref(item.href);
    return {
      id: `menu:${item.id}`,
      title: item.label,
      description: item.title,
      href: item.href,
      icon: (key && MEGA_MENU_ICONS[key]) || undefined,
    };
  };
  const internal = (item: SiteNavItem["children"][number]) => !item.isExternal && item.href !== "";

  const groups: CommandPaletteGroup<PaletteRow>[] = [];
  const pages: PaletteRow[] = [];
  for (const item of menu) {
    const children = item.children.filter(internal);
    if (children.length > 0) {
      groups.push({
        id: `menu:${item.id}`,
        label: item.label,
        icon: Compass,
        items: children.map(toRow),
      });
    } else if (internal(item)) {
      pages.push(toRow(item));
    }
  }
  if (pages.length > 0)
    groups.push({ id: "menu:pages", label: pagesLabel, icon: FileText, items: pages });
  return groups;
}

function subscribeNever() {
  return () => {};
}
