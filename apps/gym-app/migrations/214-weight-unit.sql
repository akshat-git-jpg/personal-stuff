-- Adds the per-exercise weight unit, and stamps every logged set with the unit
-- it was recorded in. schema.sql declares both inline for fresh databases.
-- Run once; a second run errors with "duplicate column name".
--   npx wrangler d1 execute gym-db --local  --file=./migrations/214-weight-unit.sql
--   npx wrangler d1 execute gym-db --remote --file=./migrations/214-weight-unit.sql
--
-- Every existing row is kg, which is the default, so there is no backfill.

ALTER TABLE exercise ADD COLUMN unit TEXT NOT NULL DEFAULT 'kg';
ALTER TABLE log      ADD COLUMN unit TEXT NOT NULL DEFAULT 'kg';
