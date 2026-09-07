# SKILL — Module 12: Public site

> **Homepage admin UI paused (ADR-038, 2026-09-06).** `/admin/homepage`
> (the section order/enable/variant editor) is hidden pending the owner's
> move to module-by-module/static site design. The homepage still renders
> from the current `home.sections` value — read ADR-038 before resuming
> the admin screen.

plan.md Module 12. Everything lives under `app/(public)/[locale]/` (ADR-006).
This is the surface judged on Core Web Vitals — the bundle-boundary and
Lighthouse rules exist for it.

## Requirements

- Homepage assembled from admin-configured sections (registry: hero,
  featured courses, latest analysis, market ticker, CTA — order/visibility
  from `layout` settings).
- Learn area: course → module → lesson with prerequisites. Glossary: A–Z,
  categories, per-locale slugs. Static pages from the `Page` model.
- SEO: metadata from settings + per-translation fields; `sitemap.ts` per
  locale from published content; `robots.ts`; canonical + hreflang pairs;
  JSON-LD for courses/articles.
- ISR with cache tags per the caching table; disabled features 404, never
  blank.
- Dark/light toggle is user-controlled and persists (next-themes +
  User.themeMode for signed-in users) — ADR-008.
- Core Web Vitals budget: LCP < 2.5s on the lesson page, enforced by a
  Lighthouse CI budget file — **blocking** (it is also the admin-bundle-leak
  backstop under the single app).

## Required tests

E2E journeys (browse course → lesson; glossary search; locale switch
preserving route where translated / fallback notice where not; dark-mode
persists across reload); hreflang/sitemap snapshot; disabled-feature 404;
Lighthouse budgets blocking; full axe + RTL suites from Part C.
