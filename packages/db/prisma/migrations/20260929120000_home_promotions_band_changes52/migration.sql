-- changes-52 P4 (ADR-167): the home band of live promotions.
--
-- A DATA migration for the reason 20260922130000 states: `home.sections` is
-- seeded with an upsert that never overwrites a stored value, and the homepage
-- composer that could add a row is paused (ADR-038).
--
-- Bounded and additive: it APPENDS the entry only when the list has no
-- `promotions` key yet, so a row someone already placed is left alone and a
-- second run matches nothing. Appending (not inserting at index 1) is enough —
-- the page sorts on `order`, not on array position. It is safe on a live site:
-- the band renders nothing until a promotion is live and set to show in it.
UPDATE `settings`
SET `value` = JSON_ARRAY_APPEND(
      `value`,
      '$',
      JSON_OBJECT('key', 'promotions', 'enabled', TRUE, 'order', 2)
    )
WHERE `key` = 'home.sections'
  AND JSON_TYPE(`value`) = 'ARRAY'
  AND JSON_SEARCH(`value`, 'one', 'promotions', NULL, '$[*].key') IS NULL;
