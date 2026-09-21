-- changes-33 / ADR-110: legal documents.
--
-- Two parts, in this order because the second depends on the first.
--
-- 1. `SettingType` gains DOCUMENT. MariaDB stores a Prisma enum as a column
--    ENUM, so widening it is an ALTER on the one column that uses it.
--    Appending at the END of the member list is what makes this safe: MariaDB
--    stores an ENUM as the member's ORDINAL, so inserting a value in the
--    middle would silently re-label every existing row.
ALTER TABLE `settings`
  MODIFY `type` ENUM('STRING', 'TEXT', 'NUMBER', 'BOOLEAN', 'JSON', 'IMAGE', 'COLOR', 'SELECT', 'DOCUMENT') NOT NULL DEFAULT 'STRING';

-- 2. The legal COPY an existing database is already carrying.
--
--    A DATA migration, and the fourth in this series for the reason the three
--    before it spell out: the settings upsert's `update` clause deliberately
--    never touches `value`, so changing a seeded default reaches a FRESH
--    install only.
--
--    Bounded the same way they are — each `WHERE` matches only a row still
--    holding the value Module 08 seeded. An admin who has written their own
--    disclaimer or copyright line is matched by nothing here. The new keys
--    (`legal.companyRegistration`, `legal.registeredAddress`, and the three
--    document paths) need no statement at all: they do not exist yet, so the
--    seed's `create` branch writes them.
--
--    `\n\n` is a real newline pair inside a MariaDB string literal, and
--    `JSON_QUOTE` re-escapes it on the way into the JSON column — the footer
--    splits the value on blank lines to get the reference's two paragraphs.
--
--    Idempotent: running it twice changes nothing the second time.
UPDATE `settings`
SET `value` = JSON_QUOTE('Trading Contracts for Difference (CFDs) and spread bets involves a high level of risk due to the use of leverage. These instruments may not be suitable for all investors, as they can result in rapid losses as well as potential gains. Before trading with MBFX Global Limited ("MBFX"), please ensure that you fully understand how CFDs and spread bets work and carefully consider whether you can afford to take the high risk of losing your money.\n\nMBFX Global Limited is incorporated in Saint Lucia under registration number 2023-00532. In line with its commitment to regulatory compliance and due diligence, MBFX adheres to international KYC standards and may not be able to extend certain services in jurisdictions where local regulations restrict such activities. These regions currently include Australia, the United States, Brazil, Curaçao, Indonesia, Sint Eustatius, Tahiti, Saipan, Turkey, Guinea-Bissau, Japan, Bonaire, East Timor, Liberia, Micronesia, Northern Mariana Islands, Jan Mayen, South Sudan, Svalbard, the UAE, and other regions with similar restrictions. For more details, please review our Privacy Policy.')
WHERE `key` = 'legal.riskDisclaimer'
  AND JSON_UNQUOTE(JSON_EXTRACT(`value`, '$')) = 'All content is educational and does not constitute financial advice. Trading carries risk, and you may lose more than your initial deposit. Past performance does not indicate future results.';

UPDATE `settings`
SET `value` = JSON_QUOTE('© {year} MBFX Global Limited. All rights reserved.')
WHERE `key` = 'legal.copyrightNotice'
  AND JSON_UNQUOTE(JSON_EXTRACT(`value`, '$')) = '© {year} MBX Pro. All rights reserved.';
