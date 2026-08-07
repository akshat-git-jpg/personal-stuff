import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeCheckReport, readCheckReport, checkReportPath } from './checks.mjs';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'vf-checks-')); }

test('a review writes an artifact', () => {
  const w = tmp();
  writeCheckReport(w, 'cue-plan', { errors: [], warnings: ['W1 something'] });
  assert.ok(fs.existsSync(checkReportPath(w, 'cue-plan')),
    'REVIEW-LEAVES-NO-ARTIFACT: a review must write checks/<name>.json — a result that exists only in terminal scrollback cannot be recorded, re-read, or required');
  fs.rmSync(w, { recursive: true, force: true });
});

test('ok is derived from errors, never asserted by the caller', () => {
  const w = tmp();
  writeCheckReport(w, 'a', { errors: ['E1'], warnings: [] });
  assert.equal(readCheckReport(w, 'a').ok, false,
    'REVIEW-LEAVES-NO-ARTIFACT: a report with errors must not be ok');
  writeCheckReport(w, 'b', { errors: [], warnings: ['W1'] });
  assert.equal(readCheckReport(w, 'b').ok, true,
    'REVIEW-LEAVES-NO-ARTIFACT: warnings alone must not fail a review');
  fs.rmSync(w, { recursive: true, force: true });
});

test('readCheckReport returns null rather than throwing when absent or corrupt', () => {
  const w = tmp();
  assert.equal(readCheckReport(w, 'missing'), null);
  fs.mkdirSync(path.join(w, 'checks'), { recursive: true });
  fs.writeFileSync(checkReportPath(w, 'corrupt'), '{not json');
  assert.equal(readCheckReport(w, 'corrupt'), null);
  fs.rmSync(w, { recursive: true, force: true });
});
