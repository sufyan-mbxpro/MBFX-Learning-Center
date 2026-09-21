-- changes-36: two settings rows an existing database should not keep.
--
-- DATA migrations, not schema ones, and the fifth in this series for the
-- reason the earlier ones spell out: the settings upsert's `update` clause
-- deliberately never touches `value`, so a change to the seed reaches a
-- FRESH install only.
--
-- ── 1. `site.faviconUrl` is DELETED, not re-defaulted ────────────────────
--
-- It was seeded in Module 05 and read by nothing. The favicon has been a
-- BrandAsset since ADR-017 — set in Theme → Logos & Favicons, read by
-- `faviconIcons()` in both root layouts — so this row was a control an admin
-- could fill in, save, and watch change nothing (code-style.md #28).
--
-- Deleting the row is the right move rather than hiding the field, and it is
-- safe in the way overwriting a value is not: the key is gone from
-- `SETTING_KEYS`, so nothing can read it, and a row whose key is not in the
-- registry is not a preference anybody can act on. Unconditional for the
-- same reason — there is no "an admin changed this" case to protect when the
-- value reaches no rendered page either way.
DELETE FROM `settings` WHERE `key` = 'site.faviconUrl';

-- ── 2. `footer.menuColumns` gains the two new columns ────────────────────
--
-- The footer is a sitemap (Module 08). changes-36 gives it a column per
-- school and a column for the nine Tools rows, so every destination the
-- header offers has a footer row — which is what that sentence has claimed
-- since it was written, and what it stopped being true of when ADR-065 split
-- Learn into two schools and ADR-086 added eight tools.
--
-- Bounded to a row still holding the THREE-column value changes-33 seeded,
-- exactly as `20260915180000` is bounded: an admin who has reordered or
-- rewritten their columns is matched by nothing here and keeps their version.
-- JSON_CONTAINS both ways is a set comparison — it is insensitive to the key
-- order MariaDB happened to store, which a string compare is not.
UPDATE `settings`
SET `value` = JSON_EXTRACT(
  '[{"menuKey":"footer_learn_forex","order":1},
    {"menuKey":"footer_learn_crypto","order":2},
    {"menuKey":"footer_tools","order":3},
    {"menuKey":"footer_markets","order":4},
    {"menuKey":"footer_company","order":5}]', '$')
WHERE `key` = 'footer.menuColumns'
  AND JSON_LENGTH(`value`) = 3
  AND JSON_CONTAINS(`value`, '{"menuKey":"footer_learn"}')
  AND JSON_CONTAINS(`value`, '{"menuKey":"footer_markets"}')
  AND JSON_CONTAINS(`value`, '{"menuKey":"footer_company"}');
