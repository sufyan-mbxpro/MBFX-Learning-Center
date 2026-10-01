-- ADR-173: a promotion may also show as a small dismissible banner, at one of
-- four positions. Existing promotions keep their behaviour (showAsBar = false).

-- AlterTable
ALTER TABLE `promotions` ADD COLUMN `showAsBar` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `barPosition` ENUM('TOP', 'BOTTOM', 'LEFT', 'RIGHT') NOT NULL DEFAULT 'BOTTOM';

-- AlterTable
ALTER TABLE `promotion_daily_stats` MODIFY `surface` ENUM('POPUP', 'BAND', 'BAR') NOT NULL;
