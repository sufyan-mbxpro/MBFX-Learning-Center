# SKILL — Module 01: @repo/db (schema, migrations, seed)

Reference: `docs/reference/schema.prisma`, `docs/reference/seed.ts`,
plan.md A4/A5.4 + Module 01. ADR-002 locks Prisma 7.10.x.

## Prisma 7 shape (breaking vs the reference files)

- Generator `prisma-client` (NOT `prisma-client-js`) with required custom
  `output` → `src/generated/client`. All repo imports go through the
  `@repo/db` singleton re-export — never `@prisma/client`.
- `prisma.config.ts` owns env loading + seed config (the package.json
  `"prisma"` block is gone).
- Driver adapter `@prisma/adapter-mariadb`.
- **Remove `relationMode = "prisma"`** — real FKs on self-hosted MariaDB.
  This is a bug-class fix, not a preference.

## Porting rules

- Drop `Theme.allowUserToggle` (A5.4, ADR-008): dark/light is user-controlled.
- Auth tables come from Better Auth CLI generation (Module 04 owns
  generation; this module owns the merge of project fields as
  additionalFields: userType, status, locale, timezone, themeMode, lockout,
  deletedAt).
- Everything else ports as-is: RBAC, Employee, Settings, FeatureFlag,
  SocialLink, Theme, BrandAsset, Locale, Menu*, Course/Module/Lesson/Glossary
  - translations, ContentRelation, AuditLog, Redirect.
- Translation-table pattern: base row = locale-invariant; slugs are
  per-locale on translations; `(locale, slug)` unique.
- Soft delete via `deletedAt`; every query path excludes it by convention.

## Seed discipline

Idempotent upserts on business keys. Re-runnable against a dirty DB without
clobbering admin edits: `create`-only for admin-editable values
(Setting.value); labels/types may update on reseed, values never. Admin user
from `SEED_ADMIN_*`; fail loudly if password empty in dev; omit in prod.

## Required tests (Vitest + Testcontainers MariaDB)

Migrations from zero; seed idempotency (run twice → identical counts,
admin-edited Setting.value survives); FK cascade + SetNull behavior; unique
`(locale, slug)` collision rejected; soft-delete exclusion fixtures.

## DoD

`pnpm db:reset && pnpm db:seed && pnpm db:seed` green; ERD committed to docs.
