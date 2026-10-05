-- Video codes whose YouTube description the guard read on that run (JSON array). NULL = not checked.
ALTER TABLE link_checks ADD COLUMN desc_checked_json TEXT;
