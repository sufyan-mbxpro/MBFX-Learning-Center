-- ADR-123: the learner profile page's "recent reading". One row per
-- (learner, article), whose `readAt` an upsert moves forward on a re-read.

-- CreateTable
CREATE TABLE `article_reads` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `articleId` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `article_reads_userId_readAt_idx`(`userId`, `readAt`),
    INDEX `article_reads_articleId_idx`(`articleId`),
    UNIQUE INDEX `article_reads_userId_articleId_key`(`userId`, `articleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `article_reads` ADD CONSTRAINT `article_reads_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `article_reads` ADD CONSTRAINT `article_reads_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
