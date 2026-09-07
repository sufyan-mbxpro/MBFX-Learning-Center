# ADR-031: Every authored link is a `LinkTarget` resolved at render — menus and blocks share one contract and one resolver

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS), extending Module 08 (navigation)
**Supersedes:** ADR-028 **in part** (its target shape and resolver become the shared contract below; its menu semantics — pruning, dynamic children, panels, batching — stand unchanged)
**Superseded by:** —

## Context

ADR-028 gave **menu items** polymorphic targets (`PAGE`, `ARTICLE`,
`COURSE`, …) resolved at render, so a slug change never breaks a menu and
an unpublished target is pruned. Nothing equivalent exists for the links
**inside pages**: `button`, `cta-band`, `image`, `icon-card`,
`process-step`, `stat-card`, card CTAs, `hero` links. Under plan v2 §6.2
those would store raw hrefs typed by an admin. Consequences
(`docs/changes/dynamic-site-plan-v2-review.md` §3.1):

- a slug change breaks every button pointing at the old path, or at best
  degrades it to a 301 hop (ADR-015 #1 writes the redirect);
- a deleted or unpublished target renders a dead link on a live page;
- a `PREMIUM` target renders a link a logged-out visitor cannot follow;
- "broken-link detection", which the owner lists as a required admin
  report, has nothing to detect against.

ADR-029 made links cheap to fix: the renderer already collects needs in a
first pass and resolves them batched and cached. A link is a need.

## Decision

### 1. One contract in `@repo/contracts`

```ts
export type LinkTarget =
  | { type: "URL"; url: string; newTab?: boolean; rel?: "nofollow" | "sponsored" }
  | { type: "ROUTE"; routeKey: string } // existing Module 08 route keys
  | { type: "PAGE"; pageId: string; anchor?: string } // any Page except PART
  | {
      type: "ARTICLE" | "ARTICLE_CATEGORY" | "ARTICLE_TAG" | "COURSE" | "GLOSSARY_TERM";
      targetId: string;
    }
  | { type: "MEDIA"; assetId: string } // downloads (PDF, brochure)
  | { type: "ANCHOR"; anchor: string } // same page
  | { type: "NONE" };
```

`URL` is validated as absolute `http(s)` or `mailto:`/`tel:`; a relative
internal path typed as a URL is refused by the schema with the message
"link to the page instead" — internal links are never free text.

Every block prop that is a link is typed `LinkTarget`. `MenuItem`'s
`linkType`/`targetId`/`routeKey`/`url` columns (ADR-028 §1) map onto the
same union; the contract test's matrix is shared.

### 2. One resolver, batched, cached by scope

`@repo/core/src/cms/links.ts` exports
`resolveLinks(targets: LinkTarget[], ctx: RenderContext): Promise<ResolvedLink[]>`:

- groups targets by type and issues **one read per type** (ADR-028's
  batching requirement, now for pages too);
- resolves entity targets **through the ADR-022 providers**, so the
  content type's own visibility rule applies (`publicArticleWhere` for
  articles) and the subject's tier is honoured;
- returns `{ href, label?, state: "ok" | "missing" | "unpublished" | "forbidden" }`
  with `href` built from the entity's **current** localized slug — no
  redirect hop;
- for `PAGE`, applies `localePrefix: "as-needed"` and appends `#anchor`;
  for `MEDIA`, returns the `/uploads/[file]` URL and marks `download`.

`renderTree` collects every `LinkTarget` in pass 1 alongside data needs and
resolves them in pass 2 (ADR-029). `buildNavigation` calls the same
function. There is no second resolver.

### 3. Cache placement follows ADR-029's scope rule

- **Page content links** resolve as a **per-need** cached read tagged
  `content` (they change when content changes), never inside the shell
  scope tagged `page:{id}` — otherwise an article slug change would leave a
  stale href in a cached page.
- **Part links** (header, footer, panels) resolve in the part's grouped
  call, tagged `part-data:{key}`, and may therefore be up to the part's
  `cacheLife` stale. That is acceptable because a slug change also writes a
  `Redirect` (ADR-015 #1): a stale part link still lands, via a 301, until
  the window expires. Stated in the part editor next to the staleness
  window ADR-029 already displays.

### 4. What renders when a target is not `ok`

| State                                       | Menu (ADR-028) | Block                                                                                                                                     |
| ------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `missing` / `unpublished`                   | pruned         | renders the block's **non-link variant** (a button becomes static text, an image loses its wrapper) and logs; in preview, a named warning |
| `forbidden` (visible only to a higher tier) | pruned         | same as above — never a link the visitor cannot follow                                                                                    |
| `URL` external                              | rendered       | rendered with `rel="noopener"` plus the authored `rel`, `target` per `newTab`                                                             |

A page **never 500s** and never ships a dead internal link because of a
target.

### 5. References are recorded on save

Every `LinkTarget` in a saved `PageVersion`, `MenuItem`, `CardTemplate` or
`StylePreset` is written to the shared `ContentReference` table (ADR-033)
with `refType = PAGE | ARTICLE | … | MEDIA`. The Overview's **Broken links**
report is a join of those rows against their targets' existence and
publication state — no crawl, no scan on read.

## Consequences

- **Link pickers replace URL fields everywhere.** The composer offers
  "Page / Article / Course / Glossary term / Category / Tag / File /
  Anchor / External URL"; typing an internal path is refused. This is a
  UX change from "paste a URL" and it is the point.
- **A slug change is now safe on three surfaces** (menus, pages, cards)
  instead of one. The `Redirect` row still exists for inbound traffic and
  for stale part caches.
- **Per-need link resolution adds cached reads to a page render.** They
  are batched per type and cached under `content`; a static page with ten
  buttons to five pages costs one `Page` read on a cold miss.
- **Migration of shipped data.** `MenuItem` rows are backfilled to
  `ROUTE`/`URL` per ADR-028; the `home.sections` hero CTA and the settings
  `header.cta` become `LinkTarget`s in the Phase 2 migration.

## Alternatives considered

- **Raw hrefs plus a link checker job.** Rejected: detection after the
  fact, redirect hops on every slug change, and no way to express
  "unpublished, so hide the button".
- **Store the resolved href and refresh on content save.** Rejected for
  the same reason ADR-028 rejected it — denormalisation with an
  invalidation duty on every publish path.
- **Resolve links inside the page shell scope for simplicity.** Rejected:
  a cached page would carry a stale href after a slug change, since
  `page:{id}` is not invalidated by content mutations.
- **A separate `PageLink` model with foreign keys.** Rejected: the node
  tree is JSON by decision (ADR-021); references are tracked by
  `ContentReference` (ADR-033), which gives the same integrity report
  without splitting the tree.

## Compliance

- Contract test: the `LinkTarget` union rejects relative internal paths as
  `URL`, and the menu matrix from ADR-028 passes against the shared schema.
- Integration: change an article slug → a page button and a menu item both
  render the new href on next render with **no redirect hop**; unpublish
  → the button renders as static text, the menu item is pruned.
- Leak probe: a `PREMIUM` target never renders as a link for a logged-out
  subject (extends ADR-012's flag matrix).
- Query-count test: a page with N links across T types issues at most T
  reads on a cold miss.
- Cache test: a page-content link is not served stale from `page:{id}`
  after a `content` invalidation.
- `check-block-fixtures`: every link-bearing block fixture covers `ok`,
  `missing` and `forbidden`.
