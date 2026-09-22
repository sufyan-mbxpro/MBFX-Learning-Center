-- changes-49 (ADR-148): the public site and the admin portal each get their
-- OWN theme row, so editing one surface's colours never moves the other.
--
-- Both start as a copy of today's active palette, so nothing on either surface
-- changes on deploy. The rows have fixed keys — `surface-web` and
-- `surface-admin` — which is what the editor and `@repo/theme`'s loader look
-- for (the loader already prefers an exact `scope` over `both`). The row that
-- was active becomes an ordinary preset (inactive, scope `both`), so the
-- palette it held is still one click away on either surface.
--
-- Idempotent: each copy is inserted only if its key does not exist, and the
-- old row is deactivated only once both copies are there.
INSERT INTO `themes` (`id`, `key`, `name`, `description`, `brandColors`, `lightSurface`,
  `darkSurface`, `darkBrandOverrides`, `layoutTokens`, `defaultMode`, `isActive`, `isSystem`,
  `scope`, `createdBy`, `createdAt`, `updatedAt`)
SELECT UUID(), 'surface-web', 'Public site', 'The public site''s live palette.', `brandColors`,
  `lightSurface`, `darkSurface`, `darkBrandOverrides`, `layoutTokens`, `defaultMode`, true, true,
  'web', `createdBy`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `themes`
WHERE `isActive` = true AND `key` NOT IN ('surface-web', 'surface-admin')
  AND NOT EXISTS (SELECT 1 FROM (SELECT `key` FROM `themes`) AS t WHERE t.`key` = 'surface-web')
ORDER BY `updatedAt` DESC
LIMIT 1;

INSERT INTO `themes` (`id`, `key`, `name`, `description`, `brandColors`, `lightSurface`,
  `darkSurface`, `darkBrandOverrides`, `layoutTokens`, `defaultMode`, `isActive`, `isSystem`,
  `scope`, `createdBy`, `createdAt`, `updatedAt`)
SELECT UUID(), 'surface-admin', 'Admin portal', 'The admin portal''s live palette.', `brandColors`,
  `lightSurface`, `darkSurface`, `darkBrandOverrides`, `layoutTokens`, `defaultMode`, true, true,
  'admin', `createdBy`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `themes`
WHERE `isActive` = true AND `key` NOT IN ('surface-web', 'surface-admin')
  AND NOT EXISTS (SELECT 1 FROM (SELECT `key` FROM `themes`) AS t WHERE t.`key` = 'surface-admin')
ORDER BY `updatedAt` DESC
LIMIT 1;

UPDATE `themes`
SET `isActive` = false, `scope` = 'both'
WHERE `key` NOT IN ('surface-web', 'surface-admin')
  AND (SELECT COUNT(*) FROM (SELECT `key` FROM `themes`) AS t
       WHERE t.`key` IN ('surface-web', 'surface-admin')) = 2;
