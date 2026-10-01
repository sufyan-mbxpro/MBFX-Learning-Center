-- ADR-161 #7/#8 and ADR-162: status and source hash on every translatable
-- table, the two child-label maps, and the translation job queue.
--
-- Additive only. A new status column defaults to TRANSLATED: every existing
-- row was written by a person or the seed. sourceHash is left NULL on purpose,
-- never backfilled from today's source, because NULL means "unknown" and a
-- backfilled hash would mark a stale translation current (ADR-161 #4).

-- AlterTable
ALTER TABLE `menu_item_translations` ADD COLUMN `sourceHash` VARCHAR(64) NULL,
    ADD COLUMN `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED', 'MACHINE_TRANSLATED') NOT NULL DEFAULT 'TRANSLATED';

-- AlterTable
ALTER TABLE `course_translations` ADD COLUMN `sourceHash` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `course_section_translations` ADD COLUMN `sourceHash` VARCHAR(64) NULL,
    ADD COLUMN `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED', 'MACHINE_TRANSLATED') NOT NULL DEFAULT 'TRANSLATED';

-- AlterTable
ALTER TABLE `lesson_translations` ADD COLUMN `attachmentLabels` JSON NULL;

-- AlterTable
ALTER TABLE `quiz_question_translations` ADD COLUMN `sourceHash` VARCHAR(64) NULL,
    ADD COLUMN `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED', 'MACHINE_TRANSLATED') NOT NULL DEFAULT 'TRANSLATED';

-- AlterTable
ALTER TABLE `glossary_topic_translations` ADD COLUMN `sourceHash` VARCHAR(64) NULL,
    ADD COLUMN `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED', 'MACHINE_TRANSLATED') NOT NULL DEFAULT 'TRANSLATED';

-- AlterTable
ALTER TABLE `video_category_translations` ADD COLUMN `sourceHash` VARCHAR(64) NULL,
    ADD COLUMN `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED', 'MACHINE_TRANSLATED') NOT NULL DEFAULT 'TRANSLATED';

-- AlterTable
ALTER TABLE `video_topic_translations` ADD COLUMN `linkLabels` JSON NULL;

-- AlterTable
ALTER TABLE `article_category_translations` ADD COLUMN `sourceHash` VARCHAR(64) NULL,
    ADD COLUMN `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED', 'MACHINE_TRANSLATED') NOT NULL DEFAULT 'TRANSLATED';

-- AlterTable
ALTER TABLE `article_tag_translations` ADD COLUMN `sourceHash` VARCHAR(64) NULL,
    ADD COLUMN `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED', 'MACHINE_TRANSLATED') NOT NULL DEFAULT 'TRANSLATED';

-- CreateTable
CREATE TABLE `translation_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('ITEM', 'BACKFILL_LOCALE') NOT NULL,
    `entityType` VARCHAR(40) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'DONE', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `runAfter` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `claimToken` VARCHAR(40) NULL,
    `claimedAt` DATETIME(3) NULL,
    `cursor` VARCHAR(200) NULL,
    `lastError` VARCHAR(40) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `translation_jobs_status_runAfter_idx`(`status`, `runAfter`),
    INDEX `translation_jobs_claimToken_idx`(`claimToken`),
    INDEX `translation_jobs_locale_status_idx`(`locale`, `status`),
    UNIQUE INDEX `translation_jobs_kind_entityType_entityId_locale_key`(`kind`, `entityType`, `entityId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

