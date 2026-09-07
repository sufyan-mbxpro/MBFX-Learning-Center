-- CreateTable
CREATE TABLE `pages` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(80) NULL,
    `kind` ENUM('STATIC', 'COLLECTION', 'DETAIL', 'DATA') NOT NULL DEFAULT 'STATIC',
    `contentType` VARCHAR(60) NULL,
    `dataProvider` VARCHAR(60) NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'SEO_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `visibility` ENUM('PUBLIC', 'AUTHENTICATED', 'PREMIUM', 'ADMIN') NOT NULL DEFAULT 'PUBLIC',
    `requiresFeature` VARCHAR(80) NULL,
    `publishedVersionId` VARCHAR(191) NULL,
    `draftVersionId` VARCHAR(191) NULL,
    `parentId` VARCHAR(191) NULL,
    `group` VARCHAR(80) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pages_key_key`(`key`),
    UNIQUE INDEX `pages_publishedVersionId_key`(`publishedVersionId`),
    UNIQUE INDEX `pages_draftVersionId_key`(`draftVersionId`),
    INDEX `pages_kind_status_idx`(`kind`, `status`),
    INDEX `pages_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `page_translations` (
    `id` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `path` VARCHAR(500) NOT NULL,
    `status` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED') NOT NULL DEFAULT 'DRAFT',
    `seoTitle` VARCHAR(70) NULL,
    `seoDescription` VARCHAR(180) NULL,
    `ogImageId` VARCHAR(191) NULL,
    `canonicalUrl` VARCHAR(500) NULL,
    `robots` VARCHAR(40) NULL DEFAULT 'index,follow',
    `includeInSitemap` BOOLEAN NOT NULL DEFAULT true,
    `schemaType` VARCHAR(40) NULL DEFAULT 'WebPage',
    `sourceHash` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `page_translations_locale_slug_idx`(`locale`, `slug`),
    UNIQUE INDEX `page_translations_pageId_locale_key`(`pageId`, `locale`),
    UNIQUE INDEX `page_translations_locale_path_key`(`locale`, `path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `page_versions` (
    `id` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `layout` JSON NOT NULL,
    `note` VARCHAR(500) NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `gateResult` JSON NULL,
    `templateKey` VARCHAR(80) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `page_versions_pageId_number_key`(`pageId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_references` (
    `id` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('PAGE_VERSION', 'MENU_ITEM', 'CARD_TEMPLATE', 'STYLE_PRESET', 'LAYOUT_TEMPLATE', 'ARTICLE', 'COURSE', 'BRAND', 'SETTING') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `refType` ENUM('MEDIA', 'CARD_TEMPLATE', 'STYLE_PRESET', 'WIDGET', 'PART', 'PAGE', 'ARTICLE', 'ARTICLE_CATEGORY', 'ARTICLE_TAG', 'COURSE', 'GLOSSARY_TERM') NOT NULL,
    `refId` VARCHAR(191) NOT NULL,
    `field` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `content_references_refType_refId_idx`(`refType`, `refId`),
    UNIQUE INDEX `content_references_sourceType_sourceId_refType_refId_field_key`(`sourceType`, `sourceId`, `refType`, `refId`, `field`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pages` ADD CONSTRAINT `pages_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `pages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `page_translations` ADD CONSTRAINT `page_translations_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `page_versions` ADD CONSTRAINT `page_versions_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants the Phase 1 services rely on (plan v2.2 §5.1 / ADR-032 §6),
-- established in the database rather than assumed by application code.
-- Prisma cannot express CHECK constraints, so they live here and are held
-- in place by packages/db/src/db.integration.test.ts.
-- (No CHECK on `pages.parentId <> id`: MariaDB refuses CHECK constraints on
-- a column governed by a FK referential action — error 1901 — so the whole
-- cycle guard, self-parent included, is the service's job: plan §5.1 rule 5.)
ALTER TABLE `page_translations` ADD CONSTRAINT `page_translations_path_absolute_chk` CHECK (`path` LIKE '/%');
ALTER TABLE `page_versions` ADD CONSTRAINT `page_versions_number_nonnegative_chk` CHECK (`number` >= 0);
ALTER TABLE `page_versions` ADD CONSTRAINT `page_versions_revision_nonnegative_chk` CHECK (`revision` >= 0);
