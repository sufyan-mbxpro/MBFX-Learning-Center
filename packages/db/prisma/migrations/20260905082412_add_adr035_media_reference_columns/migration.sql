-- ADR-035: MediaAsset reference columns so deleteMedia's usage guard can
-- see Article/BrandAsset usage (syncReferences wiring), closing an ADR-034
-- compliance gap PR 3.2 shipped without.
--
-- This migration was hand-trimmed. `prisma migrate dev` diffs the ENTIRE
-- schema against migration history, and this repo has a pre-existing,
-- already-documented gap: the `Comment` model (ADR-019) and three
-- `account`/`session`/`twoFactor` `userId` indexes are committed to
-- schema.prisma but were never captured in any migration (see DEVLOG
-- 2026-09-05 PR 3.1 and PR 3.2 for the first two times this bundled the
-- same drift into an unrelated migration). Removed here again, unchanged
-- from those entries' reasoning — not this migration's job to fix.

-- AlterTable
ALTER TABLE `article_translations` ADD COLUMN `ogImageAssetId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `articles` ADD COLUMN `coverImageAssetId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `brand_assets` ADD COLUMN `mediaAssetId` VARCHAR(191) NULL;
