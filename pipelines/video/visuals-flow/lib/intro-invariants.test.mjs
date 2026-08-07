import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lintCues } from './lint-cues.mjs';
import { ZONE_PARTS } from './zone-constants.mjs';
import { introSpan } from './intro-modes.mjs';

// Replaces lib/regression-cards.test.mjs, which asserted the intro:"cards" path
// stayed untouched. That path is gone (plan 194): the intro is ALWAYS the
// bespoke film. These are the invariants that replace it — every assertion
// message carries INTRO-ALWAYS-FILM so a failure names the decision it broke.

function tmpWorkdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'intro-invariants-'));
}

const STRUCTURE = [
  { part: 'intro', start: 0, end: 10 },
  { part: 'body', start: 10, end: 20 },
  { part: 'conclusion', start: 20, end: 30 },
];

function lintInputs(workdir) {
  const cues = [{ id: 'z1', placement: 'fullframe', start: 12, duration: 2, card: 'body/thing' }];
  return {
    workdir,
    cuesFile: { cues, approved: true },
    resolved: cues,
    words: [],
    catalog: { cards: {} },
    segmentsData: { structure: STRUCTURE },
    manifest: { base: 'screen' },
    conceptData: null,
    avatarJobs: null,
  };
}

test('INTRO-ALWAYS-FILM: the cue passes author the conclusion only', () => {
  assert.deepEqual(ZONE_PARTS, ['conclusion'],
    'INTRO-ALWAYS-FILM: ZONE_PARTS must be ["conclusion"] — the film owns the intro span');
});

test('INTRO-ALWAYS-FILM: E13 open-cover never fires — the film covers second zero', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'segments.json'), JSON.stringify({ structure: STRUCTURE }));
  // No fullframe cue anywhere near t=0, and no avatar span. Under the old
  // cards flow this was an E13 error; the film makes it correct.
  const report = lintCues(lintInputs(w));
  const e13 = (report.errors ?? []).filter((e) => String(e).includes('E13'));
  assert.deepEqual(e13, [],
    `INTRO-ALWAYS-FILM: E13 open-cover must never fire — the intro film covers second zero, got ${JSON.stringify(e13)}`);
  fs.rmSync(w, { recursive: true, force: true });
});

test('INTRO-ALWAYS-FILM: introSpan reads the measured intro from segments.json', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'segments.json'), JSON.stringify({ structure: STRUCTURE }));
  assert.deepEqual(introSpan(w), { start: 0, end: 10 },
    'INTRO-ALWAYS-FILM: introSpan must return the measured intro part');
  fs.rmSync(w, { recursive: true, force: true });
});

test('INTRO-ALWAYS-FILM: introSpan is null before segments.json exists', () => {
  const w = tmpWorkdir();
  assert.equal(introSpan(w), null,
    'INTRO-ALWAYS-FILM: introSpan must return null when segments.json is absent, never throw');
  fs.rmSync(w, { recursive: true, force: true });
});

test('INTRO-ALWAYS-FILM: no run-config knob can turn the film off', async () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'cards', review: 'express' }));
  const m = await import('./run-config.mjs');
  const cfg = m.loadRunConfig(w);
  assert.equal(cfg.intro, undefined,
    'INTRO-ALWAYS-FILM: run-config must not resolve an `intro` mode — stale keys in old videos are ignored, never honoured');
  assert.equal('gateWaived' in m, false,
    'INTRO-ALWAYS-FILM: express review is gone — gateWaived must not exist');
  fs.rmSync(w, { recursive: true, force: true });
});
