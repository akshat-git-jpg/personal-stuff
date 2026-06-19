-- Keyword rank tracking for the YT Analytics app (its OWN database, RANKINGS_DB).
-- Unrelated to the redirector's clicks-db. This app reads + writes here.

-- One row per (video, keyword) the user is tracking.
CREATE TABLE IF NOT EXISTS keywords (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  yt_video_id TEXT NOT NULL,
  keyword     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE (yt_video_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_keywords_video ON keywords (yt_video_id);

-- One row per rank check. History = appended rows, never overwritten.
-- rank is the 1-based position when found; when the video wasn't in the top
-- results, not_in_top = 1 and rank holds the search depth that was scanned.
CREATE TABLE IF NOT EXISTS rank_checks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id INTEGER NOT NULL REFERENCES keywords (id) ON DELETE CASCADE,
  rank       INTEGER,
  not_in_top INTEGER NOT NULL DEFAULT 0,
  checked_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rank_checks_keyword ON rank_checks (keyword_id, checked_at);
