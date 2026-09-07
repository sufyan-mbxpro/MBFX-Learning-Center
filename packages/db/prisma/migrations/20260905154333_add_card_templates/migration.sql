-- ADR-023: CardTemplate, referenced by id from `collection`/
-- `featured-content` blocks (Phase 4, PR 4.3).
--
-- This migration was hand-trimmed. `prisma migrate dev` diffs the ENTIRE
-- schema against migration history, and this repo has a pre-existing,
-- already-documented gap: the `Comment` model (ADR-019) and three
-- `account`/`session`/`twoFactor` `userId` indexes are committed to
-- schema.prisma but were never captured in any migration (see DEVLOG
-- 2026-09-05 PR 3.1/3.2/ADR-035's migration for the previous times this
-- bundled the same drift into an unrelated migration). Removed here again,
-- unchanged from those entries' reasoning — not this migration's job to fix.

-- CreateTable
CREATE TABLE `card_templates` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `contentType` VARCHAR(60) NULL,
    `variant` VARCHAR(60) NOT NULL,
    `config` JSON NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `previewImageId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `card_templates_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
