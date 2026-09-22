-- changes-50 (ADR-149): the built-in theme's light background is white.
--
-- The seeded default moves from the ivory `#F7F3ED` to `#FFFFFF` in
-- `@repo/theme` and `default-theme-tokens.json`. The seed upserts the built-in
-- preset, but the two surface rows are create-only (ADR-148), so an existing
-- install needs this to see the change on both surfaces.
--
-- Bounded to rows still holding the SEEDED ivory: an admin who chose any other
-- background keeps it. Only the built-in preset and the two surface rows are
-- touched — a saved custom preset is the admin's, whatever it holds.
UPDATE `themes`
SET `lightSurface` = JSON_SET(`lightSurface`, '$.background', '#FFFFFF')
WHERE `key` IN ('mbx-pro-default', 'surface-web', 'surface-admin')
  AND UPPER(JSON_UNQUOTE(JSON_EXTRACT(`lightSurface`, '$.background'))) = '#F7F3ED';
