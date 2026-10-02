"use client";

import { setSiteTimeZone } from "@repo/utils";

/**
 * The browser half of ADR-182: client components print dates through the
 * same `@repo/utils` helpers, in a separate module instance, so the zone the
 * server used is set here too. During render, not in an effect, and rendered
 * BEFORE the layout's children: React renders in tree order, so every client
 * component below already reads the site's zone on its first render, and the
 * server's HTML and the hydrating client agree. Idempotent — it only ever
 * writes the one site-wide value.
 */
export function SiteTimeZone({ value }: { value: string }) {
  setSiteTimeZone(value);
  return null;
}
