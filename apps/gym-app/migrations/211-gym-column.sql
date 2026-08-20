-- One-off backfill of exercise.gym from the tab name. Idempotent, so it is safe
-- to re-run. Apply by hand after seeding:
--   npx wrangler d1 execute gym-db --local  --file=./migrations/211-gym-column.sql
--   npx wrangler d1 execute gym-db --remote --file=./migrations/211-gym-column.sql
--
-- The column itself is declared inline in schema.sql (never as an ALTER there --
-- that made db:remote fail on a second run).

UPDATE exercise SET gym = 'anu'  WHERE tab = 'Anu Gym';
UPDATE exercise SET gym = 'home' WHERE tab = 'Home Gym';
UPDATE exercise SET gym = 'main' WHERE tab NOT IN ('Anu Gym', 'Home Gym');
