CREATE TABLE videos (
  slug TEXT PRIMARY KEY,
  script_json TEXT NOT NULL,       -- the published script.json, verbatim
  drive_url TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE TABLE sections (
  slug TEXT NOT NULL,
  id TEXT NOT NULL,                -- s01..
  version INTEGER NOT NULL,        -- section.version at publish time
  demo INTEGER NOT NULL,           -- 0/1
  spoken_text TEXT NOT NULL,       -- live copy (respell edits land here)
  takes_used INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  take_key TEXT,                   -- R2 key of the current take
  updated_at TEXT NOT NULL,
  PRIMARY KEY (slug, id)
);
