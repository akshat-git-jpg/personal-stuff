-- Tags are a tree: every payment points at one tag, and a tag's total includes everything below it.
-- `key` is the path the sync sends ("trip/varkala/food"); it never changes, so a renamed or
-- moved tag keeps receiving the sync's payments. Tags the owner makes in the app have no key.

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL,
  key TEXT UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tags_parent ON tags(parent_id);

-- The owner's edits now point at a tag; the old `tags` lists are converted on the next sync.
ALTER TABLE overrides ADD COLUMN tag_id TEXT;
ALTER TABLE rules ADD COLUMN tag_id TEXT;
