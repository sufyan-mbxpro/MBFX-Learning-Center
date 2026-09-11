"use client";

// The one place the admin asks the server for media (ADR-067). Owns the
// request, its abort, the search debounce, the page cursor and a short-lived
// response cache, so the picker and the library screen cannot drift on any of
// them.
//
// The rule it exists to keep: **opening a picker never loads the library.**
// One request on open — the caller's category, one kind, one page, with the
// chrome folded in via `include` — and one more request per thing the admin
// actually asks for. There is no code path here that fetches everything,
// because there is no server function that would answer.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_MEDIA_CATEGORIES, MEDIA_PAGE_SIZE } from "@repo/contracts";
import type { MediaCategory, MediaSourceType } from "@repo/contracts";
import type { MediaAssetRow, MediaFacets, MediaKindCounts } from "@repo/core";

export type CategoryFilter = MediaCategory | typeof ALL_MEDIA_CATEGORIES;
export type PickableKind = keyof MediaKindCounts;

export interface MediaPageResponse {
  items: MediaAssetRow[];
  nextCursor: string | null;
  facets?: MediaFacets;
  recent?: MediaAssetRow[];
}

/** How long a search waits for the typing to stop. Long enough to skip the middle of a word, short enough to feel like filtering. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * A response cache OUTSIDE React, deliberately. The picker dialog unmounts on
 * close on purpose — that unmount IS its state reset — so a cache inside the
 * component would be thrown away exactly when it is most useful: reopening
 * the same picker twice while editing one article.
 *
 * Not a server cache: these reads are permission-scoped on a force-dynamic
 * surface, so `"use cache"` does not apply and no cache tag is involved
 * (ADR-067 §6; architecture.md #12's frozen tag list does not grow).
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; response: MediaPageResponse }>();

/** Called after any upload, replace or delete: a stale grid is worse than a refetch. */
export function invalidateMediaCache(): void {
  cache.clear();
}

/** The library screen offers an "all kinds" tab; a picker never does — its tabs are the caller's `kinds`. */
export const ALL_KINDS = "all" as const;
export type KindFilter = PickableKind | typeof ALL_KINDS;

export interface UseMediaBrowserOptions {
  category: CategoryFilter;
  /** The kind tab that is currently selected. */
  kind: KindFilter;
  /** Every kind this surface may show — narrows `recent` to the same set. */
  kinds?: readonly PickableKind[];
  query: string;
  /** Scopes the recently-used strip; omit on the library screen, which shows none. */
  sourceType?: MediaSourceType;
  /** Ask for facet counts and the recently-used strip on the first request. */
  includeChrome?: boolean;
  limit?: number;
  /**
   * A first page the server already rendered. Seeded into the cache under
   * the URL the opening question produces, so the screen paints with rows
   * and issues NO request until the admin changes something.
   */
  initialResponse?: MediaPageResponse;
}

export interface MediaBrowserState {
  items: MediaAssetRow[];
  facets: MediaFacets | null;
  recent: MediaAssetRow[];
  /** `loading` is the first page; `loading-more` is a Load More in flight. */
  status: "loading" | "loading-more" | "ready" | "error";
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

/**
 * The request the hook makes. Exported so ADR-067 §1's invariant is testable
 * without a DOM: the URL is the observable form of "how narrow is the
 * question", and a test can hold it to one kind, one category and a bounded
 * limit.
 */
export function buildUrl(
  options: UseMediaBrowserOptions,
  cursor: string | null,
  chrome: boolean,
): string {
  const params = new URLSearchParams();
  if (options.category !== ALL_MEDIA_CATEGORIES) params.set("category", options.category);
  if (options.kind !== ALL_KINDS) params.set("kind", options.kind);
  if (options.query.trim()) params.set("q", options.query.trim());
  params.set("limit", String(options.limit ?? MEDIA_PAGE_SIZE));
  if (cursor) params.set("cursor", cursor);
  if (chrome) {
    params.set("include", "facets,recent");
    if (options.sourceType) params.set("sourceType", options.sourceType);
  }
  return `/admin/api/media?${params.toString()}`;
}

export function useMediaBrowser(options: UseMediaBrowserOptions): MediaBrowserState {
  const { category, kind, query, includeChrome = true, limit } = options;
  const kindsKey = options.kinds?.join(",") ?? "";
  // The identity of "which question is being asked". Changing it resets the
  // pages; changing anything else does not.
  const queryKey = `${category}|${kind}|${kindsKey}|${query.trim()}|${limit ?? MEDIA_PAGE_SIZE}`;

  const [pages, setPages] = useState<MediaPageResponse[]>([]);
  const [status, setStatus] = useState<MediaBrowserState["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  // Chrome is fetched once per hook instance, not once per query: facet
  // counts do not change when the admin switches tabs. STATE, not a ref —
  // it is rendered, so a ref would show the previous value until something
  // else happened to re-render (react-hooks/refs catches exactly this).
  const [chrome, setChrome] = useState<{ facets: MediaFacets | null; recent: MediaAssetRow[] }>({
    facets: null,
    recent: [],
  });
  // Read only inside the effect: "have we already paid for the chrome?" is
  // not a rendered value, and making it state would re-run the effect.
  const hasChromeRef = useRef(false);
  const initialRef = useRef(options.initialResponse);

  // First page. Reading the library is synchronising with an external system,
  // so it belongs in an effect; every setState happens in a promise callback
  // rather than synchronously in the body.
  useEffect(() => {
    const controller = new AbortController();
    // No debounce for an empty box: only actual typing should wait.
    const delay = query.trim() ? SEARCH_DEBOUNCE_MS : 0;
    const needsChrome = includeChrome && !hasChromeRef.current;

    // A first page the server already rendered goes into the cache before
    // the lookup below, so the screen paints with rows and issues NO request
    // until the admin changes something. Seeded here rather than during
    // render — writing to a module-level Map in a render body is a side
    // effect, however convenient.
    const initial = initialRef.current;
    if (initial) {
      initialRef.current = undefined;
      cache.set(buildUrl({ ...options, query }, null, needsChrome), {
        at: Date.now(),
        response: initial,
      });
    }

    const applyChrome = (response: MediaPageResponse) => {
      if (!response.facets) return;
      hasChromeRef.current = true;
      setChrome({ facets: response.facets, recent: response.recent ?? [] });
    };

    const timer = setTimeout(() => {
      const url = buildUrl({ ...options, query }, null, needsChrome);
      const cached = cache.get(url);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        applyChrome(cached.response);
        setPages([cached.response]);
        setCursor(cached.response.nextCursor);
        setStatus("ready");
        return;
      }

      setStatus("loading");
      fetch(url, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(await readError(response));
          return (await response.json()) as MediaPageResponse;
        })
        .then((response) => {
          cache.set(url, { at: Date.now(), response });
          applyChrome(response);
          setPages([response]);
          setCursor(response.nextCursor);
          setError(null);
          setStatus("ready");
        })
        .catch((cause: unknown) => {
          // An abort is the expected outcome of typing another character or
          // flipping a tab — not a failure to show anyone.
          if (controller.signal.aborted) return;
          setError(cause instanceof Error ? cause.message : String(cause));
          setStatus("error");
        });
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `options` is rebuilt every render; `queryKey` is its meaningful identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey is the derived identity of every field read above
  }, [queryKey, reloadToken]);

  const loadMore = useCallback(() => {
    if (!cursor) return;
    setStatus("loading-more");
    const url = buildUrl({ ...options, query }, cursor, false);
    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return (await response.json()) as MediaPageResponse;
      })
      .then((response) => {
        setPages((previous) => [...previous, response]);
        setCursor(response.nextCursor);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same derived identity as the effect above
  }, [cursor, queryKey]);

  const refresh = useCallback(() => {
    invalidateMediaCache();
    hasChromeRef.current = false;
    setChrome({ facets: null, recent: [] });
    setReloadToken((token) => token + 1);
  }, []);

  const items = useMemo(() => pages.flatMap((page) => page.items), [pages]);

  return {
    items,
    facets: chrome.facets,
    recent: chrome.recent,
    status,
    error,
    hasMore: cursor !== null,
    loadMore,
    refresh,
  };
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `Request failed (${response.status})`;
}
