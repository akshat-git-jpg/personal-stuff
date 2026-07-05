CREATE TABLE IF NOT EXISTS card_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  type TEXT NOT NULL,          -- start | submit | approve | sendback | reopen | complete
  actor TEXT NOT NULL,         -- email
  detail TEXT,                 -- feedback text for sendback/reopen; else NULL
  created_at TEXT NOT NULL     -- ISO
);
CREATE INDEX IF NOT EXISTS idx_card_events_card ON card_events (card_id, id);
