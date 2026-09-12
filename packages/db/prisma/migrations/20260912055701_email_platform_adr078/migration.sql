-- CreateTable
CREATE TABLE `email_transport` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `driver` ENUM('SMTP', 'LOG') NOT NULL DEFAULT 'LOG',
    `host` VARCHAR(255) NULL,
    `port` INTEGER NULL,
    `security` ENUM('NONE', 'STARTTLS', 'TLS') NOT NULL DEFAULT 'STARTTLS',
    `username` VARCHAR(255) NULL,
    `passwordCipher` TEXT NULL,
    `lastVerifiedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_templates` (
    `key` VARCHAR(60) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `fromName` VARCHAR(120) NULL,
    `fromEmail` VARCHAR(255) NULL,
    `replyTo` VARCHAR(255) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_template_translations` (
    `id` VARCHAR(191) NOT NULL,
    `templateKey` VARCHAR(60) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `preheader` VARCHAR(200) NULL,
    `mode` ENUM('RICH', 'HTML') NOT NULL DEFAULT 'RICH',
    `bodyHtml` MEDIUMTEXT NOT NULL,
    `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED') NOT NULL DEFAULT 'DRAFT',
    `sourceHash` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_template_translations_templateKey_locale_key`(`templateKey`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `templateKey` VARCHAR(60) NOT NULL,
    `to` VARCHAR(255) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `status` ENUM('SENT', 'FAILED', 'SUPPRESSED') NOT NULL,
    `reason` VARCHAR(500) NULL,
    `providerMessageId` VARCHAR(255) NULL,
    `isTest` BOOLEAN NOT NULL DEFAULT false,
    `triggeredBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_deliveries_createdAt_idx`(`createdAt`),
    INDEX `email_deliveries_templateKey_createdAt_idx`(`templateKey`, `createdAt`),
    INDEX `email_deliveries_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_template_translations` ADD CONSTRAINT `email_template_translations_templateKey_fkey` FOREIGN KEY (`templateKey`) REFERENCES `email_templates`(`key`) ON DELETE CASCADE ON UPDATE CASCADE;
