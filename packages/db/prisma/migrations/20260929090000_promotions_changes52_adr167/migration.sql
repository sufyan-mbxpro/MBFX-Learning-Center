-- ADR-167 / changes-52 P1: promotions. Two new tables and one widened enum.
-- Purely additive: no existing row is read or changed, so it is safe to run on
-- an install with data. The status column holds only what a person decides;
-- Scheduled / Live / Ended are derived from the window when read (ADR-167 #2).
-- AlterTable
ALTER TABLE `content_references` MODIFY `sourceType` ENUM('PAGE_VERSION', 'MENU_ITEM', 'CARD_TEMPLATE', 'STYLE_PRESET', 'LAYOUT_TEMPLATE', 'ARTICLE', 'COURSE', 'BRAND', 'SETTING', 'VIDEO_TOPIC', 'QUIZ', 'GLOSSARY_TOPIC', 'PROMOTION') NOT NULL;

-- CreateTable
CREATE TABLE `promotions` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('WEBINAR', 'EVENT', 'OFFER', 'NEWS', 'ANNOUNCEMENT') NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `placements` JSON NOT NULL,
    `showAsPopup` BOOLEAN NOT NULL DEFAULT true,
    `showInBand` BOOLEAN NOT NULL DEFAULT false,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `eventStartsAt` DATETIME(3) NULL,
    `eventEndsAt` DATETIME(3) NULL,
    `frequency` ENUM('ONCE', 'PER_SESSION', 'DAILY', 'EVERY_VISIT') NOT NULL DEFAULT 'PER_SESSION',
    `delaySeconds` INTEGER NOT NULL DEFAULT 5,
    `audience` ENUM('ALL', 'GUESTS', 'LEARNERS') NOT NULL DEFAULT 'ALL',
    `untranslated` ENUM('HIDE', 'SHOW_DEFAULT') NOT NULL DEFAULT 'HIDE',
    `imageAssetId` VARCHAR(191) NULL,
    `linkKind` ENUM('CONTENT', 'PATH', 'EXTERNAL', 'NONE') NOT NULL DEFAULT 'NONE',
    `targetType` ENUM('COURSE', 'LESSON', 'QUIZ', 'ARTICLE', 'VIDEO_TOPIC', 'GLOSSARY_TERM', 'TOOL') NULL,
    `targetId` VARCHAR(64) NULL,
    `targetPath` VARCHAR(500) NULL,
    `targetUrl` VARCHAR(500) NULL,
    `recordingTopicId` VARCHAR(64) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `promotions_status_startsAt_endsAt_idx`(`status`, `startsAt`, `endsAt`),
    INDEX `promotions_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promotion_translations` (
    `id` VARCHAR(191) NOT NULL,
    `promotionId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `title` VARCHAR(160) NULL,
    `body` TEXT NULL,
    `badge` VARCHAR(40) NULL,
    `ctaLabel` VARCHAR(60) NULL,
    `imageAlt` VARCHAR(250) NULL,
    `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED', 'MACHINE_TRANSLATED') NOT NULL DEFAULT 'TRANSLATED',
    `sourceHash` VARCHAR(64) NULL,
    `translatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `promotion_translations_translationStatus_idx`(`translationStatus`),
    UNIQUE INDEX `promotion_translations_promotionId_locale_key`(`promotionId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `promotion_translations` ADD CONSTRAINT `promotion_translations_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `promotions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

