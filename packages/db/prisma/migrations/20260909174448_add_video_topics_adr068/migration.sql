-- AlterTable
ALTER TABLE `content_references` MODIFY `sourceType` ENUM('PAGE_VERSION', 'MENU_ITEM', 'CARD_TEMPLATE', 'STYLE_PRESET', 'LAYOUT_TEMPLATE', 'ARTICLE', 'COURSE', 'BRAND', 'SETTING', 'VIDEO_TOPIC') NOT NULL;

-- CreateTable
CREATE TABLE `video_categories` (
    `id` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `video_categories_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_category_translations` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(150) NOT NULL,
    `description` VARCHAR(500) NULL,
    `seoTitle` VARCHAR(70) NULL,
    `seoDescription` VARCHAR(180) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `video_category_translations_slug_idx`(`slug`),
    UNIQUE INDEX `video_category_translations_categoryId_locale_key`(`categoryId`, `locale`),
    UNIQUE INDEX `video_category_translations_locale_slug_key`(`locale`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_topics` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NULL,
    `track` VARCHAR(40) NOT NULL,
    `coverAssetId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'SEO_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `visibility` ENUM('PUBLIC', 'AUTHENTICATED', 'PREMIUM', 'ADMIN') NOT NULL DEFAULT 'PUBLIC',
    `authorId` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `video_topics_status_publishedAt_idx`(`status`, `publishedAt`),
    INDEX `video_topics_track_status_idx`(`track`, `status`),
    INDEX `video_topics_categoryId_sortOrder_idx`(`categoryId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_topic_translations` (
    `id` VARCHAR(191) NOT NULL,
    `topicId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `summary` TEXT NULL,
    `content` LONGTEXT NULL,
    `seoTitle` VARCHAR(70) NULL,
    `seoDescription` VARCHAR(180) NULL,
    `seoFocusKeyword` VARCHAR(100) NULL,
    `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED') NOT NULL DEFAULT 'DRAFT',
    `sourceHash` VARCHAR(64) NULL,
    `translatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `video_topic_translations_translationStatus_idx`(`translationStatus`),
    UNIQUE INDEX `video_topic_translations_topicId_locale_key`(`topicId`, `locale`),
    UNIQUE INDEX `video_topic_translations_locale_slug_key`(`locale`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_topic_videos` (
    `id` VARCHAR(191) NOT NULL,
    `topicId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `assetId` VARCHAR(191) NULL,
    `externalUrl` VARCHAR(500) NULL,
    `posterAssetId` VARCHAR(191) NULL,
    `title` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `video_topic_videos_topicId_sortOrder_idx`(`topicId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_topic_links` (
    `id` VARCHAR(191) NOT NULL,
    `topicId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `label` VARCHAR(200) NOT NULL,
    `path` VARCHAR(500) NULL,
    `url` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `video_topic_links_topicId_sortOrder_idx`(`topicId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `video_category_translations` ADD CONSTRAINT `video_category_translations_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `video_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_topics` ADD CONSTRAINT `video_topics_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `video_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_topic_translations` ADD CONSTRAINT `video_topic_translations_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `video_topics`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_topic_videos` ADD CONSTRAINT `video_topic_videos_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `video_topics`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_topic_links` ADD CONSTRAINT `video_topic_links_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `video_topics`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
