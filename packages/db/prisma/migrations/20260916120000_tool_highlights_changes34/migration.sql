-- changes-34 / ADR-114 #3: a tool says why it exists.
--
-- One nullable JSON column. NULL is meaningful here and is not the same as an
-- empty array: NULL is "this row predates the band", which is what the seed's
-- bounded backfill looks for, and `[]` is "an admin removed every card", which
-- the seed must never overwrite.
--
-- The seeded CONTENT is not written here. Eight tools' worth of English prose
-- in SQL would be a second copy of `TOOL_SEEDS` that drifts from the first the
-- moment a word changes; `seed.ts` fills the column instead, matching only
-- rows where it is still NULL.
ALTER TABLE `tool_translations`
  ADD COLUMN `highlights` JSON NULL AFTER `faq`;
