-- video-review lives in tracker-db; every table is prefixed vr_ so it never touches the tracker's tables.

CREATE TABLE vr_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  final_version_id TEXT,
  final_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE vr_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES vr_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  duration REAL NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  upload_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('uploading', 'ready', 'removed')),
  created_at INTEGER NOT NULL
);
CREATE INDEX vr_versions_project ON vr_versions(project_id, created_at);

CREATE TABLE vr_parts (
  version_id TEXT NOT NULL REFERENCES vr_versions(id) ON DELETE CASCADE,
  n INTEGER NOT NULL,
  etag TEXT NOT NULL,
  size INTEGER NOT NULL,
  PRIMARY KEY (version_id, n)
);

CREATE TABLE vr_notes (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES vr_versions(id) ON DELETE CASCADE,
  t REAL NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX vr_notes_version ON vr_notes(version_id, t);
