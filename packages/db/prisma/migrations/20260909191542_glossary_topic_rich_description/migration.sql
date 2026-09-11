-- AlterTable
ALTER TABLE `glossary_topic_translations` ADD COLUMN `seoKeywords` VARCHAR(255) NULL,
    MODIFY `description` TEXT NULL;
