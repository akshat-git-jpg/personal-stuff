import fs from 'node:fs';
import path from 'node:path';

// Every cheap review in this pipeline used to print to stdout and write nothing
// (plan 196). Three consequences, all bad: lib/steps.mjs refuses to declare a
// step with no artifact, so the reviews could not join the registry; the run
// ledger could not record that a review happened; and a result you cannot
// re-read is a result you cannot be asked to act on.
//
// One shape for all of them: videos/<slug>/checks/<name>.json.
export const CHECKS_DIR = 'checks';

export function checkReportPath(workdir, name) {
  return path.join(workdir, CHECKS_DIR, `${name}.json`);
}

// `errors` blocks; `warnings` inform. `ok` is derived, never passed in — a
// caller that computes its own ok can disagree with its own error list.
export function writeCheckReport(workdir, name, { errors = [], warnings = [], notes = {} } = {}) {
  const report = {
    check: name,
    ok: errors.length === 0,
    errors,
    warnings,
    notes,
  };
  const out = checkReportPath(workdir, name);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  return report;
}

export function readCheckReport(workdir, name) {
  const p = checkReportPath(workdir, name);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}
