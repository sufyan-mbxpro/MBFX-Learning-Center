-- changes-43 / ADR-140 §1: the brand typeface becomes the operating system's
-- own UI face, for both the sans slot and the display slot.
--
-- A DATA migration. `pnpm db:seed` already rewrites the seeded theme's
-- `layoutTokens`, but an install that is migrated and never re-seeded would
-- keep Inter + Fraunces. The Layout tab that could change this is paused
-- (ADR-038), so no admin could correct it by hand either.
--
-- Bounded to a row still holding the seeded pair. A theme whose fonts someone
-- chose deliberately keeps them, which is the same bound the ADR-108 header
-- search migration used. Idempotent: a second run matches nothing.
UPDATE `themes`
SET `layoutTokens` = JSON_SET(`layoutTokens`, '$.fontSans', 'system', '$.fontDisplay', 'system')
WHERE JSON_UNQUOTE(JSON_EXTRACT(`layoutTokens`, '$.fontSans')) = 'inter'
  AND (
    JSON_EXTRACT(`layoutTokens`, '$.fontDisplay') IS NULL
    OR JSON_UNQUOTE(JSON_EXTRACT(`layoutTokens`, '$.fontDisplay')) = 'fraunces'
  );
