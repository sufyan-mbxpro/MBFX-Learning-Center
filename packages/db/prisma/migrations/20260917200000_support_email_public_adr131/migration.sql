-- ADR-131: `site.supportEmail` becomes the `/support` inbox and the address
-- the page's Email Support card prints, so it is now a PUBLIC setting.
--
-- A data migration because the seed's upsert only reaches `isPublic` when the
-- seed is re-run. Only the flag moves: the VALUE an admin saved is untouched.
-- Idempotent — a row already public matches nothing.
UPDATE `settings`
SET `isPublic` = TRUE
WHERE `key` = 'site.supportEmail'
  AND `isPublic` = FALSE;
