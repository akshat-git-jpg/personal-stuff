-- Exercise names are stored in capitals from now on (the worker uppercases on write).
-- Run on each remote DB: gym-db, and sparkly-gym-db with --env sparkly.
UPDATE exercise SET name = UPPER(TRIM(name)) WHERE name <> UPPER(TRIM(name));
