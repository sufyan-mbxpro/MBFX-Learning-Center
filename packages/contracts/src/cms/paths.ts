// CMS path derivation (Module 16, plan v2.2 §5.1 / ADR-021 §2 / ADR-032 §6).
// Pure — no db, no fs — shared by @repo/core/cms (authoritative, on save)
// and the admin metadata form (live preview), so the two cannot disagree.
import { z } from "zod";

// ─── Reserved paths (checked against real route files by
//     scripts/check-reserved-paths.mjs) ────────────────────────

/**
 * Today's explicit route directories/files under `apps/web/app` that a
 * STATIC page's first path segment must never collide with.
 */
export const RESERVED_PATHS = [
  "news",
  "analysis",
  "glossary",
  "economic-calendar",
  // Coded route sections whose reservation lagged the route files:
  // `about` landed with ADR-047 and `economic-calendar` with ADR-050.
  // Both have children, and reserving the parent segment covers them.
  "about",
  "sign-in",
  // Public self-registration (ADR-052). Reserved for the same reason
  // sign-in is: a CMS page at this path would shadow the real route.
  "sign-up",
  "admin",
  "api",
  "uploads",
  "_next",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
] as const;

/**
 * Segments claimed ahead of their route file landing. A module appends its
 * prefix here in the same PR that claims it — `courses` is GT2's detail
 * route (Phase 5). `tools` is deliberately NOT here: `/tools` is a CMS
 * STATIC page (Phase 7), not a reserved prefix.
 */
export const RESERVED_PREFIXES = ["courses"] as const;

/**
 * A COLLECTION page's path is fixed to its content type's hosting route in
 * every locale — the one exemption from the reserved-path guard (that
 * route file is what renders it, plan §7.2).
 */
export const CONTENT_ROUTES = {
  news: "/news",
  analysis: "/analysis",
  glossary: "/glossary",
  course: "/courses",
} as const satisfies Record<string, string>;
export type ContentRouteKey = keyof typeof CONTENT_ROUTES;

/** Request-side cap on parent-chain depth (input validation, not design policy — plan §5.1 rule 5). The publish *warning* above depth 3 is ADR-032 §6, a gate concern (Phase 3). */
export const MAX_PAGE_DEPTH = 6;

const RESERVED_SET: ReadonlySet<string> = new Set([...RESERVED_PATHS, ...RESERVED_PREFIXES]);

/** The first "/"-delimited segment of an absolute path; "" for "/" itself. */
export function firstPathSegment(path: string): string {
  return path.split("/")[1] ?? "";
}

export function isReservedFirstSegment(segment: string): boolean {
  return segment !== "" && RESERVED_SET.has(segment);
}

// ─── Slugs ───────────────────────────────────────────────────

/**
 * Normalises through the same rules as @repo/core's `slugify()`
 * (packages/core/src/content.ts) — duplicated, not imported: contracts may
 * not depend on core (architecture.md #8 points core → contracts, never
 * the reverse). Keep the two in sync by hand; both are four lines.
 *
 * Empty output is valid input-shape-wise (the home page's slug is `""`);
 * the rule "empty only for the home page" is enforced by the service
 * (PR 1.3), which is the one place that already knows `page.key`.
 */
export const pageSlugSchema = z
  .string()
  .trim()
  .max(300)
  .transform((s) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // combining diacritical marks
      .replace(/[^a-z0-9؀-ۿ]+/g, "-") // keep a-z 0-9 + the Arabic block
      .replace(/^-+|-+$/g, "")
      .slice(0, 150),
  );

// ─── Derivation ──────────────────────────────────────────────

export type DerivePagePathResult =
  { ok: true; path: string } | { ok: false; reason: "PARENT_NOT_TRANSLATED" };

/**
 * `path = "/"` for the home page; `"/" + slug` with no parent; the parent's
 * same-locale path + `"/" + slug` otherwise. A parent that has no
 * translation in this locale is a refusal, not a silent fallback — plan
 * §5.1 rule 1: there are no mixed-language paths.
 */
export function derivePagePath(input: {
  isHome: boolean;
  slug: string;
  hasParent: boolean;
  /** The parent's path in the target locale, or null if the parent has no translation there. Ignored when `hasParent` is false. */
  parentPath: string | null;
}): DerivePagePathResult {
  if (input.isHome) return { ok: true, path: "/" };
  if (!input.hasParent) return { ok: true, path: `/${input.slug}` };
  if (input.parentPath === null) return { ok: false, reason: "PARENT_NOT_TRANSLATED" };
  return { ok: true, path: `${input.parentPath}/${input.slug}` };
}

/**
 * The public URL for a stored `path` (already locale-prefix-free, ADR-021
 * §2): `""` prefix for the default locale, `/{locale}` otherwise
 * (`localePrefix: "as-needed"`). The home page (`path === "/"`) never gets
 * a trailing slash appended to its prefix — `/es`, never `/es/`.
 */
export function publicPagePath(locale: string, defaultLocale: string, path: string): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  if (path === "/") return prefix === "" ? "/" : prefix;
  return `${prefix}${path}`;
}
