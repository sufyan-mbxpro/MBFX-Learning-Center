/**
 * Route params, DECODED.
 *
 * A translated slug is not ASCII — the Arabic article lives at
 * `/ar/news/كيفية-حساب-…` — and Next does not hand every render pass the same
 * spelling of it: `generateMetadata` received the decoded segment while the
 * page's prefetch pass received `%D9%83%D9%8A…`, matched no `slug` row, and
 * 404'd an article whose `<title>` had just rendered correctly. Every lookup
 * keys on the stored (decoded) slug, so every route that reads one decodes
 * through here first.
 *
 * Decoding is a no-op on a value that is already decoded: a slug never carries
 * a `%` (slugify strips it), and a malformed escape is returned unchanged
 * rather than thrown, so a junk URL still reaches the route's own not-found.
 */
export function decodeSegment(value: string): string {
  if (!value.includes("%")) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Every segment of a route's params through `decodeSegment`, shape unchanged. */
export function decodeParams<T extends Record<string, string | string[] | undefined>>(
  params: T,
): T {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    out[key] =
      value === undefined
        ? value
        : Array.isArray(value)
          ? value.map(decodeSegment)
          : decodeSegment(value);
  }
  return out as T;
}
