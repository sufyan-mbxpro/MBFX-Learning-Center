# ADR-183 — A deploy's seed never undoes an admin's edit

- **Status:** Accepted
- **Date:** 2026-10-03
- **Module:** 01 (db), 10 (users, roles), 14 (hardening)
- **Supersedes:** nothing. Narrows how `seed.ts` writes system roles and
  social links. ADR-016 (system roles editable in place) stands, and this is
  what makes it hold on a live install.

## Context

`scripts/deploy-release.sh` runs `pnpm db:seed` on every deploy, because a
release that adds a permission key or a setting needs its row before its code
serves. The seed is described as "idempotent, repairs drift without
clobbering admin edits", and that is true of settings (only metadata is
updated, never `value`). A review on 2026-10-03, done because the owner asked
that live production data survive every future update, found two places
where it was not true:

1. **System roles.** For each seeded role the seed ran
   `rolePermission.deleteMany` and re-granted the code's list, and it
   overwrote `name` and `description`. ADR-016 lets an admin change all three
   from the role editor. So every deploy silently reverted a role to the code's
   definition — a revoked permission came back, a granted one disappeared.
2. **Social links.** `url`, `handle` and `label` were overwritten with the
   seeded values, though Settings edits all three.

## Decision

1. **A system role's `name` and `description` are create-only.** `level` is
   still written: no screen can change it, so it remains the code's.
2. **Grants are diffed against a ledger, not against the role.** `Role` gains
   a nullable JSON column `seededPermissions`: the keys the seed granted last
   time. On each run the seed grants `code − ledger` (keys the code newly
   grants), revokes `ledger − code` (keys the code stopped granting), and
   writes the ledger. A key that is in both is not touched, so an admin's
   revocation or extra grant survives. The seed comment's promise — "removing
   a permission here actually revokes it" — still holds.
3. **An unledgered role (null) only gains what it is missing**, then is
   ledgered. That is the first deploy after this change on any install.
4. **Social links are create-only** (`update: {}`). A changed default URL
   reaches a live install through a migration, as any other change to data an
   admin owns would.
5. **The deploy dumps the database before it writes to it.**
   `deploy-release.sh` writes `~/backups/deploys/<release>.sql.gz` (single
   transaction, `MYSQL_PWD` rather than argv) before `db:deploy`, keeps the
   newest ten, and stops if the dump fails. `--rollback` switches code only;
   the dump is the way back from a bad migration or seed.

## Consequences

- A permission that an existing key should START granting to a system role
  reaches live by being added to `ROLES` — it is new to the ledger. A key the
  admin has deliberately revoked stays revoked unless the code drops and
  re-adds it.
- A migration that creates permission rows (ADR-177's did) still has its
  system-role grants applied by the next seed, because the ledger, not
  permission age, decides what is new.
- `db.integration.test.ts` asserts both edits survive a re-seed.
