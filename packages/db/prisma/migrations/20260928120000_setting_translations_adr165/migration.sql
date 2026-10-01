-- ADR-165: translatable settings. One table holding a setting's WORDS in another
-- language (never its switches or URLs), and `settings.isTranslatable` brought
-- into agreement with the code registry (`TRANSLATABLE_SETTINGS`). The column
-- was seeded false everywhere and read by nothing; the code still reads the
-- registry, not the column. Unconditional, because it states a fact about a
-- KEY, not a value an admin chose.
-- CreateTable
CREATE TABLE `setting_translations` (
    `id` VARCHAR(191) NOT NULL,
    `settingId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `value` JSON NOT NULL,
    `translationStatus` ENUM('DRAFT', 'TRANSLATED', 'NEEDS_REVIEW', 'OUTDATED', 'MACHINE_TRANSLATED') NOT NULL DEFAULT 'TRANSLATED',
    `sourceHash` VARCHAR(64) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `setting_translations_locale_idx`(`locale`),
    UNIQUE INDEX `setting_translations_settingId_locale_key`(`settingId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `setting_translations` ADD CONSTRAINT `setting_translations_settingId_fkey` FOREIGN KEY (`settingId`) REFERENCES `settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Mirror the registry (ADR-165 #1).
UPDATE `settings` SET `isTranslatable` = `key` IN (
    'site.description',
    'legal.riskDisclaimer',
    'legal.copyrightNotice',
    'header.announcementBar',
    'header.topBar',
    'header.cta'
);
