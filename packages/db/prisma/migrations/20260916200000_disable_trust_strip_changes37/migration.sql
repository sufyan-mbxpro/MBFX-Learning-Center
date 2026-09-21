-- changes-37 (ADR-121 §3): turn off the `trust_strip` band in an existing
-- `home.sections`.
--
-- A DATA migration, the third of its kind, for the reason the changes-32
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
-- `trust_strip` entry exists and is not already disabled.
UPDATE `settings`
SET `value` = JSON_SET(
      `value`,
      REPLACE(
        JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'trust_strip', NULL, '$[*].key')),
        '.key',
        '.enabled'
      ),
      FALSE
    )
WHERE `key` = 'home.sections'
  AND JSON_SEARCH(`value`, 'one', 'trust_strip', NULL, '$[*].key') IS NOT NULL
  AND JSON_EXTRACT(
        `value`,
        REPLACE(
          JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'trust_strip', NULL, '$[*].key')),
          '.key',
          '.enabled'
        )
      ) <> FALSE;
