-- The site is "MBX Learning Center".
--
-- `site.name` was seeded "MBX Pro" while the catalog, the email sender and
-- the owner all call the site "MBX Learning Center". Since the SEO pass of
-- 2026-09-24, `site.name` is the ONE brand name the site prints: the header,
-- the footer, every page title (through `%site%` in `seo.titleTemplate`),
-- `og:site_name` and the JSON-LD organization. So the seeded value is now
-- what Google shows.
--
-- A data migration because the settings upsert never overwrites a stored
-- value. Bounded to a row still holding the SEEDED "MBX Pro", so a name an
-- admin has already chosen is matched by nothing. Idempotent.
UPDATE `settings`
SET `value` = JSON_QUOTE('MBX Learning Center')
WHERE `key` = 'site.name'
  AND JSON_UNQUOTE(`value`) = 'MBX Pro';
