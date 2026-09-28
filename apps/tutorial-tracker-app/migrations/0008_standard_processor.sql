-- Standard gains a Processing stage (Recording -> Processing -> Editing), and its
-- Scriptwriter + Recorder roles merge into one "Script Recorder" role.

-- Cards already past Recording must not stall at the new stage.
INSERT OR IGNORE INTO card_stages (card_id, stage_id, status, status_since)
SELECT c.id, 'processing', 'Done', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM cards c
JOIN card_stages r ON r.card_id = c.id AND r.stage_id = 'recording'
WHERE c.pipeline_id = 'standard' AND r.status = 'Done';

-- Standard-only rename; tut-2 still has its own Scriptwriter. The placeholder
-- stops the bare 'Recorder' replace from hitting 'Script Recorder'.
UPDATE employees SET role =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(role,
    'Script Recorder', '~SR~'),
    'Scriptwriter', '~SR~'),
    'Recorder', '~SR~'),
    '~SR~, ~SR~', '~SR~'),
    '~SR~,~SR~', '~SR~'),
    '~SR~', 'Script Recorder')
WHERE system_id = 'standard' AND (role LIKE '%Scriptwriter%' OR role LIKE '%Recorder%');
