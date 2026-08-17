-- 2026-08-17 — each cloth/look becomes a catalogue of photos.
--
-- Before: `clothes.photo_key` / `looks.photo_key` held ONE R2 object key.
-- After:  a `photos` table holds any number of rows per item, ordered by
--         `position`, with position 0 as the cover.
--
-- Run ONCE per already-provisioned database:
--   npx wrangler d1 execute closet-db --remote --file=./migrations/2026-08-17-photos.sql
--
-- A fresh database does not need this — schema.sql is already the new shape.
-- Safe on the production DB as run on 2026-08-17 because it held 0 clothes and
-- 0 looks; on a populated DB the backfill below is what preserves the photos,
-- so keep it ahead of the column drops.

CREATE TABLE IF NOT EXISTS photos (
  id         TEXT    PRIMARY KEY,
  item_type  TEXT    NOT NULL,
  item_id    TEXT    NOT NULL,
  r2_key     TEXT    NOT NULL,
  position   INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photos_item ON photos(item_type, item_id, position);

-- Backfill: carry any existing single photo over as that item's cover.
-- `lower(hex(randomblob(16)))` stands in for a UUID — D1 has no uuid() function
-- and these ids are never shown to a user.
INSERT INTO photos (id, item_type, item_id, r2_key, position, created_at)
SELECT lower(hex(randomblob(16))), 'cloth', id, photo_key, 0, created_at
FROM clothes WHERE photo_key IS NOT NULL AND photo_key <> '';

INSERT INTO photos (id, item_type, item_id, r2_key, position, created_at)
SELECT lower(hex(randomblob(16))), 'look', id, photo_key, 0, created_at
FROM looks WHERE photo_key IS NOT NULL AND photo_key <> '';

-- Now the column is redundant. SQLite (and D1) support DROP COLUMN.
ALTER TABLE clothes DROP COLUMN photo_key;
ALTER TABLE looks   DROP COLUMN photo_key;
