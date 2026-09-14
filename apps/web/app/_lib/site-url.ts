/**
 * The site's absolute origin, and the one place its fallback lives.
 *
 * Four files carried their own copy of
 * `process.env.BETTER_AUTH_URL ?? "http://localhost:3000"` — the sitemap, the
 * robots rules, the RSS feed, and (once `metadataBase` landed) the public
 * root layout. A duplicated default is four places to miss when the variable
 * is renamed, and the newest reader is the one that fails silently: a wrong
 * `metadataBase` does not throw, it ships share cards pointing at localhost.
 *
 * The trailing slash is stripped because every caller composes
 * `${siteUrl()}${path}` and `path` already starts with one.
 */
export function siteUrl(): string {
  const raw = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
