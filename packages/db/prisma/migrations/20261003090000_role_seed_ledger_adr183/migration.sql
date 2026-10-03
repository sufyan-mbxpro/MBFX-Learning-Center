-- ADR-183: a ledger of the permission keys the seed last granted each system
-- role, so a deploy's seed adds or revokes only what the CODE changed and
-- never undoes an admin's edit to the role (ADR-016 made them editable).
--
-- Additive and nullable: the release still serving while this applies never
-- reads it. Null means "not yet ledgered" — the next seed treats the role's
-- current grants as the admin's and only adds keys it is missing.
ALTER TABLE `roles` ADD COLUMN `seededPermissions` JSON NULL;
