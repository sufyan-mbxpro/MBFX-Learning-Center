-- ADR-156: Google reCAPTCHA v3, configured in Settings → General. One row.
-- CreateTable
CREATE TABLE `captcha_config` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `siteKey` VARCHAR(100) NULL,
    `secretKeyCipher` TEXT NULL,
    `minScore` DOUBLE NOT NULL DEFAULT 0.5,
    `lastVerifiedAt` DATETIME(3) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
