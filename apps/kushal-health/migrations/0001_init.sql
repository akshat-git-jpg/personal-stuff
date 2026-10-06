CREATE TABLE reports (
  id TEXT PRIMARY KEY,               -- e.g. 2025-01-15-citylab-ab12345
  collected_on TEXT NOT NULL,        -- YYYY-MM-DD
  lab TEXT NOT NULL,
  source_file TEXT NOT NULL,         -- original file name, e.g. LABREPORT.pdf
  verdict TEXT NOT NULL DEFAULT '',  -- Claude's plain verdict, written at ingest
  pdf_key TEXT,                      -- R2 key once the PDF is uploaded
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE markers (
  key TEXT PRIMARY KEY,              -- canonical, e.g. tsh, hba1c, ldl
  name TEXT NOT NULL,                -- display name
  panel TEXT NOT NULL,               -- one of PANELS in src/shared/types.ts
  unit TEXT NOT NULL DEFAULT ''
);
CREATE TABLE results (
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  marker_key TEXT NOT NULL REFERENCES markers(key),
  name_on_report TEXT NOT NULL,
  value_text TEXT NOT NULL,          -- exactly as printed: "5.6", "<1.3", "Non Reactive"
  value_num REAL,                    -- null for qualitative values
  qualifier TEXT,                    -- "<", "<=", ">", ">=" or null
  unit TEXT NOT NULL DEFAULT '',
  ref_text TEXT NOT NULL DEFAULT '', -- exactly as printed: "0.4 - 4.0", "<4.00", "Non Reactive"
  ref_low REAL,
  ref_high REAL,
  PRIMARY KEY (report_id, marker_key)
);
CREATE INDEX results_marker ON results(marker_key);
