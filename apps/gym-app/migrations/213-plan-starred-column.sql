-- Moves the favourite flag from `exercise` to `plan`, so a star belongs to one
-- (day, exercise) pair rather than the exercise everywhere. schema.sql declares
-- it inline for fresh databases.
-- Run once; a second run errors with "duplicate column name".
--   npx wrangler d1 execute gym-db --local  --file=./migrations/213-plan-starred-column.sql
--   npx wrangler d1 execute gym-db --remote --file=./migrations/213-plan-starred-column.sql

ALTER TABLE plan ADD COLUMN starred INTEGER NOT NULL DEFAULT 0;
UPDATE plan SET starred = 1 WHERE exercise_id IN (SELECT id FROM exercise WHERE starred = 1);
ALTER TABLE exercise DROP COLUMN starred;
