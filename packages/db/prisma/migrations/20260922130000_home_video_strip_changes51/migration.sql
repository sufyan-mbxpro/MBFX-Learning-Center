-- changes-51 (owner): put the videos back on the home page as the `strip`
-- variant — a slider of small cover cards straight after the glossary band.
--
-- A DATA migration for the reason the changes-49 `connect` one states:
-- `home.sections` is seeded with an upsert that never overwrites a stored
-- value, and the homepage composer that could flip it is paused (ADR-038).
--
-- Bounded: it rewrites the `learning_videos` entry only while it still holds
-- the `grid` value the changes-31 repair left there, so a row someone has
-- already changed is left alone, and a second run matches nothing.
UPDATE `settings`
SET `value` = JSON_SET(
      `value`,
      REPLACE(JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'learning_videos', NULL, '$[*].key')), '.key', '.enabled'),
      TRUE,
      REPLACE(JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'learning_videos', NULL, '$[*].key')), '.key', '.order'),
      10,
      REPLACE(JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'learning_videos', NULL, '$[*].key')), '.key', '.variant'),
      'strip',
      REPLACE(JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'learning_videos', NULL, '$[*].key')), '.key', '.limit'),
      10
    )
WHERE `key` = 'home.sections'
  AND JSON_SEARCH(`value`, 'one', 'learning_videos', NULL, '$[*].key') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(
        `value`,
        REPLACE(JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'learning_videos', NULL, '$[*].key')), '.key', '.variant')
      )) = 'grid';
