-- ADR-180: `email.logo` is DELETED. Every email now carries the logos uploaded
-- in Branding (`logo_dark` on a dark band, `logo_light` on a pale one), so the
-- row is read by nothing and stays in no admin screen (code-style.md #28).
--
-- Unconditional, as `site.faviconUrl` was in changes-36: the key is gone from
-- `SETTING_KEYS`, so no code can read it whatever it holds, and a row whose
-- key is not in the registry is not a preference anybody can act on.
DELETE FROM `settings` WHERE `key` = 'email.logo';
