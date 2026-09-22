-- ADR-152: SendGrid becomes a driver of its own (v3 Web API) so a send can
-- carry `mail_settings.sandbox_mode`, which SendGrid honours on no SMTP path.
ALTER TABLE `email_transport`
    MODIFY `driver` ENUM('SMTP', 'SENDGRID', 'LOG') NOT NULL DEFAULT 'LOG',
    ADD COLUMN `sandboxMode` BOOLEAN NOT NULL DEFAULT false;

-- changes-49 stored SendGrid as an SMTP row with SendGrid's fixed host and the
-- literal username `apikey`, the key in `passwordCipher`. That key is also a
-- v3 API key, so the row moves across unchanged in every column but the
-- driver. Bounded to exactly that shape: a hand-configured SMTP row pointing
-- anywhere else is not SendGrid and is left alone.
UPDATE `email_transport`
SET `driver` = 'SENDGRID', `lastVerifiedAt` = NULL, `lastError` = NULL
WHERE `driver` = 'SMTP' AND `host` = 'smtp.sendgrid.net' AND `username` = 'apikey';
