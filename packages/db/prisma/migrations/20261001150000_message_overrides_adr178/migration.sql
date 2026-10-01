-- ADR-178: interface text an admin replaced, per language, laid over the
-- catalog file at request time. Deleted with its language.
CREATE TABLE `message_overrides` (
    `id` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `isMachine` BOOLEAN NOT NULL DEFAULT false,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `message_overrides_locale_key_key`(`locale`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `message_overrides` ADD CONSTRAINT `message_overrides_locale_fkey` FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;
