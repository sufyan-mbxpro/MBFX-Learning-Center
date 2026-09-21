-- ADR-144 §2: a video topic may be LISTED under every school.
-- Additive only. The default keeps every existing topic listed under its own
-- track alone, exactly as before; `track` stays the canonical URL segment.
ALTER TABLE `video_topics` ADD COLUMN `showOnAllTracks` BOOLEAN NOT NULL DEFAULT false;
