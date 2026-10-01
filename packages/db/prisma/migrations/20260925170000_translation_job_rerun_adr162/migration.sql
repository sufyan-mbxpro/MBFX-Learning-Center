-- ADR-162 #2 (amended): a job enqueued while RUNNING is marked to run again,
-- so an edit saved between the job's write and its DONE is never lost.

-- AlterTable
ALTER TABLE `translation_jobs` ADD COLUMN `rerun` BOOLEAN NOT NULL DEFAULT false;

