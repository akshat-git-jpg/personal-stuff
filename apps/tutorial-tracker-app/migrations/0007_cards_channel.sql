-- Which YouTube channel a card's video is for. Until now every card was implicitly
-- @AgrolloReviews.
--
-- Channel is deliberately a COLUMN, not a new PipelineDef: a "system" here is a
-- workflow (which stages exist, who reviews), and every channel runs the same
-- workflows. Cloning standard.ts per channel would duplicate the stage list, the role
-- roster and the access grid, and every future stage fix would need applying N times.
--
-- Ids come from config/channels.json. 'agrollo' = @AgrolloReviews.
-- Additive and nullable so a read path that predates this column keeps working.

ALTER TABLE cards ADD COLUMN channel_id TEXT;

UPDATE cards SET channel_id = 'agrollo' WHERE channel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cards_channel ON cards(channel_id);
