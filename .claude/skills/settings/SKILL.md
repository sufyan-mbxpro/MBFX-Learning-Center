# SKILL — Module 05: @repo/settings + feature flags

plan.md Module 05 + architecture doc §3. Cache per ADR-004, tags
`settings:{group}` (frozen).

## Requirements

- Typed reader: `getPublicSettings(group)` / `getSetting(key)`, cached with
  `"use cache"` + `cacheTag`. Writes via server action guarded by
  `settings.update`, writing audit rows and revalidating the group tag.
- Zod schema per setting key in `@repo/contracts` — a value is validated
  against its declared type (no number into an image slot).
- **`isPublic` strictly enforced:** non-public settings never serialize to
  client components. Lint rule + RSC-payload leak test.
- Feature flags: `{enabled, visibility: public|authenticated|premium|admin}`;
  `isFeatureVisible(key, subject|null)`; disabled features 404 (not blank)
  via route guards; flags feed navigation building (Module 08).
- Seeded keys must cover plan A6 additions: header settings (logo variant per
  mode, CTA, sticky, announcement bar), footer settings (column layout,
  copyright with `{year}`, risk disclaimer as translatable `legal` setting,
  newsletter toggle), homepage/layout section config.
- Secrets never in settings — env vars referenced by name.

## Required tests

Typed reads + defaults for missing keys; write → read-after-invalidate
consistency; **isPublic leak test** (server-render harness asserts admin-only
keys absent from public RSC payload); flag matrix truth table
(enabled × visibility × subject); audit row on every write. 80% floor.

## DoD

Settings registry documented here (replace this stub section with the real
registry when implementing).
