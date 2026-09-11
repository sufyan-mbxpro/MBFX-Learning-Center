/*
  Warnings:

  - You are about to drop the column `coverImageUrl` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the column `coverImageUrl` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the column `moduleId` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the `module_translations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `modules` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `track` to the `courses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sectionId` to the `lessons` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `lessons` DROP FOREIGN KEY `lessons_moduleId_fkey`;

-- DropForeignKey
ALTER TABLE `module_translations` DROP FOREIGN KEY `module_translations_moduleId_fkey`;

-- DropForeignKey
ALTER TABLE `modules` DROP FOREIGN KEY `modules_courseId_fkey`;

-- DropIndex
DROP INDEX `lessons_moduleId_sortOrder_idx` ON `lessons`;

-- AlterTable
ALTER TABLE `courses` DROP COLUMN `coverImageUrl`,
    ADD COLUMN `coverAssetId` VARCHAR(191) NULL,
    ADD COLUMN `externalUrl` VARCHAR(500) NULL,
    ADD COLUMN `lessonCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `track` VARCHAR(40) NOT NULL;

-- AlterTable
ALTER TABLE `lessons` DROP COLUMN `coverImageUrl`,
    DROP COLUMN `moduleId`,
    ADD COLUMN `completionRule` ENUM('MANUAL', 'QUIZ_PASS') NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN `externalUrl` VARCHAR(500) NULL,
    ADD COLUMN `heroAssetId` VARCHAR(191) NULL,
    ADD COLUMN `isRequired` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `sectionId` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `module_translations`;

-- DropTable
DROP TABLE `modules`;

-- CreateTable
CREATE TABLE `course_sections` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `course_sections_courseId_sortOrder_idx`(`courseId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_section_translations` (
    `id` VARCHAR(191) NOT NULL,
    `sectionId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,

    UNIQUE INDEX `course_section_translations_sectionId_locale_key`(`sectionId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `label` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lesson_attachments_lessonId_sortOrder_idx`(`lessonId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson_progress` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `status` ENUM('IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'IN_PROGRESS',
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lesson_progress_userId_courseId_idx`(`userId`, `courseId`),
    INDEX `lesson_progress_lessonId_status_idx`(`lessonId`, `status`),
    UNIQUE INDEX `lesson_progress_userId_lessonId_key`(`userId`, `lessonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_enrollments` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `lastLessonId` VARCHAR(191) NULL,
    `lessonsCompleted` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `lastActiveAt` DATETIME(3) NOT NULL,

    INDEX `course_enrollments_userId_lastActiveAt_idx`(`userId`, `lastActiveAt`),
    INDEX `course_enrollments_courseId_completedAt_idx`(`courseId`, `completedAt`),
    UNIQUE INDEX `course_enrollments_userId_courseId_key`(`userId`, `courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `courses_track_status_sortOrder_idx` ON `courses`(`track`, `status`, `sortOrder`);

-- CreateIndex
CREATE INDEX `lessons_sectionId_sortOrder_idx` ON `lessons`(`sectionId`, `sortOrder`);

-- AddForeignKey
ALTER TABLE `course_sections` ADD CONSTRAINT `course_sections_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_section_translations` ADD CONSTRAINT `course_section_translations_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `course_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `course_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_attachments` ADD CONSTRAINT `lesson_attachments_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lessons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_progress` ADD CONSTRAINT `lesson_progress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_progress` ADD CONSTRAINT `lesson_progress_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lessons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_enrollments` ADD CONSTRAINT `course_enrollments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_enrollments` ADD CONSTRAINT `course_enrollments_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
