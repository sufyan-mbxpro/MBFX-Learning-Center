-- ADR-139: learning content carries the article's three flags.
-- Additive only. The defaults keep every existing row exactly as public as it
-- was: active, not featured, not premium.
ALTER TABLE `courses` ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `isPremium` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `lessons` ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `isPremium` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `quizzes` ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `isPremium` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `video_topics` ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `isPremium` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `glossary_terms` ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `isPremium` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `glossary_topics` ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isPremium` BOOLEAN NOT NULL DEFAULT false;
