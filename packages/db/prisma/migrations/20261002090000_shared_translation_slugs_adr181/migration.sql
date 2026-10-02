-- ADR-181: one slug for every language. Every non-default translation row
-- whose item has a default-locale row takes that row's slug, so the header's
-- language switcher (which swaps only the locale prefix) lands on the same
-- item. Old translated URLs get a 301 to the new address.
--
-- Two phases per table because `@@unique([locale, slug])` is checked row by
-- row: two items swapping slugs in one locale would collide mid-statement.
-- A row is LEFT ALONE when its English slug is already held in that locale by
-- an item that is not moving (only possible for data written before this
-- ADR); the services' collision rule (ADR-161 #6) handles it on the next save.
-- Video categories get no redirects: a category is a per-track VIEW, not an
-- address (ADR-068 §1), and its old view simply resolves to the new slug.

-- Pinned to the tables' collation: a session variable takes the SERVER's
-- default (MariaDB 11.4: uca1400), and comparing it to `locale` is error 1267.
SET @def := CONVERT(COALESCE((SELECT `code` FROM `locales` WHERE `isDefault` = 1 LIMIT 1), 'en') USING utf8mb4) COLLATE utf8mb4_unicode_ci;

CREATE TABLE `_adr181_slug_moves` (
  `tbl` VARCHAR(40) NOT NULL,
  `rowId` VARCHAR(191) NOT NULL,
  `entityId` VARCHAR(191) NOT NULL,
  `locale` VARCHAR(10) NOT NULL,
  `oldSlug` VARCHAR(255) NOT NULL,
  `newSlug` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`tbl`, `rowId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Collect the moves ──────────────────────────────────────────────────────

INSERT INTO `_adr181_slug_moves`
SELECT 'article', t.`id`, t.`articleId`, t.`locale`, t.`slug`, src.`slug`
FROM `article_translations` t
JOIN `article_translations` src ON src.`articleId` = t.`articleId` AND src.`locale` = @def
WHERE t.`locale` <> @def AND t.`slug` <> src.`slug`
  AND NOT EXISTS (
    SELECT 1 FROM `article_translations` o
    LEFT JOIN `article_translations` os ON os.`articleId` = o.`articleId` AND os.`locale` = @def
    WHERE o.`locale` = t.`locale` AND o.`slug` = src.`slug` AND o.`articleId` <> t.`articleId`
      AND (os.`id` IS NULL OR os.`slug` = o.`slug`));

INSERT INTO `_adr181_slug_moves`
SELECT 'article_category', t.`id`, t.`categoryId`, t.`locale`, t.`slug`, src.`slug`
FROM `article_category_translations` t
JOIN `article_category_translations` src ON src.`categoryId` = t.`categoryId` AND src.`locale` = @def
WHERE t.`locale` <> @def AND t.`slug` <> src.`slug`
  AND NOT EXISTS (
    SELECT 1 FROM `article_category_translations` o
    LEFT JOIN `article_category_translations` os ON os.`categoryId` = o.`categoryId` AND os.`locale` = @def
    WHERE o.`locale` = t.`locale` AND o.`slug` = src.`slug` AND o.`categoryId` <> t.`categoryId`
      AND (os.`id` IS NULL OR os.`slug` = o.`slug`));

INSERT INTO `_adr181_slug_moves`
SELECT 'article_tag', t.`id`, t.`tagId`, t.`locale`, t.`slug`, src.`slug`
FROM `article_tag_translations` t
JOIN `article_tag_translations` src ON src.`tagId` = t.`tagId` AND src.`locale` = @def
WHERE t.`locale` <> @def AND t.`slug` <> src.`slug`
  AND NOT EXISTS (
    SELECT 1 FROM `article_tag_translations` o
    LEFT JOIN `article_tag_translations` os ON os.`tagId` = o.`tagId` AND os.`locale` = @def
    WHERE o.`locale` = t.`locale` AND o.`slug` = src.`slug` AND o.`tagId` <> t.`tagId`
      AND (os.`id` IS NULL OR os.`slug` = o.`slug`));

INSERT INTO `_adr181_slug_moves`
SELECT 'glossary_term', t.`id`, t.`termId`, t.`locale`, t.`slug`, src.`slug`
FROM `glossary_term_translations` t
JOIN `glossary_term_translations` src ON src.`termId` = t.`termId` AND src.`locale` = @def
WHERE t.`locale` <> @def AND t.`slug` <> src.`slug`
  AND NOT EXISTS (
    SELECT 1 FROM `glossary_term_translations` o
    LEFT JOIN `glossary_term_translations` os ON os.`termId` = o.`termId` AND os.`locale` = @def
    WHERE o.`locale` = t.`locale` AND o.`slug` = src.`slug` AND o.`termId` <> t.`termId`
      AND (os.`id` IS NULL OR os.`slug` = o.`slug`));

INSERT INTO `_adr181_slug_moves`
SELECT 'glossary_topic', t.`id`, t.`topicId`, t.`locale`, t.`slug`, src.`slug`
FROM `glossary_topic_translations` t
JOIN `glossary_topic_translations` src ON src.`topicId` = t.`topicId` AND src.`locale` = @def
WHERE t.`locale` <> @def AND t.`slug` <> src.`slug`
  AND NOT EXISTS (
    SELECT 1 FROM `glossary_topic_translations` o
    LEFT JOIN `glossary_topic_translations` os ON os.`topicId` = o.`topicId` AND os.`locale` = @def
    WHERE o.`locale` = t.`locale` AND o.`slug` = src.`slug` AND o.`topicId` <> t.`topicId`
      AND (os.`id` IS NULL OR os.`slug` = o.`slug`));

INSERT INTO `_adr181_slug_moves`
SELECT 'course', t.`id`, t.`courseId`, t.`locale`, t.`slug`, src.`slug`
FROM `course_translations` t
JOIN `course_translations` src ON src.`courseId` = t.`courseId` AND src.`locale` = @def
WHERE t.`locale` <> @def AND t.`slug` <> src.`slug`
  AND NOT EXISTS (
    SELECT 1 FROM `course_translations` o
    LEFT JOIN `course_translations` os ON os.`courseId` = o.`courseId` AND os.`locale` = @def
    WHERE o.`locale` = t.`locale` AND o.`slug` = src.`slug` AND o.`courseId` <> t.`courseId`
      AND (os.`id` IS NULL OR os.`slug` = o.`slug`));

INSERT INTO `_adr181_slug_moves`
SELECT 'lesson', t.`id`, t.`lessonId`, t.`locale`, t.`slug`, src.`slug`
FROM `lesson_translations` t
JOIN `lesson_translations` src ON src.`lessonId` = t.`lessonId` AND src.`locale` = @def
WHERE t.`locale` <> @def AND t.`slug` <> src.`slug`
  AND NOT EXISTS (
    SELECT 1 FROM `lesson_translations` o
    LEFT JOIN `lesson_translations` os ON os.`lessonId` = o.`lessonId` AND os.`locale` = @def
    WHERE o.`locale` = t.`locale` AND o.`slug` = src.`slug` AND o.`lessonId` <> t.`lessonId`
      AND (os.`id` IS NULL OR os.`slug` = o.`slug`));

INSERT INTO `_adr181_slug_moves`
SELECT 'quiz', t.`id`, t.`quizId`, t.`locale`, t.`slug`, src.`slug`
FROM `quiz_translations` t
JOIN `quiz_translations` src ON src.`quizId` = t.`quizId` AND src.`locale` = @def
WHERE t.`locale` <> @def AND t.`slug` <> src.`slug`
  AND NOT EXISTS (
    SELECT 1 FROM `quiz_translations` o
    LEFT JOIN `quiz_translations` os ON os.`quizId` = o.`quizId` AND os.`locale` = @def
    WHERE o.`locale` = t.`locale` AND o.`slug` = src.`slug` AND o.`quizId` <> t.`quizId`
      AND (os.`id` IS NULL OR os.`slug` = o.`slug`));

INSERT INTO `_adr181_slug_moves`
SELECT 'video_topic', t.`id`, t.`topicId`, t.`locale`, t.`slug`, src.`slug`
FROM `video_topic_translations` t
JOIN `video_topic_translations` src ON src.`topicId` = t.`topicId` AND src.`locale` = @def
WHERE t.`locale` <> @def AND t.`slug` <> src.`slug`
  AND NOT EXISTS (
    SELECT 1 FROM `video_topic_translations` o
    LEFT JOIN `video_topic_translations` os ON os.`topicId` = o.`topicId` AND os.`locale` = @def
    WHERE o.`locale` = t.`locale` AND o.`slug` = src.`slug` AND o.`topicId` <> t.`topicId`
      AND (os.`id` IS NULL OR os.`slug` = o.`slug`));

INSERT INTO `_adr181_slug_moves`
SELECT 'video_category', t.`id`, t.`categoryId`, t.`locale`, t.`slug`, src.`slug`
FROM `video_category_translations` t
JOIN `video_category_translations` src ON src.`categoryId` = t.`categoryId` AND src.`locale` = @def
WHERE t.`locale` <> @def AND t.`slug` <> src.`slug`
  AND NOT EXISTS (
    SELECT 1 FROM `video_category_translations` o
    LEFT JOIN `video_category_translations` os ON os.`categoryId` = o.`categoryId` AND os.`locale` = @def
    WHERE o.`locale` = t.`locale` AND o.`slug` = src.`slug` AND o.`categoryId` <> t.`categoryId`
      AND (os.`id` IS NULL OR os.`slug` = o.`slug`));

-- ─── Phase 1: park every moving row on a slug nothing else can hold ─────────

UPDATE `article_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'article' AND m.`rowId` = t.`id` SET t.`slug` = CONCAT('~adr181-', t.`id`);
UPDATE `article_category_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'article_category' AND m.`rowId` = t.`id` SET t.`slug` = CONCAT('~adr181-', t.`id`);
UPDATE `article_tag_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'article_tag' AND m.`rowId` = t.`id` SET t.`slug` = CONCAT('~adr181-', t.`id`);
UPDATE `glossary_term_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'glossary_term' AND m.`rowId` = t.`id` SET t.`slug` = CONCAT('~adr181-', t.`id`);
UPDATE `glossary_topic_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'glossary_topic' AND m.`rowId` = t.`id` SET t.`slug` = CONCAT('~adr181-', t.`id`);
UPDATE `course_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'course' AND m.`rowId` = t.`id` SET t.`slug` = CONCAT('~adr181-', t.`id`);
UPDATE `lesson_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'lesson' AND m.`rowId` = t.`id` SET t.`slug` = CONCAT('~adr181-', t.`id`);
UPDATE `quiz_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'quiz' AND m.`rowId` = t.`id` SET t.`slug` = CONCAT('~adr181-', t.`id`);
UPDATE `video_topic_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'video_topic' AND m.`rowId` = t.`id` SET t.`slug` = CONCAT('~adr181-', t.`id`);
UPDATE `video_category_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'video_category' AND m.`rowId` = t.`id` SET t.`slug` = CONCAT('~adr181-', t.`id`);

-- ─── Phase 2: the English slug ──────────────────────────────────────────────

UPDATE `article_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'article' AND m.`rowId` = t.`id` SET t.`slug` = m.`newSlug`;
UPDATE `article_category_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'article_category' AND m.`rowId` = t.`id` SET t.`slug` = m.`newSlug`;
UPDATE `article_tag_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'article_tag' AND m.`rowId` = t.`id` SET t.`slug` = m.`newSlug`;
UPDATE `glossary_term_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'glossary_term' AND m.`rowId` = t.`id` SET t.`slug` = m.`newSlug`;
UPDATE `glossary_topic_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'glossary_topic' AND m.`rowId` = t.`id` SET t.`slug` = m.`newSlug`;
UPDATE `course_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'course' AND m.`rowId` = t.`id` SET t.`slug` = m.`newSlug`;
UPDATE `lesson_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'lesson' AND m.`rowId` = t.`id` SET t.`slug` = m.`newSlug`;
UPDATE `quiz_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'quiz' AND m.`rowId` = t.`id` SET t.`slug` = m.`newSlug`;
UPDATE `video_topic_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'video_topic' AND m.`rowId` = t.`id` SET t.`slug` = m.`newSlug`;
UPDATE `video_category_translations` t JOIN `_adr181_slug_moves` m ON m.`tbl` = 'video_category' AND m.`rowId` = t.`id` SET t.`slug` = m.`newSlug`;

-- ─── 301s from the old translated addresses ─────────────────────────────────
-- A non-default locale always carries its prefix. INSERT IGNORE: an existing
-- redirect from the same path was written by a person and wins.

INSERT IGNORE INTO `redirects` (`id`, `fromPath`, `toPath`, `statusCode`, `isActive`, `hitCount`, `createdAt`, `updatedAt`)
SELECT UUID(),
  CONCAT('/', m.`locale`, CASE m.`tbl`
    WHEN 'article' THEN '/news/'
    WHEN 'article_category' THEN '/news/category/'
    WHEN 'article_tag' THEN '/news/tag/'
    WHEN 'glossary_term' THEN '/glossary/'
    ELSE '/glossary/topics/' END, m.`oldSlug`),
  CONCAT('/', m.`locale`, CASE m.`tbl`
    WHEN 'article' THEN '/news/'
    WHEN 'article_category' THEN '/news/category/'
    WHEN 'article_tag' THEN '/news/tag/'
    WHEN 'glossary_term' THEN '/glossary/'
    ELSE '/glossary/topics/' END, m.`newSlug`),
  301, 1, 0, NOW(3), NOW(3)
FROM `_adr181_slug_moves` m
WHERE m.`tbl` IN ('article', 'article_category', 'article_tag', 'glossary_term', 'glossary_topic');

INSERT IGNORE INTO `redirects` (`id`, `fromPath`, `toPath`, `statusCode`, `isActive`, `hitCount`, `createdAt`, `updatedAt`)
SELECT UUID(),
  CONCAT('/', m.`locale`, '/learn/', c.`track`, '/', m.`oldSlug`),
  CONCAT('/', m.`locale`, '/learn/', c.`track`, '/', m.`newSlug`),
  301, 1, 0, NOW(3), NOW(3)
FROM `_adr181_slug_moves` m JOIN `courses` c ON c.`id` = m.`entityId`
WHERE m.`tbl` = 'course';

INSERT IGNORE INTO `redirects` (`id`, `fromPath`, `toPath`, `statusCode`, `isActive`, `hitCount`, `createdAt`, `updatedAt`)
SELECT UUID(),
  CONCAT('/', m.`locale`, '/learn/', q.`track`, '/quizzes/', m.`oldSlug`),
  CONCAT('/', m.`locale`, '/learn/', q.`track`, '/quizzes/', m.`newSlug`),
  301, 1, 0, NOW(3), NOW(3)
FROM `_adr181_slug_moves` m JOIN `quizzes` q ON q.`id` = m.`entityId`
WHERE m.`tbl` = 'quiz';

INSERT IGNORE INTO `redirects` (`id`, `fromPath`, `toPath`, `statusCode`, `isActive`, `hitCount`, `createdAt`, `updatedAt`)
SELECT UUID(),
  CONCAT('/', m.`locale`, '/learn/', v.`track`, '/videos/', m.`oldSlug`),
  CONCAT('/', m.`locale`, '/learn/', v.`track`, '/videos/', m.`newSlug`),
  301, 1, 0, NOW(3), NOW(3)
FROM `_adr181_slug_moves` m JOIN `video_topics` v ON v.`id` = m.`entityId`
WHERE m.`tbl` = 'video_topic';

-- A lesson's address embeds its course's slug in the same locale, so a lesson
-- moves when EITHER half moved.
INSERT IGNORE INTO `redirects` (`id`, `fromPath`, `toPath`, `statusCode`, `isActive`, `hitCount`, `createdAt`, `updatedAt`)
SELECT UUID(),
  CONCAT('/', lt.`locale`, '/learn/', c.`track`, '/', COALESCE(mc.`oldSlug`, ct.`slug`), '/', COALESCE(ml.`oldSlug`, lt.`slug`)),
  CONCAT('/', lt.`locale`, '/learn/', c.`track`, '/', ct.`slug`, '/', lt.`slug`),
  301, 1, 0, NOW(3), NOW(3)
FROM `lesson_translations` lt
JOIN `lessons` l ON l.`id` = lt.`lessonId`
JOIN `course_sections` s ON s.`id` = l.`sectionId`
JOIN `courses` c ON c.`id` = s.`courseId`
JOIN `course_translations` ct ON ct.`courseId` = c.`id` AND ct.`locale` = lt.`locale`
LEFT JOIN `_adr181_slug_moves` ml ON ml.`tbl` = 'lesson' AND ml.`rowId` = lt.`id`
LEFT JOIN `_adr181_slug_moves` mc ON mc.`tbl` = 'course' AND mc.`rowId` = ct.`id`
WHERE lt.`locale` <> @def AND (ml.`rowId` IS NOT NULL OR mc.`rowId` IS NOT NULL);

DROP TABLE `_adr181_slug_moves`;
