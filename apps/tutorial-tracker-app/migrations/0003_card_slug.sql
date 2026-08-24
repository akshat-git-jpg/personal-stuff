-- The canonical video identity, minted once at card creation and never edited.
-- Nullable: cards created before this migration have no slug until backfilled.
ALTER TABLE cards ADD COLUMN slug TEXT;

-- Unique across non-null values only, so existing NULL rows do not collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_slug ON cards (slug) WHERE slug IS NOT NULL;
