-- Affiliate link tracker schema (matches design spec 2026-05-09)

CREATE TABLE IF NOT EXISTS videos (
  video_code   TEXT PRIMARY KEY,
  video_title  TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
  slug         TEXT PRIMARY KEY,
  video_code   TEXT NOT NULL,
  tool         TEXT NOT NULL,
  target_url   TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (video_code) REFERENCES videos(video_code)
);
CREATE INDEX IF NOT EXISTS idx_links_video_code ON links(video_code);

CREATE TABLE IF NOT EXISTS clicks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL,
  clicked_at   INTEGER NOT NULL,
  ip_hash      TEXT,
  ua_hash      TEXT,
  referer      TEXT
);
CREATE INDEX IF NOT EXISTS idx_clicks_slug_ts ON clicks(slug, clicked_at);
