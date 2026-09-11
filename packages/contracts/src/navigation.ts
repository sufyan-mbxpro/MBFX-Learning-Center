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
  // Per-track learning surfaces (ADR-065 §1/§4). Spelled literally rather
  // than generated from LEARN_TRACKS, because `RouteKey` has to stay a union
  // of string literals — a computed key would widen it to `string` and take
  // the menu row's compile-time check with it. `LEARN_TRACK_ROUTE_KEYS` below
  // binds these back to the registry, and a test fails if the two disagree.
  "learn-forex": "/learn/forex",
  "learn-forex-videos": "/learn/forex/videos",
  "learn-forex-quizzes": "/learn/forex/quizzes",
  "learn-forex-glossary": "/learn/forex/glossary",
  "learn-crypto": "/learn/crypto",
  "learn-crypto-videos": "/learn/crypto/videos",
  "learn-crypto-quizzes": "/learn/crypto/quizzes",
  "learn-crypto-glossary": "/learn/crypto/glossary",
  glossary: "/glossary",
  tools: "/tools",
  markets: "/markets",
  analysis: "/analysis",
  "economic-calendar": "/economic-calendar",
  news: "/news",
  "sign-in": "/sign-in",
  "sign-up": "/sign-up",
  // About section (ADR-047). Coded static routes under app/(public)/[locale]/about/**,
  // not CMS pages — they take Next's normal precedence over the [...slug]
  // catch-all, exactly as news/ and glossary/ already do.
  about: "/about",
  "about-why-us": "/about/why-us",
  "about-transparency": "/about/transparency",
  "about-security": "/about/security",
  "about-support": "/about/support",
} as const satisfies Record<string, string>;

export type RouteKey = keyof typeof ROUTE_PATHS;

export function isRouteKey(key: string): key is RouteKey {
  return key in ROUTE_PATHS;
}

/**
 * The About section's route keys, in menu order (ADR-047). Exported so the
 * sitemap and the mega-menu panel enumerate the same five destinations —
 * a page added here shows up in both without a second edit.
 */
export const ABOUT_ROUTE_KEYS = [
  "about",
  "about-why-us",
  "about-transparency",
  "about-security",
  "about-support",
] as const satisfies readonly RouteKey[];

/** Those keys resolved to paths, for callers that need the URL not the key. */
export const ABOUT_PATHS: readonly string[] = ABOUT_ROUTE_KEYS.map((key) => ROUTE_PATHS[key]);

/**
 * The four route keys each learning track owns (ADR-065 §4, extended by
 * ADR-068 §1): its school index, its video library, its quiz index and its
 * glossary view.
 *
 * This is the join between two registries that must not drift —
 * `LEARN_TRACKS` in `learn.ts` decides which tracks exist, `ROUTE_PATHS`
 * above decides which URLs exist, and `learn.test.ts` fails if either grows
 * an entry the other has not. The mega-menu panels, the seeded menu rows, the
 * section bar and the sitemap all read the tracks through here, so adding a
 * track lights up every surface from one edit plus its two route entries.
 */
export const LEARN_TRACK_ROUTE_KEYS = {
  forex: {
    index: "learn-forex",
    videos: "learn-forex-videos",
    quizzes: "learn-forex-quizzes",
    glossary: "learn-forex-glossary",
  },
  crypto: {
    index: "learn-crypto",
    videos: "learn-crypto-videos",
    quizzes: "learn-crypto-quizzes",
    glossary: "learn-crypto-glossary",
  },
} as const satisfies Record<
  string,
  { index: RouteKey; videos: RouteKey; quizzes: RouteKey; glossary: RouteKey }
>;

/**
 * The surfaces a track owns, in section-bar order. Enumerated here so the
 * drift test iterates the registry instead of a list typed beside it — the
 * mistake ADR-068 Consequences records, where three places in `learn.test.ts`
 * hardcoded the original three and none of them failed when a fourth arrived.
 */
export const LEARN_TRACK_SURFACES = ["index", "videos", "quizzes", "glossary"] as const;
export type LearnTrackSurface = (typeof LEARN_TRACK_SURFACES)[number];

export type LearnTrackRouteKeys =
  (typeof LEARN_TRACK_ROUTE_KEYS)[keyof typeof LEARN_TRACK_ROUTE_KEYS];

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
