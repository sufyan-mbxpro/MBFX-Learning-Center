-- changes-49 (ADR-147): a course carries its own FAQ, per translation, in the
-- shape `glossary_term_translations.faq` already uses. Nullable: every
-- existing course simply has none until an editor adds some.
ALTER TABLE `course_translations` ADD COLUMN `faq` JSON NULL;
