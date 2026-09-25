-- The title template names the site through `%site%` instead of spelling the
-- brand out a second time.
--
-- `seo.titleTemplate` was seeded `%s | MBX Pro` while every other brand
-- surface reads `site.name`, so renaming the site in Settings → General
-- changed the header and footer and left every page title on the old name.
-- The seed now writes `%s | %site%`, which the public pages resolve to
-- `site.name` at render.
--
-- A data migration because the settings upsert never overwrites a stored
-- value. Bounded to a row still holding the SEEDED default, so a template an
-- admin has already written is matched by nothing. Idempotent.
UPDATE `settings`
SET `value` = JSON_QUOTE('%s | %site%')
WHERE `key` = 'seo.titleTemplate'
  AND JSON_UNQUOTE(`value`) = '%s | MBX Pro';
