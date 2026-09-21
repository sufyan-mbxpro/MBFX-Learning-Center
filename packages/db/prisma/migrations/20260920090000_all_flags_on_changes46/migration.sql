-- changes-46 (ADR-144 §5): the feature-flag screen is removed, so every flag
-- that remains is ON, and the five that nothing reads are gone.
--
-- A DATA migration, like the settings migrations before it: the seed's flag
-- upsert deliberately never touches `isEnabled` on an existing row (an
-- admin's switch survived a re-seed), so a changed default reaches a FRESH
-- install only. With `/admin/features` deleted there is no screen left to
-- flip a flag from, and a flag left OFF on an existing install would be a
-- section nobody could ever turn on again.
--
-- ── The five deletions ─────────────────────────────────────────────────
--
-- `comments`, `forums`, `watchlists`, `currency_strength` and
-- `user_accounts` have been seeded since Module 01 and are read by no code
-- (code-style.md #28 — a setting that is read by nothing does not ship).
-- Deleting them is safe in the way overwriting a VALUE is not: no page, route
-- or service asks for them, so removing the row changes nothing a reader can
-- see. The seed stops creating them in the same change.
DELETE FROM `feature_flags`
WHERE `key` IN ('comments', 'forums', 'watchlists', 'currency_strength', 'user_accounts');

-- ── Everything else ON ─────────────────────────────────────────────────
--
-- Unbounded on purpose. The only way to turn a flag off was the screen this
-- change removes; the owner's instruction is that every section a page reads
-- is available. Visibility (PUBLIC / AUTHENTICATED / PREMIUM) is untouched.
UPDATE `feature_flags` SET `isEnabled` = true, `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `isEnabled` = false;
