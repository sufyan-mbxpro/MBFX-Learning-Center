-- ADR-065 §3: tracks become part of the address, so the two content types the
-- header now scopes per track carry one.
--
-- `quizzes.track` is NOT NULL because a quiz has exactly one canonical URL
-- (/learn/<track>/quizzes/<slug>) and that segment cannot come from a null.
-- The DEFAULT exists only to make the column addable in one statement; it is
-- dropped immediately so every future insert must state the track. Pre-launch
-- policy is reset, not backfill, so the default never survives a real row.
ALTER TABLE `quizzes` ADD COLUMN `track` VARCHAR(40) NOT NULL DEFAULT 'forex';
ALTER TABLE `quizzes` ALTER COLUMN `track` DROP DEFAULT;
CREATE INDEX `quizzes_track_isStandalone_status_idx` ON `quizzes`(`track`, `isStandalone`, `status`);

-- `glossary_terms.track` is nullable, and NULL means "every track's glossary"
-- rather than "unfiled" — a cross-market term is one page, not two.
ALTER TABLE `glossary_terms` ADD COLUMN `track` VARCHAR(40) NULL;
CREATE INDEX `glossary_terms_track_status_idx` ON `glossary_terms`(`track`, `status`);
