"use client";

// The viewer's clock and timezone, read the way React wants them read.
//
// Both are facts about the BROWSER, so a server render cannot know either:
// the timezone is not in the request (and guessing it from a locale is wrong
// for most of the world), and the current minute differs between the render
// and the paint.
//
// `useSyncExternalStore` rather than `useEffect` + `setState`. The effect
// version is a cascading render the lint rules refuse
// (react-hooks/set-state-in-effect), and they are right: this is
// subscribing to an external source, which is the case the hook exists for.
// It also gives a server snapshot explicitly, so the markup React renders on
// the server and the one it hydrates with agree by construction rather than
// by luck.
import { useSyncExternalStore } from "react";

/** A minute is the resolution these widgets display; a second would re-render
 *  sixty times as often to move a marker by a pixel. */
const TICK_MS = 60_000;

function subscribeToMinute(onChange: () => void): () => void {
  const timer = setInterval(onChange, TICK_MS);
  return () => clearInterval(timer);
}

/**
 * The current minute, as epoch ms truncated to the minute.
 *
 * Truncated because `getSnapshot` must return the SAME value until something
 * actually changed — returning `Date.now()` would make React re-render on
 * every read and warn about an infinite loop.
 */
function minuteSnapshot(): number {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS;
}

/** `null` on the server and on the first client render, a Date after that. */
export function useClientNow(): Date | null {
  const minute = useSyncExternalStore(
    subscribeToMinute,
    minuteSnapshot,
    // The server has no clock the client would agree with, so it says so and
    // the widget renders its loading state for one paint.
    () => null,
  );
  return minute === null ? null : new Date(minute);
}

function subscribeToNothing(): () => void {
  // The zone cannot change without a reload, so there is nothing to listen to.
  return () => {};
}

function zoneSnapshot(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** The viewer's IANA zone; "UTC" on the server, so hydration matches. */
export function useClientTimeZone(): string {
  return useSyncExternalStore(subscribeToNothing, zoneSnapshot, () => "UTC");
}
