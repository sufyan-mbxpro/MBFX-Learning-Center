-- CreateTable
CREATE TABLE `newsletter_subscribers` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'UNSUBSCRIBED') NOT NULL DEFAULT 'PENDING',
    `source` VARCHAR(32) NOT NULL,
    `confirmTokenHash` VARCHAR(64) NULL,
    `confirmExpiresAt` DATETIME(3) NULL,
    `unsubscribeTokenHash` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `unsubscribedAt` DATETIME(3) NULL,
    `lastConfirmSentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `newsletter_subscribers_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `newsletter_subscribers_userId_idx`(`userId`),
    UNIQUE INDEX `newsletter_subscribers_email_key`(`email`),
    UNIQUE INDEX `newsletter_subscribers_confirmTokenHash_key`(`confirmTokenHash`),
    UNIQUE INDEX `newsletter_subscribers_unsubscribeTokenHash_key`(`unsubscribeTokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `newsletter_subscribers` ADD CONSTRAINT `newsletter_subscribers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
