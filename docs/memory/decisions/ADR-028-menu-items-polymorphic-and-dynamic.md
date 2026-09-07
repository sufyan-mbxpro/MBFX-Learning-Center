# ADR-028: Menu items get polymorphic link targets, dynamic children and panel references

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS), extending Module 08 (navigation)
**Supersedes:** — (extends Module 08's `MenuItem` contract; the
"exactly one of `url` / `routeKey`" rule is replaced by the rule in
§Decision 1 below)
**Superseded by:** ADR-031 (in part — the target shape and resolver become the shared `LinkTarget` contract; menu semantics stand)

## Context

Module 08 shipped `Menu` / `MenuItem` / `MenuItemTranslation` with
`buildNavigation(menuKey, locale, subject)` filtering by `isActive`,
`visibility`, `requiresFeature` and `requiresPermission`, an admin
drag-reorder UI, and a contract rule enforcing **exactly one of `url` or
`routeKey`** per item, with a test.

The owner's requirement adds three things that rule cannot express:

1. **Link to an entity, not a path** — "link to: Page / News / Course /
   Category / Event / External URL". Typing `/news/eur-usd-outlook` by hand
   means a slug change silently breaks the menu; ADR-015 already writes a
   301 `Redirect` on slug change, so the link would survive but degrade to a
   redirect hop, and a deleted item would 404 from the main nav.
2. **Dynamic children** — "Courses → Beginner / Advanced / Premium" resolved
   from categories rather than hand-maintained, so a new category appears in
   the menu without an admin edit.
3. **Mega-menu panels** — a menu item whose dropdown is a designed panel
   (ADR-027), including a live collection column.

## Decision

### 1. Polymorphic targets

`MenuItem` gains `linkType` and `targetId`:

```prisma
enum MenuLinkType {
  ROUTE            // existing routeKey — unchanged behaviour
  URL              // existing external url — unchanged behaviour
  PAGE             // Page (any kind except PART)
  ARTICLE
  ARTICLE_CATEGORY
  ARTICLE_TAG
  COURSE
  GLOSSARY_TERM
  DYNAMIC          // children resolved from a provider; see §3
  NONE             // a label that only opens a panel/submenu
}
```

The contract rule becomes: **exactly one target consistent with
`linkType`** — `ROUTE` requires `routeKey`, `URL` requires `url`, every
entity type requires `targetId`, `DYNAMIC` requires `dynamicSource`, `NONE`
requires none and must have children or a panel. The existing Module 08
contract test is rewritten to this matrix; existing rows are backfilled to
`ROUTE`/`URL`, so shipped behaviour and its tests survive the migration.

**Hrefs are resolved at render, never stored.** Resolution goes through the
ADR-022 providers, so a slug change is reflected with no menu edit and no
redirect hop. An item whose target is missing, unpublished or invisible to
the subject is **pruned**, exactly as `isActive: false` is today — a menu
never renders a link to a 404.

### 2. Icons and badges are allow-listed

`iconType: NONE | PRESET | MEDIA`. `PRESET` is a name from an **exported
allowlist constant** in `@repo/ui` (not an arbitrary lucide string, so a
tree-shaken icon set stays predictable and a typo fails a test); `MEDIA` is
a `MediaAsset` id, subject to ADR-017's magic-byte validation and served
through `/uploads/[file]`. Optional `badgeKey` is an i18n catalog key from a
bounded set (`new`, `hot`, `beta`, `premium`) — not free text, per ADR-024
§3.

### 3. Dynamic children

```ts
dynamicSource: {
  provider: string; // ADR-022 CollectionProvider key
  mode: "categories" | "tags" | "latest" | "featured";
  limit: number; // ≤ 8, enforced
}
```

Resolved server-side inside the cached `navigation` scope, **through the
provider**, so the content type's own visibility rule applies (for articles
that is `publicArticleWhere`, ADR-015) and premium items never reach a
logged-out menu. Dynamic children count toward the two-level depth limit and
may not themselves have children.

### 4. Panel references

`panelPartKey: String?` — when set, the item's dropdown renders the
`menu-panel:{slug}` PART (ADR-027) instead of a plain link list. Panels are
block layouts, which is how the reference design's News column becomes a
`collection` block rather than a menu feature.

### 5. Unchanged

`visibility`, `requiresFeature`, `requiresPermission`, translations,
ordering, `openInNewTab`, and `buildNavigation`'s pruning semantics
(including "a parent whose children are all pruned is itself pruned") are
untouched. The `navigation` cache tag and its invalidation on menu save are
unchanged.

## Consequences

- **Menu building now reads content.** `buildNavigation` gains provider
  reads for entity targets and dynamic children, inside the same cached
  scope, tagged `navigation` **and** `content` — so publishing an article
  can invalidate the nav. Acceptable because both tags already invalidate on
  the same admin actions; the cost is that a content publish re-renders the
  header. Measured in Module 14 alongside ADR-025's coarse-`content`
  decision, and the mitigation if it bites is to resolve entity hrefs from a
  narrow projection rather than the full provider.
- **A batching requirement appears.** Ten entity-targeted items must not be
  ten queries. Resolution collects targets by type and issues one read per
  type; a test asserts the query count for a mixed menu.
- **Pruning can empty a menu.** If every item points at unpublished content,
  the header renders an empty nav. The admin UI shows a resolved preview
  with pruned items marked, so this is visible before publish rather than
  after.
- **The exactly-one-of contract test is rewritten**, which touches shipped
  Module 08 tests. That is the intended kind of change (extending a contract
  with its test in the same PR), not incidental churn.
- **Dynamic children make the menu non-deterministic across locales and
  subjects.** Already true of `visibility` filtering; the nav truth-table
  test is extended with dynamic cases rather than a new mechanism.

## Alternatives considered

- **Keep `routeKey`/`url` only and let admins type paths.** Rejected: it
  makes every slug change a menu maintenance task and pushes 404s into the
  primary navigation.
- **Store the resolved href and refresh it on content save.** Rejected:
  denormalisation with an invalidation obligation on every publish path —
  the class of bug that outlives whoever wrote it.
- **Dynamic children as a separate "smart menu" model.** Rejected: it splits
  menu rendering into two code paths for one extra field.
- **Panels as menu-item JSON.** Rejected — ADR-027 §Alternatives: it cannot
  express a live collection, and it grows a second layout system.

## Compliance

- Contract test: the `linkType` × target matrix, every invalid combination
  rejected by `@repo/contracts`.
- Integration: change an article slug → the menu href updates with no menu
  edit and no redirect hop; unpublish it → the item is pruned.
- Leak probe: a `PREMIUM` course never appears in dynamic children for a
  logged-out subject (extends the ADR-012 flag-matrix test).
- Query-count test on a mixed menu (batching, no N+1).
- Icon allowlist test: an unknown preset icon name fails validation.
- Depth test: dynamic children may not nest; total depth stays ≤ 2.
