"use client";

// Read one query parameter without making the page dynamic.
//
// The credential screens are static shells (architecture.md #6). `?reset=1`,
// `?verified=1` and `?token=…` all arrive on the URL, and reading them with
// `useSearchParams()` would force a Suspense boundary and opt the whole route
// out of prerendering for a value that only affects one line of chrome.
//
// `useSyncExternalStore` rather than `useEffect` + `setState`: the URL IS an
// external store, which is the case this hook exists for. The effect version
// trips `react-hooks/set-state-in-effect` — correctly, since it renders once
// with the wrong value and then immediately again with the right one — while
// the server snapshot below gives React an honest "not known on the server"
// and no hydration mismatch.
//
// `subscribe` is a no-op on purpose: nothing changes this value in place. A
// client navigation that changes the query remounts the screen.
import { useSyncExternalStore } from "react";

const neverChanges = () => () => {};

export function useSearchParam(name: string): string | null {
  return useSyncExternalStore(
    neverChanges,
    // A primitive, so React's Object.is check settles immediately rather than
    // looping on a fresh object every render.
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}
