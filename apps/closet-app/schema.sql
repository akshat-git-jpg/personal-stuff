-- closet-app schema. Idempotent — safe to re-run.
--
-- No wash limit and no threshold flag: a garment carries a raw wear count and
-- the owner decides when to wash it (design decision, 2026-08-17).
-- `looks` is a plain tagged gallery — it deliberately has NO link to `clothes`.

CREATE TABLE IF NOT EXISTS clothes (
  id             TEXT    PRIMARY KEY,
  name           TEXT    NOT NULL,
  wears          INTEGER NOT NULL DEFAULT 0, -- wears since the last wash
  last_worn_at   INTEGER,                    -- ms epoch, NULL if never worn
  last_washed_at INTEGER,                    -- ms epoch, NULL if never washed
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS looks (
  id         TEXT    PRIMARY KEY,
  name       TEXT,                           -- optional; a look may be photos + tags only
  created_at INTEGER NOT NULL
);

-- Every cloth and every look is a CATALOGUE: it holds any number of photos
-- (front, back, worn, different angles). `position` orders them and position 0
-- is the cover shown on the grid tile — "cover" is not a separate flag, so the
-- two can never disagree (owner decision, 2026-08-17).
--
-- Replaced the single `photo_key` column that clothes/looks used to carry;
-- see migrations/2026-08-17-photos.sql for the one-off column drop.
CREATE TABLE IF NOT EXISTS photos (
  id         TEXT    PRIMARY KEY,
  item_type  TEXT    NOT NULL,               -- 'cloth' | 'look'
  item_id    TEXT    NOT NULL,
  r2_key     TEXT    NOT NULL,               -- object key in the closet-photos bucket
  position   INTEGER NOT NULL,               -- 0 = cover
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photos_item ON photos(item_type, item_id, position);

-- One shared tag vocabulary across BOTH tabs. `name` is normalised
-- (trimmed, lowercased, inner whitespace collapsed) before it is stored.
CREATE TABLE IF NOT EXISTS tags (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Many-to-many: one photo can carry any number of tags.
CREATE TABLE IF NOT EXISTS item_tags (
  item_type TEXT NOT NULL,                   -- 'cloth' | 'look'
  item_id   TEXT NOT NULL,
  tag_id    TEXT NOT NULL,
  PRIMARY KEY (item_type, item_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag_id);

-- Append-only-ish log of wear/wash taps. This is what powers Undo:
-- `prev_wears` is the count BEFORE the event, so reversing it is exact
-- (a wash-undo restores the real number instead of guessing).
CREATE TABLE IF NOT EXISTS events (
  id         TEXT    PRIMARY KEY,
  cloth_id   TEXT    NOT NULL,
  type       TEXT    NOT NULL,               -- 'wear' | 'wash'
  prev_wears INTEGER NOT NULL,
  at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_cloth ON events(cloth_id, at);
