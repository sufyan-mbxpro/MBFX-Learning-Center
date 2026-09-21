-- The E2E suite provisions its OWN database (`mbfx_e2e` by default) and drops
-- it at the start of every run — see apps/web/e2e/provision.ts. MARIADB_USER
-- is only granted rights on MARIADB_DATABASE, so without this the very first
-- statement fails with Prisma's P1010 ("User was denied access on the database
-- `mbfx_e2e`") and the whole admin suite is unreachable on a fresh machine.
--
-- `mbfx\_%` escapes the underscore so this is "every database whose name
-- starts with mbfx_", not "every database with any character there".
GRANT ALL PRIVILEGES ON `mbfx\_%`.* TO 'user'@'%';
FLUSH PRIVILEGES;
