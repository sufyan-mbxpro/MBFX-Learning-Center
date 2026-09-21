-- changes-40: the footer's Tools column becomes two.
--
-- A DATA migration, like the four before it in this series, and for the same
-- reason: the settings upsert's `update` clause deliberately never touches
-- `value`, so a change to the seed reaches a FRESH install only.
--
-- ── Why ─────────────────────────────────────────────────────────────────
--
-- `footer_tools` had grown to fifteen rows against a next-longest column of
-- six. The footer is a five-track grid, so that was one tall stack beside four
-- short ones, with everything below the tenth row sitting under a fold of
-- empty grid. changes-40 splits it by what a row IS: `footer_tools`
-- ("Calculators") keeps the seven tools a reader types numbers into, and the
-- new `footer_tools_markets` ("Market data") takes the eight pages that SHOW
-- the market — the two boards, the headline feed, the two relationship tools,
-- pivot points, market hours and the economic calendar.
--
-- ── What this does, and what it deliberately does not ───────────────────
--
-- Only the SETTING moves. The `footer_tools_markets` MENU and its rows are
-- created by the seed, not here: `menus` and `menu_items` are seeded with
-- upserts that run on every `db:seed`, so an existing install gets the new
-- column's rows the next time it seeds, and writing them twice would be two
-- places to keep a list of links honest.
--
-- Rows left in `footer_tools` that have moved are NOT deleted here either.
-- The seed's own upsert owns that menu's contents; a DELETE here would race
-- with it and would also be wrong for an admin who has curated the column.
--
-- Bounded to a row still holding the FIVE-column value changes-36 seeded,
-- exactly as that migration was bounded to the three-column one before it: an
-- admin who has reordered or rewritten their columns is matched by nothing
-- here and keeps their version. `JSON_CONTAINS` both ways is a set
-- comparison, insensitive to the key order MariaDB happened to store, which a
-- string compare is not.
UPDATE `settings`
SET `value` = JSON_EXTRACT(
  '[{"menuKey":"footer_learn_forex","order":1},
    {"menuKey":"footer_learn_crypto","order":2},
    {"menuKey":"footer_tools","order":3},
    {"menuKey":"footer_tools_markets","order":4},
    {"menuKey":"footer_markets","order":5},
    {"menuKey":"footer_company","order":6}]', '$')
WHERE `key` = 'footer.menuColumns'
  AND JSON_LENGTH(`value`) = 5
  AND JSON_CONTAINS(`value`, '{"menuKey":"footer_learn_forex"}')
  AND JSON_CONTAINS(`value`, '{"menuKey":"footer_learn_crypto"}')
  AND JSON_CONTAINS(`value`, '{"menuKey":"footer_tools"}')
  AND JSON_CONTAINS(`value`, '{"menuKey":"footer_markets"}')
  AND JSON_CONTAINS(`value`, '{"menuKey":"footer_company"}');
