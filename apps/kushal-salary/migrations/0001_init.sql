CREATE TABLE salary_months (
  month TEXT PRIMARY KEY,              -- YYYY-MM, the payslip month
  designation TEXT NOT NULL,           -- job title printed on the payslip
  gross INTEGER NOT NULL,              -- rupees, whole numbers
  net INTEGER NOT NULL,
  deductions INTEGER NOT NULL,
  source_file TEXT NOT NULL,           -- original PDF base name
  pdf_key TEXT,                        -- R2 key once the PDF is uploaded
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE salary_items (
  month TEXT NOT NULL REFERENCES salary_months(month) ON DELETE CASCADE,
  pos INTEGER NOT NULL,                -- order on the payslip
  label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fixed', 'variable')),
  monthly INTEGER NOT NULL,
  arrears INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  PRIMARY KEY (month, pos)
);
CREATE TABLE salary_notes (
  id TEXT PRIMARY KEY,                 -- a-z0-9- only, e.g. 2026-05-13-appraisal-letter
  date TEXT NOT NULL,                  -- YYYY-MM-DD
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '', -- e.g. the Gmail thread link
  source_file TEXT NOT NULL DEFAULT '',
  pdf_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
