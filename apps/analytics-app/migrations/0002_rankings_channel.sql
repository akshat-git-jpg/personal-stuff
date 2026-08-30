-- Which channel a tracked keyword belongs to, so the Rankings tab can scope to the
-- selected channel. Until now every keyword was implicitly @AgrolloReviews.
--
-- Additive and nullable. The UNIQUE (yt_video_id, keyword) constraint deliberately
-- does NOT change: a YouTube video id belongs to exactly one channel, so channel_id
-- here is a filter, not part of identity. Rebuilding the table to widen the key would
-- risk the rank_checks foreign key for no gain.
--
-- Channel ids come from config/channels.json. 'agrollo' = @AgrolloReviews.

ALTER TABLE keywords ADD COLUMN channel_id TEXT;

UPDATE keywords SET channel_id = 'agrollo' WHERE channel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_keywords_channel ON keywords (channel_id, yt_video_id);
