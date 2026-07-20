import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseMmss,
  parseAssembly,
  expectedForCut,
  planQcEvents,
  checklistMd,
} from './qc-plan.mjs';

const FIXTURE_PATH = path.resolve(import.meta.dirname, '..', 'tests', 'fixtures', 'qc-assembly-test-01.md');
const FIXTURE_MD = fs.readFileSync(FIXTURE_PATH, 'utf8');

test('parseMmss', () => {
  assert.ok(Math.abs(parseMmss('00:57.5') - 57.5) < 1e-9);
  assert.ok(Math.abs(parseMmss('29:12.1') - 1752.1) < 1e-9);
  assert.throws(() => parseMmss('xx'), /bad mmss/);
});

test('parseAssembly on the fixture', () => {
  const { segments, overlays, transitions } = parseAssembly(FIXTURE_MD);
  assert.equal(segments.length, 35);
  assert.equal(overlays.length, 9);
  assert.equal(transitions.length, 15);
  assert.deepEqual(segments[0], { start: 0, end: 57.5, kind: 'avatar', id: 's01' });
  assert.equal(overlays[0].file, '0239-c04-stat-hit.mov');
  assert.equal(transitions[0].at, 57.5);
});

test('parseAssembly without transitions section', () => {
  const noTransitionsMd = FIXTURE_MD.split('## Transitions')[0];
  const { segments, overlays, transitions } = parseAssembly(noTransitionsMd);
  assert.equal(segments.length, 35);
  assert.equal(overlays.length, 9);
  assert.equal(transitions.length, 0);
});

test('planQcEvents on the fixture with empty effects', () => {
  const parsed = parseAssembly(FIXTURE_MD);
  const events = planQcEvents(parsed, { instances: [] });
  assert.equal(events.length, 34 + 18);

  for (let i = 1; i < events.length; i++) {
    assert.ok(events[i - 1].t <= events[i].t);
  }

  const sheets = new Set(events.map((e) => e.sheet));
  assert.equal(sheets.size, events.length);
  for (const sheet of sheets) {
    assert.match(sheet, /^event-\d{3}-[a-zA-Z0-9._-]+\.jpg$/);
  }

  const first = events[0];
  assert.equal(first.t, 57.5);
  assert.match(first.expected, /whip/);
  assert.match(first.expected, /card c01/);
});

test('planQcEvents with beats', () => {
  const parsed = parseAssembly(FIXTURE_MD);
  const eventsWithEffects = planQcEvents(parsed, {
    instances: [
      { id: 'beat-100', type: 'beat', at: 100, enabled: true },
      { id: 'beat-off', type: 'beat', at: 200, enabled: false },
      { id: 'whip-1', type: 'whip', at: 57.5 },
    ],
  });
  const eventsEmpty = planQcEvents(parsed, { instances: [] });
  assert.equal(eventsWithEffects.length, eventsEmpty.length + 1);
});

test('expectedForCut', () => {
  assert.match(
    expectedForCut({ kind: 'screen', id: 'x' }, { kind: 'avatar', id: 's03' }, false),
    /HARD cut/
  );
  assert.match(
    expectedForCut({ kind: 'avatar', id: 'x' }, { kind: 'graphic', id: 'c01' }, true),
    /flash-wipe/
  );
});

test('checklistMd', () => {
  const parsed = parseAssembly(FIXTURE_MD);
  const events = planQcEvents(parsed, { instances: [] });
  const md = checklistMd('test-01', events, 'final-draft');
  assert.match(md, /# test-01 — filmstrip QC checklist/);
  assert.match(md, /\| 1 \|/);
});
