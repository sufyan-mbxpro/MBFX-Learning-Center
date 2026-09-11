-- AlterTable
ALTER TABLE `courses` ADD COLUMN `scheduledFor` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `glossary_terms` ADD COLUMN `scheduledFor` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `lessons` ADD COLUMN `scheduledFor` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `quizzes` ADD COLUMN `scheduledFor` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `video_topics` ADD COLUMN `scheduledFor` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `courses_status_scheduledFor_idx` ON `courses`(`status`, `scheduledFor`);

-- CreateIndex
CREATE INDEX `glossary_terms_status_scheduledFor_idx` ON `glossary_terms`(`status`, `scheduledFor`);

-- CreateIndex
CREATE INDEX `lessons_status_scheduledFor_idx` ON `lessons`(`status`, `scheduledFor`);

-- CreateIndex
CREATE INDEX `quizzes_status_scheduledFor_idx` ON `quizzes`(`status`, `scheduledFor`);

-- CreateIndex
CREATE INDEX `video_topics_status_scheduledFor_idx` ON `video_topics`(`status`, `scheduledFor`);
