# SKILL — Module 08: Navigation & header/footer runtime

plan.md Module 08 + A6 header/footer rows. This module is the architecture's
proof-of-concept demo: admin reorders a menu item → public header reflects it
without redeploy.

## buildNavigation (in @repo/core)

`buildNavigation(menuKey, locale, subject|null)`: reads the menu tree
(cached, tag `navigation` — frozen), filters `isActive` → `visibility` →
`requiresFeature` (flags) → `requiresPermission` (staff menus), resolves
translations with the fallback chain, resolves exactly-one of
`routeKey`/`url` (contract-validated). Parent whose children are all pruned
is itself pruned. Max depth 2 (rule + validation).

## Header (public surface)

Logo per mode from `BrandAsset`; main menu with 2-level dropdowns; locale
switcher; theme-mode toggle (USER-controlled — ADR-008, never admin-gated);
auth-state slot; admin-configured CTA (label key + route/URL + visibility);
optional dismissible announcement bar; sticky on/off from settings.

## Footer

Admin-ordered footer menus as columns; active `SocialLink` set in sortOrder;
translatable copyright with `{year}` token; risk-disclaimer legal setting
rendered site-wide (forex compliance).

## Required tests

Nav builder truth table (inactive/flag-off/permission pruning, empty-parent
pruning); label fallback; exactly-one url/routeKey contract test; **E2E
round-trip: admin reorder → public header updates via tag invalidation, no
deploy**; axe on header nav; keyboard-operable dropdowns; `aria-current` on
the active item.
