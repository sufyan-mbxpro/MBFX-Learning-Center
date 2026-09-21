-- AlterTable
ALTER TABLE `lesson_progress` ADD COLUMN `lastViewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- Backfill: the best existing evidence of a visit is the row's own last write.
-- Without it every historical row would claim to have been read today.
UPDATE `lesson_progress` SET `lastViewedAt` = `updatedAt`;

-- CreateIndex
CREATE INDEX `lesson_progress_userId_lastViewedAt_idx` ON `lesson_progress`(`userId`, `lastViewedAt`);
