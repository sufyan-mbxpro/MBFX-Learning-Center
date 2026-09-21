-- changes-32 / ADR-108: turn the header search ON in an existing database.
--
-- A DATA migration, not a schema one, and the third in this series for the
-- reason the two before it spell out: the settings upsert's `update` clause
-- deliberately never touches `value` ("never overwrite a value an admin has
-- already changed"), so flipping the seed reaches a FRESH install only.
--
-- `header.showSearch` was seeded FALSE in Module 08 because the control it
-- governed was a magnifying glass linking to `/news` — an honest placeholder
-- for a backend that did not exist, and one better left off than shipped.
-- ADR-108 built the backend, so the default is now TRUE and an existing
-- database should get the feature the owner asked for rather than a switch
-- they have to find.
--
-- This is the one case in the series where overwriting a stored value is
-- defensible, and it is bounded to make that true: the `WHERE` matches only a
-- row still holding the SEEDED default. An admin who has already turned the
-- search on is matched by nothing here; an admin who deliberately turned it
-- off is indistinguishable from one who never touched it, which is the honest
-- limitation — and the cost of getting it wrong is a search box they can
-- switch off again in one click.
--
-- Idempotent: running it twice changes nothing the second time.
UPDATE `settings`
SET `value` = JSON_EXTRACT('true', '$')
WHERE `key` = 'header.showSearch'
  AND JSON_EXTRACT(`value`, '$') = FALSE;
