// Navigation contracts (Module 08). The exactly-one-of url/routeKey rule
// lives here (plan.md: "resolves routeKey vs external url — exactly-one
// rule validated by contracts") so both the admin's menu editor (Module
// 09) and @repo/core's builder validate against the same schema.
import { z } from "zod";

/**
 * Internal route registry: the routeKeys menu items may reference, mapped
 * to their path under the [locale] segment. A menu item pointing at a
 * route is stored as a KEY, not a path — paths can be reorganized in one
 * place here without touching every menu row in the database.
 */
export const ROUTE_PATHS = {
  home: "/",
  learn: "/learn",
  glossary: "/glossary",
  tools: "/tools",
  markets: "/markets",
  analysis: "/analysis",
  "economic-calendar": "/economic-calendar",
  news: "/news",
  "sign-in": "/sign-in",
  "sign-up": "/sign-up",
} as const satisfies Record<string, string>;

export type RouteKey = keyof typeof ROUTE_PATHS;

export function isRouteKey(key: string): key is RouteKey {
  return key in ROUTE_PATHS;
}

export const menuItemLinkSchema = z
  .object({
    url: z.string().max(500).nullish(),
    routeKey: z.string().max(100).nullish(),
  })
  .refine((v) => Boolean(v.url) !== Boolean(v.routeKey), {
    message: "Exactly one of url or routeKey must be set",
  })
  .refine((v) => !v.routeKey || isRouteKey(v.routeKey), {
    message: "routeKey must exist in the ROUTE_PATHS registry",
  });

export type MenuItemLink = z.infer<typeof menuItemLinkSchema>;
