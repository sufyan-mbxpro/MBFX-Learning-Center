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

- [x] `@repo/contracts`: Zod schema per setting key (`SETTINGS_SCHEMAS`) +
      `SETTING_GROUPS` map (`packages/contracts/src/settings.ts`).
- [x] `@repo/settings`: typed reader (`loadSetting`/`getSetting`,
      `loadPublicSettings`/`getPublicSettings`), writer (`updateSetting`),
      feature-flag reader + evaluator (`loadFeatureFlag`/`getFeatureFlag`,
      `evaluateVisibility`/`isFlagVisible`/`isFeatureVisible`).
- [x] `isPublic` enforced structurally: `loadPublicSettings` scopes
      `isPublic: true` in the Prisma query itself, not a post-hoc filter —
      proved by the leak test in `settings.integration.test.ts`. A
      file-glob lint rule is deferred: no `app/(public)` page exists yet to
      target (Module 12), matching architecture.md #5's own admin/public
      import-boundary deferral for the same reason. Revisit when Module 12
      lands.
- [x] 80% coverage floor met (`packages/settings/vitest.config.ts` — 100%
      stmts/funcs/lines, 85.7% branches).
- [x] ADR-012: `PREMIUM` visibility defaults to staff-only until an
      entitlement model exists.
- [ ] Server Action wiring (`requirePermission("settings.update")` →
      `updateSetting()` → `recordAudit()`) — the package exposes each piece
      (`@repo/settings`, `@repo/rbac`, `@repo/core`) and
      `settings.integration.test.ts` proves the composition works
      end-to-end, but the actual Next.js Server Action lands with the admin
      settings screen (Module 09).

## Registry

Reader/writer live in `packages/settings/src/index.ts`. Schema + group map
live in `packages/contracts/src/settings.ts` (`SETTINGS_SCHEMAS`,
`SETTING_GROUPS`) — 23 keys across four groups (`general`, `seo`, `layout`,
`legal`), matching `packages/db/prisma/seed.ts`'s `SETTINGS` array exactly.
Adding a setting means updating three places by hand: the seed row, the Zod
schema, and the group map — `SETTING_GROUPS` registry-completeness test in
`packages/settings/src/index.test.ts` fails loudly if the schema and group
map drift apart from each other (it does not check the seed file itself).

Feature flags: `packages/db/prisma/schema.prisma`'s `FeatureFlag` model,
seeded via `FEATURE_FLAGS` in `seed.ts` (16 keys). No typed registry the way
settings has one — a flag's `key` is just a string; `isFeatureVisible(key,
subject)` returns `false` for an unseeded key rather than throwing, since
it's called from render paths (navigation, page guards) where a typo
should silently hide a feature, not 500 the page.

Cache tags: `settings:{group}` (architecture.md #12, frozen) for settings;
`feature-flags` (not in the original frozen list — minted here, single tag
for all flags since there's no per-group flag read path yet) for flags.
