import fs from 'node:fs';
import path from 'node:path';

// REVIEW 3. The owner approves the assembled cut before it becomes a
// deliverable. Until 2026-07-29 the Final Cut tab collected comments but
// gated nothing, so a video could reach full resolution and be exported with
// the owner's notes untriaged.
export const FINAL_CUT_FILE = 'final-cut.json';

export function readFinalCut(workdir) {
  const p = path.join(workdir, FINAL_CUT_FILE);
  if (!fs.existsSync(p)) return { approved: false, exists: false };
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  return { approved: d.approved === true, exists: true, version: d.version ?? null };
}

// Approval is per VERSION: a new cut is a new thing to look at, so approving
// v3 must not silently bless v4.
export function isApprovedFor(workdir, version) {
  const fc = readFinalCut(workdir);
  return fc.approved && fc.version === version;
}
