-- changes-49 (owner): turn off the `connect` band ("Follow us for the latest
-- analysis, views and breaking news") in an existing
-- `home.sections`.
--
-- A DATA migration like the changes-37 `trust_strip` one, for the reason the changes-32
-- `feature_highlights` one states in full: `home.sections` is seeded with an
-- upsert that never overwrites a stored value, so flipping the seed reaches a
-- FRESH install only, and the homepage composer that could flip it by hand is
-- paused (ADR-038).
--
-- Surgical: the row keeps its `order`, nothing else in the composition moves,
-- and the component, its dataset and its catalog key stay in the tree. A band
-- removed from a page is not a band deleted from the product.
--
-- Idempotent and self-skipping: matches only a `home.sections` row whose
-- `connect` entry exists and is not already disabled.
UPDATE `settings`
SET `value` = JSON_SET(
      `value`,
      REPLACE(
        JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'connect', NULL, '$[*].key')),
        '.key',
        '.enabled'
      ),
      FALSE
    )
WHERE `key` = 'home.sections'
  AND JSON_SEARCH(`value`, 'one', 'connect', NULL, '$[*].key') IS NOT NULL
  AND JSON_EXTRACT(
        `value`,
        REPLACE(
          JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'connect', NULL, '$[*].key')),
          '.key',
          '.enabled'
        )
      ) <> FALSE;
