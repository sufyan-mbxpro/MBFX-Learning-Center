-- changes-45 / ADR-142: the status tokens leave blue.
--
-- A DATA migration. `pnpm db:seed` rewrites the seeded theme's brand colours,
-- but an install that is migrated and never re-seeded would keep the blue
-- `success` (#2D72C7) and `info` (#004284) the ADR replaces.
--
-- Bounded per KEY to a row still holding the seeded value, so a colour an
-- admin chose in the theme editor survives — the same bound the ADR-140
-- typeface migration used. Idempotent: a second run matches nothing.
UPDATE `themes`
SET `brandColors` = JSON_SET(`brandColors`, '$.success', '#936B44')
WHERE UPPER(JSON_UNQUOTE(JSON_EXTRACT(`brandColors`, '$.success'))) = '#2D72C7';

UPDATE `themes`
SET `brandColors` = JSON_SET(`brandColors`, '$.info', '#5A524B')
WHERE UPPER(JSON_UNQUOTE(JSON_EXTRACT(`brandColors`, '$.info'))) = '#004284';
