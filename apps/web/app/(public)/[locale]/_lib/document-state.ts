"use client";

// The browser state a rotating promotion must respect (ADR-174 #2, ADR-175
// #3), as external stores. Shared by the banners and the home spotlight so the
// two cannot disagree about when motion is allowed.
import { useSyncExternalStore } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// A media query as external state. The server snapshot is `false`: a server
// render has no viewport and no preference, and every caller renders its
// moving parts only after hydration.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function usePageVisible(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener("visibilitychange", onChange);
      return () => document.removeEventListener("visibilitychange", onChange);
    },
    () => document.visibilityState !== "hidden",
    () => true,
  );
}
