-- Adds exercise.starred to an EXISTING database. schema.sql declares it inline
-- for fresh ones, and its CREATE TABLE IF NOT EXISTS skips a live table.
-- Run once; a second run errors with "duplicate column name".
--   npx wrangler d1 execute gym-db --local  --file=./migrations/212-starred-column.sql
--   npx wrangler d1 execute gym-db --remote --file=./migrations/212-starred-column.sql

ALTER TABLE exercise ADD COLUMN starred INTEGER NOT NULL DEFAULT 0;
