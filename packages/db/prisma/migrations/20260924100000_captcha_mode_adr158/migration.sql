-- ADR-158: reCAPTCHA can be a checkbox (v2) as well as a score (v3).
-- Every existing row keeps running v3.
-- AlterTable
ALTER TABLE `captcha_config` ADD COLUMN `mode` ENUM('SCORE', 'CHECKBOX') NOT NULL DEFAULT 'SCORE';
