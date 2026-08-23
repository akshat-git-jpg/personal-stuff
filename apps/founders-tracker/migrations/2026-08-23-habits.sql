-- One-shot migration for Plan 236: habits stop being tasks.
--
-- Run ONCE per environment, AFTER `npm run db:local` / `npm run db:remote` has
-- created habit_logs:
--   npx wrangler d1 execute founders-db --local  --file=migrations/2026-08-23-habits.sql
--   npx wrangler d1 execute founders-db --remote --file=migrations/2026-08-23-habits.sql
--
-- Every statement is idempotent, so a second run is a no-op.
--
-- Step A: preserve history. A DONE daily instance means that day was kept, so
-- it becomes a habit_logs row. `period_key` for a daily template IS the day,
-- which is also the anchor. Weekly period keys ('2026-W35') cannot be turned
-- back into a Monday in SQL, and no weekly template exists yet (verified
-- 2026-08-23), so weekly done rows are intentionally NOT converted.
INSERT OR IGNORE INTO habit_logs (template_id, anchor_ymd, done_at)
SELECT t.template_id,
       t.period_key,
       COALESCE(t.completed_at, t.created_at)
FROM tasks t
JOIN recurring_templates r ON r.id = t.template_id
WHERE r.cadence = 'daily'
  AND t.status = 'done'
  AND t.period_key IS NOT NULL;

-- Step B: habits leave the task table entirely — open instances (noise) and
-- done ones (now streak history) alike. This also removes them from the
-- on-time scoreboard, which is correct: habits earn streaks, tasks earn
-- on-time percentage.
DELETE FROM tasks
WHERE template_id IN (SELECT id FROM recurring_templates WHERE cadence IN ('daily', 'weekly'));
