-- ADR-177: quizzes and videos get their own permission keys.
--
-- Until now both borrowed the lesson keys (ADR-058 #8, ADR-068 §3). This
-- migration keeps everyone's access exactly where it was:
--
--   1. it creates the ten new keys (the seed upserts them too, with the
--      final labels and sort order; INSERT IGNORE makes either order safe);
--   2. it grants each new key to every role that holds its lesson twin. The
--      seed rewrites SYSTEM roles from its own list anyway, but it never
--      touches a role an admin created, and those would otherwise lose the
--      Quizzes and Videos screens;
--   3. it copies every per-user override (ALLOW and DENY) on a lesson key to
--      its quiz and video twins. A DENY matters most: a user denied
--      `lessons.delete` must not gain `quizzes.delete` by this change.
--
-- It also moves the existing rows onto the new cards (learning -> courses /
-- lessons, roles.* -> roles), which the seed would do as well.

INSERT IGNORE INTO `permissions` (`id`, `key`, `groupName`, `label`, `sortOrder`) VALUES
  (UUID(), 'quizzes.view', 'quizzes', 'View quizzes', 10),
  (UUID(), 'quizzes.create', 'quizzes', 'Create and duplicate quizzes', 11),
  (UUID(), 'quizzes.update', 'quizzes', 'Edit quizzes and their questions', 12),
  (UUID(), 'quizzes.delete', 'quizzes', 'Delete quizzes', 13),
  (UUID(), 'quizzes.publish', 'quizzes', 'Publish quizzes', 14),
  (UUID(), 'videos.view', 'videos', 'View videos and video categories', 15),
  (UUID(), 'videos.create', 'videos', 'Create video topics and categories', 16),
  (UUID(), 'videos.update', 'videos', 'Edit video topics and categories', 17),
  (UUID(), 'videos.delete', 'videos', 'Delete video topics and categories', 18),
  (UUID(), 'videos.publish', 'videos', 'Publish video topics', 19);

INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`)
SELECT rp.`roleId`, np.`id`
FROM `role_permissions` rp
JOIN `permissions` lp ON lp.`id` = rp.`permissionId`
JOIN `permissions` np ON np.`key` = REPLACE(lp.`key`, 'lessons.', 'quizzes.')
WHERE lp.`key` IN ('lessons.view', 'lessons.create', 'lessons.update', 'lessons.delete', 'lessons.publish');

INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`)
SELECT rp.`roleId`, np.`id`
FROM `role_permissions` rp
JOIN `permissions` lp ON lp.`id` = rp.`permissionId`
JOIN `permissions` np ON np.`key` = REPLACE(lp.`key`, 'lessons.', 'videos.')
WHERE lp.`key` IN ('lessons.view', 'lessons.create', 'lessons.update', 'lessons.delete', 'lessons.publish');

INSERT IGNORE INTO `user_permissions` (`userId`, `permissionId`, `effect`, `reason`, `assignedBy`, `assignedAt`)
SELECT up.`userId`, np.`id`, up.`effect`, up.`reason`, up.`assignedBy`, up.`assignedAt`
FROM `user_permissions` up
JOIN `permissions` lp ON lp.`id` = up.`permissionId`
JOIN `permissions` np ON np.`key` = REPLACE(lp.`key`, 'lessons.', 'quizzes.')
WHERE lp.`key` IN ('lessons.view', 'lessons.create', 'lessons.update', 'lessons.delete', 'lessons.publish');

INSERT IGNORE INTO `user_permissions` (`userId`, `permissionId`, `effect`, `reason`, `assignedBy`, `assignedAt`)
SELECT up.`userId`, np.`id`, up.`effect`, up.`reason`, up.`assignedBy`, up.`assignedAt`
FROM `user_permissions` up
JOIN `permissions` lp ON lp.`id` = up.`permissionId`
JOIN `permissions` np ON np.`key` = REPLACE(lp.`key`, 'lessons.', 'videos.')
WHERE lp.`key` IN ('lessons.view', 'lessons.create', 'lessons.update', 'lessons.delete', 'lessons.publish');

-- Offboarding moves from `employees.update` to `employees.delete` (ADR-177).
-- Every role and ALLOW override that could offboard before still can. A DENY
-- on `employees.update` is copied too, since it used to block offboarding.
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`)
SELECT rp.`roleId`, np.`id`
FROM `role_permissions` rp
JOIN `permissions` lp ON lp.`id` = rp.`permissionId`
JOIN `permissions` np ON np.`key` = 'employees.delete'
WHERE lp.`key` = 'employees.update';

INSERT IGNORE INTO `user_permissions` (`userId`, `permissionId`, `effect`, `reason`, `assignedBy`, `assignedAt`)
SELECT up.`userId`, np.`id`, up.`effect`, up.`reason`, up.`assignedBy`, up.`assignedAt`
FROM `user_permissions` up
JOIN `permissions` lp ON lp.`id` = up.`permissionId`
JOIN `permissions` np ON np.`key` = 'employees.delete'
WHERE lp.`key` = 'employees.update';

UPDATE `permissions` SET `groupName` = 'courses' WHERE `key` LIKE 'courses.%';
UPDATE `permissions` SET `groupName` = 'lessons' WHERE `key` LIKE 'lessons.%';
UPDATE `permissions` SET `groupName` = 'roles' WHERE `key` IN ('roles.view', 'roles.manage');
