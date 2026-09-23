/**
 * The public site's absolute origin — `https://example.com`, no trailing
 * slash — for the few places that must print a FULL url: an email, a share
 * card, the sitemap, an SEO preview (changes-49).
 *
 * One precedence everywhere: `SITE_URL`, then `NEXT_PUBLIC_SITE_URL`, then
 * `BETTER_AUTH_URL`, then localhost. Before this, the admin's SEO previews
 * read only the second (and printed a bare path when it was unset), the
 * sitemap only the third, the newsletter the second with an empty fallback,
 * and a test email `https://example.com` — four answers to one question.
 * Everything that can be RELATIVE should stay relative instead: a relative
 * link needs no origin and cannot point at the wrong one.
 *
 * **`SITE_URL` leads because it is the only one a deployment can change.**
 * `NEXT_PUBLIC_*` is INLINED INTO THE BUNDLE at build time, so an image built
 * once and run on a real domain keeps whatever origin the build machine had —
 * which is how a production container ends up mailing `http://localhost:3000`
 * logos and reset links. `SITE_URL` is read from the process at call time, so
 * setting it on the container is enough and no rebuild is involved. It is
 * server-only by design: a browser bundle cannot see it and falls through to
 * the `NEXT_PUBLIC_` value, which is the correct answer on that side.
 *
 * The request's own `Host` header is deliberately NOT a source. It would make
 * this truly automatic, and it is attacker-controlled unless every proxy in
 * front of the app overwrites it — a poisoned `Host` on one request is how a
 * password-reset link gets mailed to a real user pointing at someone else's
 * server (security.md #13's neighbour). Configuration is the trustworthy
 * source; this variable is what makes configuring it a deploy-time act rather
 * than a build-time one.
 *
 * Takes the environment as an argument so a test can pass its own.
 */
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  const raw =
    env.SITE_URL || env.NEXT_PUBLIC_SITE_URL || env.BETTER_AUTH_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
