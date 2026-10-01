-- ADR-172 (changes-55 C1): custom and direct emails on the ADR-171 queue.
-- A CUSTOM or DIRECT campaign carries its own words (`email_campaign_contents`)
-- and is about no piece of content, so `targetId` becomes nullable. Designs are
-- their own table, never template rows: ADR-078 #5 stands.

-- AlterTable
ALTER TABLE `email_campaigns` MODIFY `kind` ENUM('COURSE', 'CUSTOM', 'DIRECT') NOT NULL,
    MODIFY `targetId` VARCHAR(191) NULL,
    ADD COLUMN `designId` VARCHAR(191) NULL,
    ADD COLUMN `replyToSelf` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lastTestedAt` DATETIME(3) NULL,
    ADD COLUMN `testedHash` VARCHAR(64) NULL;

-- CreateIndex
CREATE INDEX `email_campaign_recipients_userId_idx` ON `email_campaign_recipients`(`userId`);

-- CreateTable
CREATE TABLE `email_campaign_contents` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `preheader` VARCHAR(200) NULL,
    `mode` ENUM('RICH', 'HTML') NOT NULL DEFAULT 'RICH',
    `bodyHtml` MEDIUMTEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_campaign_contents_campaignId_locale_key`(`campaignId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_designs` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(300) NULL,
    `mode` ENUM('RICH', 'HTML') NOT NULL DEFAULT 'RICH',
    `subject` VARCHAR(200) NULL,
    `preheader` VARCHAR(200) NULL,
    `bodyHtml` MEDIUMTEXT NOT NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `email_designs_archivedAt_updatedAt_idx`(`archivedAt`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_campaign_contents` ADD CONSTRAINT `email_campaign_contents_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `email_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
