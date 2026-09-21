-- changes-32: turn off the `feature_highlights` band in an existing
-- `home.sections`.
--
-- A DATA migration, not a schema one, and the same mechanism the changes-31
-- `learning_videos` repair used one migration earlier — for the same reason.
-- `home.sections` is written with an upsert whose `update` deliberately never
-- touches `value` ("never overwrite a value an admin has already changed"), so
-- flipping the seed to `enabled: false` reaches a FRESH install only. Every
-- database that already exists keeps rendering the band, and `pnpm db:seed`
-- is a no-op against it; only `db:reset`, which discards all content, would
-- clear it. Migrating is what reaches an existing database at all.
--
-- Unlike that one, this is not repairing a crash. "Built to be understood, not
-- to impress" parses fine and renders fine; the owner asked for it off
-- (2026-09-15). Which is exactly why nothing else here changes: the row keeps
-- its `order`, its `variant` and its `limit`, the component and its six
-- catalog entries stay in the tree, and turning it back on is one word in the
-- seed plus the inverse of this statement. A band removed from a page is not
-- a band deleted from the product.
--
-- Deliberately surgical for the same reason the last one was: the rest of the
-- stored composition is the admin's data. This does not add any band, reorder
-- any band, or touch any key but this one.
--
-- Idempotent and self-skipping: the `WHERE` matches only a `home.sections`
-- row whose `feature_highlights` entry exists and is not already disabled, so
-- running it against a freshly seeded database does nothing.
UPDATE `settings`
SET `value` = JSON_SET(
      `value`,
      REPLACE(
        JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'feature_highlights', NULL, '$[*].key')),
        '.key',
        '.enabled'
      ),
      FALSE
    )
WHERE `key` = 'home.sections'
  AND JSON_SEARCH(`value`, 'one', 'feature_highlights', NULL, '$[*].key') IS NOT NULL
  AND JSON_EXTRACT(
        `value`,
        REPLACE(
          JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'feature_highlights', NULL, '$[*].key')),
          '.key',
          '.enabled'
        )
      ) <> FALSE;
