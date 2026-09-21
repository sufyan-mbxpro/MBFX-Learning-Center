-- ADR-124: record WHO unsubscribed an address, so an admin's "Resubscribe"
-- can tell undoing its own action apart from overriding a reader who withdrew
-- consent. Nullable, no backfill: a row unsubscribed before this migration
-- reads as the reader's own unsubscribe, which is the safe direction.
ALTER TABLE `newsletter_subscribers` ADD COLUMN `unsubscribedVia` VARCHAR(16) NULL;
