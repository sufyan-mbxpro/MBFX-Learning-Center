/**
 * The public site's absolute origin — `https://example.com`, no trailing
 * slash — for the few places that must print a FULL url: an email, a share
 * card, the sitemap, an SEO preview (changes-49).
 *
 * One precedence everywhere: `NEXT_PUBLIC_SITE_URL`, then `BETTER_AUTH_URL`,
 * then localhost. Before this, the admin's SEO previews read only the first
 * (and printed a bare path when it was unset), the sitemap only the second,
 * the newsletter the first with an empty fallback, and a test email
 * `https://example.com` — four answers to one question. Everything that can
 * be RELATIVE should stay relative instead: a relative link needs no origin
 * and cannot point at the wrong one.
 *
 * Takes the environment as an argument so a test can pass its own.
 */
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  const raw = env.NEXT_PUBLIC_SITE_URL || env.BETTER_AUTH_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
