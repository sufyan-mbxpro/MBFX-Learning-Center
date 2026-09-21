"use client";

// In-place navigation for the `#latest` listing band (changes-39): paging and
// searching swap the cards, they do not look like a page load.
//
// Paging was already a soft navigation, and still read as a reload: nothing
// answered the click for the second the server took, then the router scrolled
// to the top of a page that had also lost its spotlight and category bands
// (both belong to page 1 only). The search box was worse — a plain GET
// `<form>`, so a REAL document reload.
//
// Every URL is unchanged and still a real, indexable address (a news page is
// not client state — ADR-121 §2): each control stays an `<a href>` or a GET
// form, so without JavaScript they work exactly as before. With it, the
// navigation runs in a transition with `scroll: false`, the results section
// shows its own pending state (changes-45, `ListingPendingRegion`), and the
// band — not the page — is brought back into view.
//
// The pending flag is shared through the provider's context rather than a
// module store: the sidebar search and the pager both sit INSIDE the one
// provider `ArticleListing` renders, so every control that starts a
// navigation and the region that shows it already share an ancestor.
//
// Outside a provider (the article detail page's sidebar) the search still
// navigates client-side, with the router's ordinary scroll, because there it
// leaves the page for a listing.
import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import type { ComponentProps, FormEvent, MouseEvent, ReactNode } from "react";
import { Link, useRouter } from "@repo/i18n/navigation";
import { Input, type InputProps } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";

interface ListingNavigation {
  navigate: (href: string) => void;
  pending: boolean;
}

const ListingNavigationContext = createContext<ListingNavigation | null>(null);

/** The band a finished navigation scrolls back to — `ArticleListing`'s id. */
const LISTING_ANCHOR = "latest";

export function ListingNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const returnToListing = useRef(false);

  useEffect(() => {
    if (pending || !returnToListing.current) return;
    returnToListing.current = false;
    const band = document.getElementById(LISTING_ANCHOR);
    if (!band) return;
    // Only when the band's start is off screen: a reader who paged from a
    // short grid is already looking at it, and a jump would be the reload
    // feeling this component exists to remove.
    const { top } = band.getBoundingClientRect();
    if (top >= 0 && top < window.innerHeight / 2) return;
    band.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [pending]);

  const navigate = (href: string) => {
    returnToListing.current = true;
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  };

  return (
    <ListingNavigationContext.Provider value={{ navigate, pending }}>
      {children}
    </ListingNavigationContext.Provider>
  );
}

/**
 * The results section's pending state (changes-45): while the next page or
 * search is on its way, THIS region — the cards, not the page, not the
 * sidebar — says so, and when the new cards land they rise in.
 *
 * - At once: a `.progress-sweep` line along the region's top edge (the admin
 *   DataTable's `pending` line), `aria-busy`, and a polite status message.
 * - After 150ms: the current cards fade out under `skeleton`, placeholder
 *   cards laid out on the same grid. The delay is the point — a FULLY
 *   prefetched page (changes-43) usually lands inside it, and a skeleton that
 *   flashes for one frame reads as a glitch, not as loading.
 * - On arrival: the results are keyed by `resultsKey`, so a new page or query
 *   mounts fresh and plays a fade-and-rise. Only after the reader has
 *   navigated here — the first paint belongs to the band's own `Reveal`.
 *
 * The movement sits behind `motion-safe:`; a reduced-motion reader gets the
 * opacity changes only, which carry the same information without travel.
 */
export function ListingPendingRegion({
  resultsKey,
  skeleton,
  busyLabel,
  children,
}: {
  /** Changes whenever the results do (page + query). */
  resultsKey: string;
  /** Placeholder cards shown over the fading results while pending. */
  skeleton?: ReactNode;
  /** Announced politely while pending — a catalog string from the caller. */
  busyLabel: string;
  children: ReactNode;
}) {
  const pending = useContext(ListingNavigationContext)?.pending ?? false;

  // Derived state from props rather than an effect (see ListingSearchInput):
  // `arrived` flips on the first render whose results differ from the ones
  // this region mounted with, and stays on.
  const [seenKey, setSeenKey] = useState(resultsKey);
  const [arrived, setArrived] = useState(false);
  if (resultsKey !== seenKey) {
    setSeenKey(resultsKey);
    setArrived(true);
  }

  return (
    <div
      aria-busy={pending || undefined}
      data-pending={pending ? "" : undefined}
      className="relative"
    >
      <span role="status" className="sr-only">
        {pending ? busyLabel : ""}
      </span>
      {pending && (
        <div
          aria-hidden
          data-slot="listing-progress"
          className="progress-sweep absolute inset-x-0 -top-4 z-20 h-0.5 rounded-full"
        />
      )}
      <div
        key={resultsKey}
        data-slot="listing-results"
        className={cn(
          "transition-opacity duration-200",
          pending && "pointer-events-none",
          pending && (skeleton ? "opacity-0 delay-150" : "opacity-60"),
          !pending &&
            arrived &&
            "animate-in duration-500 ease-out fade-in-0 motion-safe:slide-in-from-bottom-4",
        )}
      >
        {children}
      </div>
      {pending && skeleton && (
        <div
          aria-hidden
          data-slot="listing-skeleton"
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden animate-in duration-200 fill-mode-both delay-150 fade-in-0"
        >
          {skeleton}
        </div>
      )}
    </div>
  );
}

/** A modified click (new tab, new window, download) keeps the browser's own behaviour. */
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

/**
 * A pager link. Renders the same locale-aware `<a>` as `Link`; inside a
 * provider a plain click becomes an in-place navigation.
 */
export function ListingLink({
  href,
  onClick,
  ...props
}: ComponentProps<typeof Link> & { href: string }) {
  const context = useContext(ListingNavigationContext);
  return (
    <Link
      {...props}
      href={href}
      // A FULL prefetch (changes-43). The default stops at the section's
      // `loading.tsx`, so a click still waited on the server and flashed the
      // skeleton; prefetched in full, the next page is already in the router
      // cache when the pager is clicked, and only the cards change.
      prefetch={props.prefetch ?? true}
      scroll={context ? false : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!context || !isPlainClick(event)) return;
        event.preventDefault();
        context.navigate(href);
      }}
    />
  );
}

/** The sidebar search: a GET form that navigates without reloading the document. */
export function ListingSearchForm({
  action,
  className,
  children,
}: {
  /** Locale-less path, the way `Link` expects it. */
  action: string;
  className?: string;
  children: ReactNode;
}) {
  const context = useContext(ListingNavigationContext);
  const router = useRouter();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    // A new query starts at page one, which is why `page` is not carried.
    const href = q ? `${action}?${new URLSearchParams({ q }).toString()}` : action;
    if (context) context.navigate(href);
    else router.push(href);
  };

  return (
    <form action={action} onSubmit={onSubmit} role="search" className={className}>
      {children}
    </form>
  );
}

/**
 * The search box inside a `ListingSearchForm`. CONTROLLED, and that is the
 * whole point of it existing.
 *
 * Searching became a soft navigation in changes-39, so this input is no longer
 * remounted when the results change — the same DOM node stays put while `query`
 * goes from `undefined` to `"gold"`. Base UI's `Input` is a Field control, and
 * a Field control whose `defaultValue` changes after it has initialised warns
 * ("A component is changing the default value state of an uncontrolled
 * FieldControl"): an uncontrolled input reads its default ONCE, so every later
 * default is a value the field will never show. The warning was accurate — the
 * box kept the previous query after a soft navigation.
 *
 * Controlling it fixes both halves. The URL stays the source of truth: when
 * `query` changes (a fresh search, a tag click, the back button) the box is
 * re-seeded from it, while anything typed in between is kept.
 */
export function ListingSearchInput({ query, ...props }: { query?: string } & InputProps) {
  // Derived state from props, the documented React pattern rather than an
  // effect: an effect would paint the stale value for one frame first.
  const [value, setValue] = useState(query ?? "");
  const [seenQuery, setSeenQuery] = useState(query ?? "");
  if ((query ?? "") !== seenQuery) {
    setSeenQuery(query ?? "");
    setValue(query ?? "");
  }

  return (
    <Input
      {...props}
      type="search"
      name="q"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}
