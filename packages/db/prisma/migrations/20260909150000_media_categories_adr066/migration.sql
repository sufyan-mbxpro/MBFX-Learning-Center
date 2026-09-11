-- ADR-066: a media category is the first segment of `folder`, and ADR-067's
-- paged browsing needs an index shaped like the query it actually runs.
--
-- The old default `"/"` is no longer a legal folder: the first segment must
-- name a registered category. Pre-launch policy is reset, not backfill
-- (plan §5.2), so this statement changes the default for future rows and the
-- one UPDATE below exists purely so a developer's throwaway dev database
-- does not sit at a value the schema refuses. It is not a migration
-- strategy; `pnpm db:reset` is.
ALTER TABLE `media_assets` ALTER COLUMN `folder` SET DEFAULT '/general';
UPDATE `media_assets` SET `folder` = '/general' WHERE `folder` = '/';

-- The dominant query became: folder prefix -> kind -> newest first. ADR-034's
-- pair had the columns the right way round for a kind-first library that no
-- longer exists.
DROP INDEX `media_assets_kind_folder_idx` ON `media_assets`;
CREATE INDEX `media_assets_folder_kind_createdAt_idx` ON `media_assets`(`folder`, `kind`, `createdAt`);

-- The soft-delete filter every list read carries.
CREATE INDEX `media_assets_deletedAt_createdAt_idx` ON `media_assets`(`deletedAt`, `createdAt`);
