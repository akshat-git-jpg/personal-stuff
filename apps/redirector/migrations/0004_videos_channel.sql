-- Labels each tracked video with the channel it belongs to, so click and revenue
-- reporting can be split per channel. Until now `videos` had no channel column at
-- all and every row was implicitly @AgrolloReviews.
--
-- Additive and nullable, per the redirector's schema contract (see 0002's header):
-- analytics-app reads this table and must keep working without knowing about the
-- column. The backfill below is what makes NULL unreachable in practice; a row
-- created by an older code path would still be legal.
--
-- Channel ids come from config/channels.json. 'agrollo' = @AgrolloReviews.
--
-- NOTE: video_code stays globally unique across all channels. generateVideoCode()
-- checks candidates against the whole table, so no per-channel prefix is needed and
-- none must be added — published short URLs are immutable.

ALTER TABLE videos ADD COLUMN channel_id TEXT;

UPDATE videos SET channel_id = 'agrollo' WHERE channel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id);
