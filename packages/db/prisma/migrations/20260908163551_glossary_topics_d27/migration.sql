/*
  Warnings:

  - You are about to drop the column `category` on the `glossary_terms` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `glossary_terms_category_idx` ON `glossary_terms`;

-- AlterTable
ALTER TABLE `glossary_terms` DROP COLUMN `category`,
    ADD COLUMN `topicId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `glossary_topics` (
    `id` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `glossary_topics_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `glossary_topic_translations` (
    `id` VARCHAR(191) NOT NULL,
    `topicId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(150) NOT NULL,
    `description` VARCHAR(500) NULL,
    `seoTitle` VARCHAR(70) NULL,
    `seoDescription` VARCHAR(180) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `glossary_topic_translations_slug_idx`(`slug`),
    UNIQUE INDEX `glossary_topic_translations_topicId_locale_key`(`topicId`, `locale`),
    UNIQUE INDEX `glossary_topic_translations_locale_slug_key`(`locale`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `glossary_terms_topicId_idx` ON `glossary_terms`(`topicId`);

-- AddForeignKey
ALTER TABLE `glossary_terms` ADD CONSTRAINT `glossary_terms_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `glossary_topics`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `glossary_topic_translations` ADD CONSTRAINT `glossary_topic_translations_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `glossary_topics`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
