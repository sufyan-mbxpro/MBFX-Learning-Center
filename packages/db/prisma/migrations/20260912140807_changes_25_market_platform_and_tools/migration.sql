-- CreateTable
CREATE TABLE `market_providers` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `driver` ENUM('ALPHAVANTAGE', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `baseUrl` VARCHAR(255) NULL,
    `apiKeyCipher` TEXT NULL,
    `refreshSeconds` INTEGER NOT NULL DEFAULT 300,
    `staleSeconds` INTEGER NOT NULL DEFAULT 86400,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `lastSyncAt` DATETIME(3) NULL,
    `lastSyncError` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `market_instruments` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('CURRENCY', 'PAIR', 'CRYPTO', 'METAL', 'INDEX', 'COMMODITY') NOT NULL,
    `symbol` VARCHAR(20) NOT NULL,
    `displayName` VARCHAR(80) NOT NULL,
    `base` VARCHAR(10) NULL,
    `quote` VARCHAR(10) NULL,
    `providerSymbol` VARCHAR(40) NULL,
    `pipSize` DECIMAL(18, 10) NULL,
    `decimals` INTEGER NOT NULL DEFAULT 5,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `market_instruments_kind_isActive_sortOrder_idx`(`kind`, `isActive`, `sortOrder`),
    UNIQUE INDEX `market_instruments_symbol_key`(`symbol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `market_daily_bars` (
    `id` VARCHAR(191) NOT NULL,
    `instrumentId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `open` DECIMAL(24, 10) NOT NULL,
    `high` DECIMAL(24, 10) NOT NULL,
    `low` DECIMAL(24, 10) NOT NULL,
    `close` DECIMAL(24, 10) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `market_daily_bars_instrumentId_date_idx`(`instrumentId`, `date` DESC),
    UNIQUE INDEX `market_daily_bars_instrumentId_date_key`(`instrumentId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tools` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(40) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `coverAssetId` VARCHAR(191) NULL,
    `config` JSON NOT NULL,
    `relatedCount` INTEGER NOT NULL DEFAULT 6,
    `showRelated` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tools_key_key`(`key`),
    INDEX `tools_isEnabled_sortOrder_idx`(`isEnabled`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tool_translations` (
    `id` VARCHAR(191) NOT NULL,
    `toolId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `tagline` VARCHAR(220) NULL,
    `intro` TEXT NULL,
    `body` LONGTEXT NULL,
    `faq` JSON NULL,
    `seoTitle` VARCHAR(70) NULL,
    `seoDescription` VARCHAR(180) NULL,
    `seoFocusKeyword` VARCHAR(100) NULL,
    `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED') NOT NULL DEFAULT 'DRAFT',
    `sourceHash` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tool_translations_toolId_locale_key`(`toolId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `market_daily_bars` ADD CONSTRAINT `market_daily_bars_instrumentId_fkey` FOREIGN KEY (`instrumentId`) REFERENCES `market_instruments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tool_translations` ADD CONSTRAINT `tool_translations_toolId_fkey` FOREIGN KEY (`toolId`) REFERENCES `tools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
