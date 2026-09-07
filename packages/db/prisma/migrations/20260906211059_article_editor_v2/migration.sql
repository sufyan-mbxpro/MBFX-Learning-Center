-- changes-07 PR 2 (article editor v2).
--
-- Also lands the design-only `comments` table (ADR-019): the model has been
-- in schema.prisma since ADR-019 without a migration, so every diff since has
-- wanted to create it. Creating the empty table makes the migration history
-- match the schema again; it does not build the feature (no service or route
-- reads or writes it, exactly as ADR-019 states).
--
-- Three phantom CREATE INDEX statements for account/session/twoFactor were
-- REMOVED from the generated output by hand: init already creates them inline
-- with a (191) prefix length, which Prisma does not recognise as matching
-- @@index([userId]), so it re-emits them on every diff and they fail as
-- duplicates. See this PR DEVLOG entry.

-- AlterTable
ALTER TABLE `article_translations` ADD COLUMN `focusKeywords` VARCHAR(300) NULL,
    ADD COLUMN `noFollow` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `ogDescription` VARCHAR(300) NULL,
    ADD COLUMN `ogTitle` VARCHAR(120) NULL,
    ADD COLUMN `twitterCard` VARCHAR(20) NULL,
    ADD COLUMN `twitterImageAssetId` VARCHAR(191) NULL,
    ADD COLUMN `twitterImageUrl` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `articles` ADD COLUMN `headerImageAssetId` VARCHAR(191) NULL,
    ADD COLUMN `headerImageUrl` VARCHAR(500) NULL,
    ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `relatedCount` INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN `showRelated` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `article_faq_items` (
    `id` VARCHAR(191) NOT NULL,
    `translationId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `question` VARCHAR(300) NOT NULL,
    `answer` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `article_faq_items_translationId_sortOrder_idx`(`translationId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comments` (
    `id` VARCHAR(191) NOT NULL,
    `articleId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `body` VARCHAR(2000) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `comments_articleId_status_createdAt_idx`(`articleId`, `status`, `createdAt`),
    INDEX `comments_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `articles_isFeatured_status_publishedAt_idx` ON `articles`(`isFeatured`, `status`, `publishedAt`);

-- AddForeignKey
ALTER TABLE `article_faq_items` ADD CONSTRAINT `article_faq_items_translationId_fkey` FOREIGN KEY (`translationId`) REFERENCES `article_translations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
