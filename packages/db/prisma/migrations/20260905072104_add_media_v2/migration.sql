-- ADR-034: MediaAsset gains kind/title/altText/folder/tags/durationMs/
-- posterAssetId/version/deletedAt; existing rows backfill via column
-- defaults (kind=IMAGE, folder="/") per plan §5.2's "reset over backfill"
-- pre-launch policy.
--
-- NOTE (unchanged from the PR 3.1 migration): `prisma migrate dev`'s
-- auto-generated diff for this change again included `CREATE TABLE
-- comments` and the `account`/`session`/`twoFactor` `userId` indexes —
-- all already in the committed schema.prisma with no migration ever
-- capturing them (ADR-019 drift, flagged in DEVLOG since the Phase 1
-- close-out). Removed from this file for the same reason as before: this
-- PR only does what this PR needs.

-- AlterTable
ALTER TABLE `media_assets` ADD COLUMN `altText` VARCHAR(500) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `durationMs` INTEGER NULL,
    ADD COLUMN `folder` VARCHAR(300) NOT NULL DEFAULT '/',
    ADD COLUMN `kind` ENUM('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT') NOT NULL DEFAULT 'IMAGE',
    ADD COLUMN `posterAssetId` VARCHAR(191) NULL,
    ADD COLUMN `tags` JSON NULL,
    ADD COLUMN `title` VARCHAR(200) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX `media_assets_kind_folder_idx` ON `media_assets`(`kind`, `folder`);
