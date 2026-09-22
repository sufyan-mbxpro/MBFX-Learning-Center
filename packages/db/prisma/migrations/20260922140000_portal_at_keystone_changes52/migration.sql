-- changes-52, ADR-151: the staff portal moved from /admin to /keystone, and
-- the old prefix now answers 404. A notification stores a portal-relative
-- link, so a row written before the move would send its reader to a 404.
-- The bare `/admin` was the dashboard, which is `/keystone/dashboard` now.
UPDATE `notifications`
SET `href` = '/keystone/dashboard'
WHERE `href` = '/admin';

UPDATE `notifications`
SET `href` = CONCAT('/keystone/', SUBSTRING(`href`, 8))
WHERE `href` LIKE '/admin/%';
