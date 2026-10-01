-- ADR-170 (changes-52 P7): a promotion's approximate daily reach, counts only.
-- No IP, cookie, user, session, user agent or path column, by design.

-- CreateTable
CREATE TABLE `promotion_daily_stats` (
    `promotionId` VARCHAR(191) NOT NULL,
    `day` DATE NOT NULL,
    `surface` ENUM('POPUP', 'BAND') NOT NULL,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `dismissals` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`promotionId`, `day`, `surface`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `promotion_daily_stats` ADD CONSTRAINT `promotion_daily_stats_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `promotions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
