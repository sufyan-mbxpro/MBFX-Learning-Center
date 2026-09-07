-- ADR-033: StylePreset (linked) + LayoutTemplate (start-from) + ContentReference
-- already existed from Phase 1. This migration adds only the two new
-- tables Phase 3 PR 3.1 introduces.
--
-- NOTE for whoever resolves the ADR-019 Comment/index drift (flagged
-- pre-existing in DEVLOG, Module 16 Phase 1 close-out and again in this
-- entry): `prisma migrate dev`'s auto-generated diff for this change also
-- included `CREATE TABLE comments`, three `account`/`session`/`twoFactor`
-- `userId` indexes, and the `comments` foreign keys — all already present
-- in the committed schema.prisma with no migration ever capturing them.
-- Those statements were deliberately removed from this file so this PR's
-- migration only does what this PR needs; the drift itself is untouched
-- and still needs its own migration from whoever owns that fix.

-- CreateTable
CREATE TABLE `style_presets` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `scope` VARCHAR(60) NOT NULL DEFAULT 'any',
    `config` JSON NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `style_presets_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `layout_templates` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `kind` ENUM('PAGE', 'SECTION', 'BLOCK', 'PART') NOT NULL,
    `pageKind` ENUM('STATIC', 'COLLECTION', 'DETAIL', 'DATA') NULL,
    `partKey` VARCHAR(60) NULL,
    `layout` JSON NOT NULL,
    `previewImageId` VARCHAR(191) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `layout_templates_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
