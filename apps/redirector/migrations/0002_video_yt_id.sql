-- Adds the YouTube video id to each tracked video so the analytics app can
-- fetch live view counts. Nullable; the redirector itself does not use it.
ALTER TABLE videos ADD COLUMN yt_video_id TEXT;
