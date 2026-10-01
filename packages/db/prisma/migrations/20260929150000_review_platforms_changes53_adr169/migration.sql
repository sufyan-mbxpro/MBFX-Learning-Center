-- ADR-169 / changes-53: review platforms. One new table, then a data move
-- that keeps a live site's reviews band exactly as it was.

-- CreateTable
CREATE TABLE `review_platforms` (
    `id` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(40) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `identifier` VARCHAR(200) NULL,
    `customUrl` VARCHAR(500) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `review_platforms_platform_key`(`platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── The old setting's value becomes the Trustpilot row ──────────────────
--
-- `site.reviewsUrl` was the band's one button (ADR-135). A non-empty value is
-- carried into Trustpilot's CUSTOM link, switched on, so the same address is
-- printed before and after this deploy. An empty value leaves Trustpilot off,
-- which is also what the band did before: absent. The seed creates the
-- Google and Facebook rows (off) with `create`-only upserts, and creates
-- Trustpilot only where this statement did not.
INSERT INTO `review_platforms` (`id`, `platform`, `isEnabled`, `sortOrder`, `customUrl`, `updatedAt`)
SELECT
    'rp_trustpilot_changes53',
    'trustpilot',
    true,
    0,
    JSON_UNQUOTE(JSON_EXTRACT(`value`, '$')),
    CURRENT_TIMESTAMP(3)
FROM `settings`
WHERE `key` = 'site.reviewsUrl'
  AND JSON_TYPE(`value`) = 'STRING'
  AND JSON_UNQUOTE(JSON_EXTRACT(`value`, '$')) LIKE 'https://%';

-- ── `site.reviewsUrl` is DELETED ────────────────────────────────────────
--
-- The key is gone from SETTINGS_SCHEMAS, so nothing can read the row either
-- way (code-style.md #28; `20260916150000_settings_cleanup_changes36` is the
-- precedent). Its value, if it had one, now lives in the row above.
DELETE FROM `settings` WHERE `key` = 'site.reviewsUrl';
