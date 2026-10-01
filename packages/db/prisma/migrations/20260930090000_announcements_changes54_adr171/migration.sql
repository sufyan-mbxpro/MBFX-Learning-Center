-- ADR-171 (changes-54 N1): announcement emails through a database job queue.
-- A recipient row is the job and holds no rendered body; `@@unique
-- ([campaignId, email])` is what makes "never the same announcement twice"
-- a property of the database rather than of the code that fills it.

-- AlterTable
ALTER TABLE `email_deliveries` ADD COLUMN `campaignId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `email_deliveries_campaignId_idx` ON `email_deliveries`(`campaignId`);

-- CreateTable
CREATE TABLE `email_campaigns` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('COURSE') NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `subject` VARCHAR(200) NULL,
    `message` VARCHAR(500) NULL,
    `audience` JSON NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `scheduledFor` DATETIME(3) NULL,
    `sendWhenLive` BOOLEAN NOT NULL DEFAULT false,
    `snapshotAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `cancelReason` VARCHAR(40) NULL,
    `recipientCount` INTEGER NOT NULL DEFAULT 0,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `skippedCount` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NOT NULL,
    `sentById` VARCHAR(191) NULL,
    `cancelledById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `email_campaigns_status_scheduledFor_idx`(`status`, `scheduledFor`),
    INDEX `email_campaigns_kind_targetId_idx`(`kind`, `targetId`),
    INDEX `email_campaigns_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_campaign_recipients` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `subscriberId` VARCHAR(191) NULL,
    `name` VARCHAR(255) NULL,
    `locale` VARCHAR(10) NOT NULL,
    `status` ENUM('PENDING', 'SENDING', 'SENT', 'FAILED', 'SUPPRESSED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `runAfter` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `claimToken` VARCHAR(40) NULL,
    `claimedAt` DATETIME(3) NULL,
    `lastError` VARCHAR(40) NULL,
    `deliveryId` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,

    INDEX `email_campaign_recipients_status_runAfter_idx`(`status`, `runAfter`),
    INDEX `email_campaign_recipients_claimToken_idx`(`claimToken`),
    INDEX `email_campaign_recipients_campaignId_status_idx`(`campaignId`, `status`),
    UNIQUE INDEX `email_campaign_recipients_campaignId_email_key`(`campaignId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_suppressions` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `scope` ENUM('ANNOUNCEMENTS') NOT NULL,
    `reason` ENUM('UNSUBSCRIBED', 'ADMIN', 'BOUNCE', 'COMPLAINT') NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_suppressions_email_scope_key`(`email`, `scope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_campaign_recipients` ADD CONSTRAINT `email_campaign_recipients_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `email_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
