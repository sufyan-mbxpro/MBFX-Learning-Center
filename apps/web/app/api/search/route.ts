import { NextResponse, type NextRequest } from "next/server";

import { rateLimit } from "@repo/auth";
import { publicSearchQuerySchema, ROUTE_PATHS } from "@repo/contracts";
import { getEnabledTools, searchPublicContent, type SearchHitKind } from "@repo/core";
import { routing } from "@repo/i18n/routing";
import { isFeatureVisible } from "@repo/settings";

import { clientIp } from "../../_lib/client-ip.ts";

// Site-wide public search (ADR-108) — the backend behind the header's ⌘K
// palette.
//
// **A route handler, not a server action.** A search is a READ, it is called
// once per keystroke-burst from a page that may be statically cached, and it
// answers with a plain JSON body a future client (the mobile app ADR-006 keeps
// the door open for) can call without a React runtime. A server action would
// tie it to one renderer for no gain.
//
// **It is anonymous and therefore bounded.** No session is read, so the bucket
// is the IP; `clientIp` returns null for a caller with no forwarded header and
// the fallback puts every such caller in one bucket, which throttles the
// header-less case harder rather than exempting it. The limit is generous
// because a debounced palette makes roughly one request per typed phrase and
// mean because there is no account behind it.
//
// **The flags gate here, not in `@repo/core`.** That is the repo's rule for
// every other flagged surface (`Explore`'s cards, the header's menu rows), and
// it is what lets the service stay a cacheable content read. A disabled
// section is ABSENT from the results, not present and unreachable.
//
// Not cached: results depend on a query string with unbounded cardinality, and
// a `"use cache"` over that is a memory leak with a nice name.

/** A debounced palette makes about one request a phrase; a script makes many. */
const LIMIT = 40;
const WINDOW_SECONDS = 60;

/** Which feature flag, if any, has to be on for a section to appear. */
const KIND_FLAGS: Record<SearchHitKind, string | null> = {
  article: "news",
  glossary: "glossary",
  course: "courses",
  lesson: "courses",
  quiz: "quizzes",
  video: "videos",
  tool: "calculators",
};

const ALL_KINDS = Object.keys(KIND_FLAGS) as SearchHitKind[];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const bucket = `public:search:${clientIp(request.headers) ?? "anonymous"}`;
  const limited = await rateLimit(bucket, LIMIT, WINDOW_SECONDS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const parsed = publicSearchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    locale: url.searchParams.get("locale") ?? routing.defaultLocale,
  });
  // A malformed query is an empty result, not a 400: the palette types into
  // this endpoint and a red console error per keystroke helps nobody.
  if (!parsed.success) return NextResponse.json({ hits: [], truncated: false });

  const { q, locale } = parsed.data;

  // `null` (an ANONYMOUS subject) is the right argument here and not a
  // shortcut: this endpoint reads no session, so a flag scoped to
  // AUTHENTICATED correctly hides its section from it. A signed-in reader sees
  // the same public corpus, which is what a public search is.
  const visible = await Promise.all(
    ALL_KINDS.map(async (kind) => {
      const flag = KIND_FLAGS[kind];
      return flag === null || (await isFeatureVisible(flag, null));
    }),
  );
  const kinds = ALL_KINDS.filter((_, index) => visible[index]);
  if (kinds.length === 0) return NextResponse.json({ hits: [], truncated: false });

  // Tools are CODE plus a row (ADR-086), not a translation table, so they are
  // matched from the enabled list rather than queried — which also keeps the
  // service free of a `@repo/contracts` route-path dependency.
  const tools = kinds.includes("tool") ? await getEnabledTools(locale) : [];

  const result = await searchPublicContent(locale, q, {
    kinds,
    staticPages: tools.map((tool) => ({
      id: tool.key,
      title: tool.title,
      excerpt: tool.tagline,
      href: `${ROUTE_PATHS.tools}/${tool.key}`,
    })),
  });

  return NextResponse.json(result, {
    // Private: the corpus is public, but a shared cache keyed on a query
    // string that a reader typed is a log of what readers type, held
    // somewhere nobody is looking after it.
    headers: { "Cache-Control": "private, no-store" },
  });
}
