-- ADR-160: Google Cloud Translation Basic (v2), the automatic translator.
-- The provider singleton (its key sealed, security.md #10's fifth exception),
-- one usage row per request, and the budget month. Nothing existing changes.
-- CreateTable
CREATE TABLE `translate_provider` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `apiKeyCipher` TEXT NULL,
    `pricePerMillionChars` DECIMAL(12, 6) NOT NULL DEFAULT 20,
    `monthlyCharBudget` INTEGER NULL,
    `lastTestedAt` DATETIME(3) NULL,
    `lastTestResult` VARCHAR(40) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `translate_usage` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('OK', 'FAILED', 'REFUSED') NOT NULL,
    `reason` VARCHAR(40) NULL,
    `sourceLocale` VARCHAR(10) NOT NULL,
    `targetLocale` VARCHAR(10) NOT NULL,
    `format` ENUM('TEXT', 'HTML') NOT NULL,
    `segments` INTEGER NOT NULL DEFAULT 0,
    `characters` INTEGER NOT NULL DEFAULT 0,
    `costUsd` DECIMAL(12, 6) NOT NULL DEFAULT 0,
    `durationMs` INTEGER NOT NULL DEFAULT 0,
    `userId` VARCHAR(191) NULL,
    `entityType` VARCHAR(40) NULL,
    `entityId` VARCHAR(40) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `translate_usage_createdAt_idx`(`createdAt`),
    INDEX `translate_usage_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `translate_usage_periods` (
    `period` VARCHAR(7) NOT NULL,
    `characters` BIGINT NOT NULL DEFAULT 0,
    `costUsd` DECIMAL(14, 6) NOT NULL DEFAULT 0,
    `requests` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`period`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

