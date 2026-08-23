CREATE TABLE IF NOT EXISTS videos (
  key         TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  beats_json  TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  finished    INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS answers (
  video_key TEXT NOT NULL,
  beat_num  TEXT NOT NULL,
  text      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (video_key, beat_num)
);

CREATE TABLE IF NOT EXISTS say_edits (
  video_key TEXT NOT NULL,
  beat_num  TEXT NOT NULL,
  original_json TEXT NOT NULL,
  lines_json    TEXT NOT NULL,
  edited_at TEXT NOT NULL,
  PRIMARY KEY (video_key, beat_num)
);

CREATE INDEX IF NOT EXISTS idx_videos_token ON videos(token);
