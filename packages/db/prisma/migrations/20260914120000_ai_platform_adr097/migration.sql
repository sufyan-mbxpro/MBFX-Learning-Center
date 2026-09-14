-- CreateTable
CREATE TABLE `ai_providers` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('ANTHROPIC', 'OPENAI', 'ECHO') NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `baseUrl` VARCHAR(255) NULL,
    `apiKeyCipher` TEXT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `lastTestAt` DATETIME(3) NULL,
    `lastTestError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_providers_isEnabled_idx`(`isEnabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_models` (
    `id` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(80) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `inputPricePerMTok` DECIMAL(12, 6) NOT NULL,
    `outputPricePerMTok` DECIMAL(12, 6) NOT NULL,
    `cachedInputPricePerMTok` DECIMAL(12, 6) NULL,
    `maxOutputTokens` INTEGER NOT NULL DEFAULT 4096,
    `supportsVision` BOOLEAN NOT NULL DEFAULT false,
    `supportsStream` BOOLEAN NOT NULL DEFAULT true,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `pricedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_models_isEnabled_sortOrder_idx`(`isEnabled`, `sortOrder`),
    UNIQUE INDEX `ai_models_providerId_modelId_key`(`providerId`, `modelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_features` (
    `key` VARCHAR(40) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `providerId` VARCHAR(191) NULL,
    `modelId` VARCHAR(191) NULL,
    `maxOutputTokens` INTEGER NULL,
    `extraInstructions` VARCHAR(1000) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_usage` (
    `id` VARCHAR(191) NOT NULL,
    `feature` VARCHAR(40) NOT NULL,
    `provider` ENUM('ANTHROPIC', 'OPENAI', 'ECHO') NOT NULL,
    `modelId` VARCHAR(80) NOT NULL,
    `status` ENUM('OK', 'FAILED', 'ABORTED', 'REFUSED') NOT NULL,
    `reason` VARCHAR(80) NULL,
    `inputTokens` INTEGER NOT NULL DEFAULT 0,
    `outputTokens` INTEGER NOT NULL DEFAULT 0,
    `cachedInputTokens` INTEGER NOT NULL DEFAULT 0,
    `costUsd` DECIMAL(12, 6) NOT NULL DEFAULT 0,
    `durationMs` INTEGER NOT NULL DEFAULT 0,
    `userId` VARCHAR(191) NULL,
    `entityType` VARCHAR(40) NULL,
    `entityId` VARCHAR(40) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_usage_createdAt_idx`(`createdAt`),
    INDEX `ai_usage_feature_createdAt_idx`(`feature`, `createdAt`),
    INDEX `ai_usage_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_usage_daily` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `feature` VARCHAR(40) NOT NULL,
    `provider` ENUM('ANTHROPIC', 'OPENAI', 'ECHO') NOT NULL,
    `modelId` VARCHAR(80) NOT NULL,
    `calls` INTEGER NOT NULL DEFAULT 0,
    `failures` INTEGER NOT NULL DEFAULT 0,
    `inputTokens` INTEGER NOT NULL DEFAULT 0,
    `outputTokens` INTEGER NOT NULL DEFAULT 0,
    `cachedInputTokens` INTEGER NOT NULL DEFAULT 0,
    `costUsd` DECIMAL(14, 6) NOT NULL DEFAULT 0,

    INDEX `ai_usage_daily_date_idx`(`date`),
    UNIQUE INDEX `ai_usage_daily_date_feature_provider_modelId_key`(`date`, `feature`, `provider`, `modelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_budget_periods` (
    `period` VARCHAR(7) NOT NULL,
    `costUsd` DECIMAL(14, 6) NOT NULL DEFAULT 0,
    `calls` INTEGER NOT NULL DEFAULT 0,
    `budgetUsd` DECIMAL(14, 6) NOT NULL DEFAULT 0,
    `warnedAt` DATETIME(3) NULL,
    `capReachedAt` DATETIME(3) NULL,
    `notifiedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`period`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ai_models` ADD CONSTRAINT `ai_models_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `ai_providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_features` ADD CONSTRAINT `ai_features_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `ai_providers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_features` ADD CONSTRAINT `ai_features_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `ai_models`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_usage` ADD CONSTRAINT `ai_usage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
