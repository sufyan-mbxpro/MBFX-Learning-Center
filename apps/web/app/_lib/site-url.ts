import { siteOrigin } from "@repo/utils";

/**
 * The site's absolute origin, and the one place the app reads it.
 *
 * Four files once carried their own copy of
 * `process.env.BETTER_AUTH_URL ?? "http://localhost:3000"` — the sitemap, the
 * robots rules, the RSS feed, and the public root layout's `metadataBase`.
 * A wrong origin does not throw, it ships share cards pointing at localhost.
 * Since changes-49 the precedence itself lives in `@repo/utils`'s
 * `siteOrigin()` (`NEXT_PUBLIC_SITE_URL`, then `BETTER_AUTH_URL`), shared
 * with the emails `@repo/core` builds, and the admin's SEO previews read this
 * too instead of the bare variable.
 *
 * No trailing slash: every caller composes `${siteUrl()}${path}` and `path`
 * already starts with one.
 */
export function siteUrl(): string {
  return siteOrigin();
}
