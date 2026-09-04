-- CreateTable
CREATE TABLE `article_categories` (
    `id` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `article_categories_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `article_category_translations` (
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

    INDEX `article_category_translations_slug_idx`(`slug`),
    UNIQUE INDEX `article_category_translations_categoryId_locale_key`(`categoryId`, `locale`),
    UNIQUE INDEX `article_category_translations_locale_slug_key`(`locale`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `article_tags` (
    `id` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `article_tag_translations` (
    `id` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(150) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `article_tag_translations_slug_idx`(`slug`),
    UNIQUE INDEX `article_tag_translations_tagId_locale_key`(`tagId`, `locale`),
    UNIQUE INDEX `article_tag_translations_locale_slug_key`(`locale`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `articles` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('NEWS', 'ANALYSIS', 'TRADE_IDEA') NOT NULL DEFAULT 'NEWS',
    `status` ENUM('DRAFT', 'IN_REVIEW', 'SEO_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isPremium` BOOLEAN NOT NULL DEFAULT false,
    `coverImageUrl` VARCHAR(500) NULL,
    `videoUrl` VARCHAR(500) NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NULL,
    `source` VARCHAR(150) NULL,
    `sourceUrl` VARCHAR(500) NULL,
    `scheduledFor` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `articles_kind_status_publishedAt_idx`(`kind`, `status`, `publishedAt`),
    INDEX `articles_status_scheduledFor_idx`(`status`, `scheduledFor`),
    INDEX `articles_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `article_translations` (
    `id` VARCHAR(191) NOT NULL,
    `articleId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `excerpt` VARCHAR(500) NULL,
    `body` LONGTEXT NULL,
    `seoTitle` VARCHAR(70) NULL,
    `seoDescription` VARCHAR(180) NULL,
    `ogImageUrl` VARCHAR(500) NULL,
    `canonicalUrl` VARCHAR(500) NULL,
    `noIndex` BOOLEAN NOT NULL DEFAULT false,
    `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED') NOT NULL DEFAULT 'DRAFT',
    `sourceHash` VARCHAR(64) NULL,
    `translatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `article_translations_slug_idx`(`slug`),
    UNIQUE INDEX `article_translations_articleId_locale_key`(`articleId`, `locale`),
    UNIQUE INDEX `article_translations_locale_slug_key`(`locale`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `article_tag_assignments` (
    `articleId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `article_tag_assignments_tagId_idx`(`tagId`),
    PRIMARY KEY (`articleId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- (Hand-trimmed: `migrate dev` again bundled spurious CREATE INDEX statements
-- for account/session/twoFactor userId indexes the init migration already
-- creates inline — the known Prisma 7/MariaDB prefix-length diff
-- false-positive; see DEVLOG 2026-09-02 / add_notifications migration.)

-- AddForeignKey
ALTER TABLE `article_category_translations` ADD CONSTRAINT `article_category_translations_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `article_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `article_tag_translations` ADD CONSTRAINT `article_tag_translations_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `article_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `articles` ADD CONSTRAINT `articles_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `article_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `article_translations` ADD CONSTRAINT `article_translations_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `article_tag_assignments` ADD CONSTRAINT `article_tag_assignments_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `article_tag_assignments` ADD CONSTRAINT `article_tag_assignments_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `article_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
