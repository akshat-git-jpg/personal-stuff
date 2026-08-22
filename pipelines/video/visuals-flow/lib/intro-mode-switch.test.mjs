import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadSteps, nextStep, stepInMode } from './steps.mjs';
import { loadRunConfig, INTRO_MODES, DEFAULT_INTRO_MODE } from './run-config.mjs';

// The introMode switch (plan 218). Tag: INTRO-MODE.
//
// The load-bearing claim is narrow and mechanical: a `simple` video's intro track
// must not park on a complex-flow step. Before the mode filter existed, a simple
// video waited forever on 110-propose-intro-idea-llm for an idea.json nothing
// would ever write.

function tmpWorkdir(cfg) {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-mode-'));
  if (cfg) fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify(cfg));
  return w;
}

// Nothing produced yet, no gate passed — the worst case for parking.
const emptyProbes = { exists: () => false, readFlag: () => false };

const COMPLEX_ONLY = ['110', '120', '130', '140', '150', '160', '440'];

test('INTRO-MODE: the seven complex-flow steps declare modes: ["complex"]', () => {
  const steps = loadSteps();
  for (const n of COMPLEX_ONLY) {
    const s = steps.find((x) => x.number === n);
    assert.ok(s, `INTRO-MODE: step ${n} must exist in the registry`);
    assert.deepEqual(s.modes, ['complex'],
      `INTRO-MODE: step ${n} must be tagged modes: ["complex"], got ${JSON.stringify(s.modes)}`);
  }
});

test('INTRO-MODE: a simple video never parks on a complex-flow step', () => {
  const next = nextStep({ ...emptyProbes, mode: 'simple' });
  for (const track of Object.keys(next)) {
    const step = next[track];
    if (!step) continue;
    assert.ok(!COMPLEX_ONLY.includes(step.number),
      `INTRO-MODE: mode "simple" parked the ${track} track on complex-only step ${step.number} ${step.slug} — the mode filter in firstUnsatisfied() is not being applied`);
  }
});

test('INTRO-MODE: a complex video still parks on 110 exactly as before', () => {
  const next = nextStep({ ...emptyProbes, mode: 'complex' });
  assert.equal(next.intro?.number, '110',
    `INTRO-MODE: mode "complex" must still park the intro track on 110 — the bespoke flow is unchanged, got ${next.intro?.number}`);
});

test('INTRO-MODE: an untagged step runs in every mode', () => {
  for (const mode of INTRO_MODES) {
    assert.equal(stepInMode({ number: '210' }, mode), true,
      `INTRO-MODE: a step with no modes key must run in mode "${mode}"`);
  }
});

test('INTRO-MODE: the default mode is simple, and no run-config means simple', () => {
  assert.equal(DEFAULT_INTRO_MODE, 'simple',
    'INTRO-MODE: the owner chose simple as the default (2026-08-22)');
  const w = tmpWorkdir(null);
  assert.equal(loadRunConfig(w).introMode, 'simple',
    'INTRO-MODE: an unconfigured video is simple');
  fs.rmSync(w, { recursive: true, force: true });
});

test('INTRO-MODE: configure --intro complex is honoured', () => {
  const w = tmpWorkdir({ introMode: 'complex' });
  assert.equal(loadRunConfig(w).introMode, 'complex',
    'INTRO-MODE: an explicit complex must survive loadRunConfig');
  fs.rmSync(w, { recursive: true, force: true });
});

test('INTRO-MODE: a typo in introMode throws rather than silently defaulting', () => {
  const w = tmpWorkdir({ introMode: 'simpel' });
  assert.throws(() => loadRunConfig(w), /introMode "simpel"/,
    'INTRO-MODE: an unrecognised mode must throw — a silent fallback runs a flow the config does not claim');
  fs.rmSync(w, { recursive: true, force: true });
});

test('INTRO-MODE: the legacy intro key is still stripped, never honoured', () => {
  const w = tmpWorkdir({ intro: 'cards', introMode: 'simple' });
  const cfg = loadRunConfig(w);
  assert.equal(cfg.intro, undefined,
    'INTRO-MODE: the plan-194 `intro` key named a deleted card flow — it stays ignored');
  fs.rmSync(w, { recursive: true, force: true });
});
