-- ADR-155: the learner's birthday and postal address, all optional.
ALTER TABLE `user`
    ADD COLUMN `birthDate` DATE NULL,
    ADD COLUMN `addressLine1` VARCHAR(200) NULL,
    ADD COLUMN `addressLine2` VARCHAR(200) NULL,
    ADD COLUMN `city` VARCHAR(100) NULL,
    ADD COLUMN `region` VARCHAR(100) NULL,
    ADD COLUMN `postalCode` VARCHAR(20) NULL,
    ADD COLUMN `country` VARCHAR(2) NULL;
