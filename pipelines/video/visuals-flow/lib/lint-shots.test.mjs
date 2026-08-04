import test from 'node:test';
import assert from 'node:assert/strict';
import { lintShots } from './lint-shots.mjs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const words = Array.from({ length: 1200 }, (_, i) => ({ text: `w${i}`, start: i, end: i + 1 }));
const mockCatalog = {
  cards: [
    { slug: 'section/host-side', side: true },
    { slug: 'prompt/prompt-typing' }
  ]
};

test('two overlapping spans → E1', () => {
  const shotsResolved = { spans: [{ id: 's1', start: 10, end: 30, duration: 20 }, { id: 's2', start: 25, end: 40, duration: 15 }] };
  const { errors } = lintShots({ shotsResolved, resolvedCues: [], words, catalog: mockCatalog });
  assert.ok(errors.some(e => e.startsWith('E1')));
});

test('span overlapping a fullframe cue → E2; same span vs an overlay cue → no E2', () => {
  const shotsResolved = { spans: [{ id: 's1', start: 90, end: 130, duration: 40 }] };
  const res1 = lintShots({ shotsResolved, resolvedCues: [{ id: 'c1', placement: 'fullframe', start: 100, duration: 20 }], words, catalog: mockCatalog });
  assert.ok(res1.errors.some(e => e.startsWith('E2')));

  const res2 = lintShots({ shotsResolved, resolvedCues: [{ id: 'c1', placement: 'overlay', start: 100, duration: 20 }], words, catalog: mockCatalog });
  assert.ok(!res2.errors.some(e => e.startsWith('E2')));
});

test('8s span → E3; 200s span in front zone → W1', () => {
  const res1 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 10, end: 18, duration: 8 }] }, resolvedCues: [], words, catalog: mockCatalog });
  assert.ok(res1.errors.some(e => e.startsWith('E3')));

  const res2 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 10, end: 210, duration: 200 }] }, resolvedCues: [], words, catalog: mockCatalog });
  assert.ok(res2.warnings.some(w => w.startsWith('W1')));
});

test('spans totalling 350s → E4', () => {
  const shotsResolved = { spans: [{ id: 's1', start: 10, end: 360, duration: 350 }] };
  const { errors } = lintShots({ shotsResolved, resolvedCues: [], words, catalog: mockCatalog });
  assert.ok(errors.some(e => e.startsWith('E4')));
});

test('single mid-video span → W3 twice; spans at edges → no W3', () => {
  const res1 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 500, end: 560, duration: 60 }] }, resolvedCues: [], words, catalog: mockCatalog });
  const w3s = res1.warnings.filter(w => w.startsWith('W3'));
  assert.equal(w3s.length, 2);

  const res2 = lintShots({
    shotsResolved: {
      spans: [
        { id: 's1', start: 30, end: 90, duration: 60 },
        { id: 's2', start: 1150, end: 1190, duration: 40 }
      ]
    },
    resolvedCues: [],
    words,
    catalog: mockCatalog
  });
  assert.ok(!res2.warnings.some(w => w.startsWith('W3')));
});

test('400s gap between spans → W4; 150s gap → no W4', () => {
  const res1 = lintShots({
    shotsResolved: {
      spans: [
        { id: 's1', start: 30, end: 90, duration: 60 },
        { id: 's2', start: 490, end: 530, duration: 40 }
      ]
    },
    resolvedCues: [],
    words,
    catalog: mockCatalog
  });
  assert.ok(res1.warnings.some(w => w.startsWith('W4')));

  const res2 = lintShots({
    shotsResolved: {
      spans: [
        { id: 's1', start: 30, end: 90, duration: 60 },
        { id: 's2', start: 240, end: 280, duration: 40 }
      ]
    },
    resolvedCues: [],
    words,
    catalog: mockCatalog
  });
  assert.ok(!res2.warnings.some(w => w.startsWith('W4')));
});

test('zone/mid span thresholds and Youri cadence gaps', () => {
  const words1800 = Array.from({ length: 1800 }, (_, i) => ({ text: `w${i}`, start: i, end: i + 1 }));

  // mid-video span of 50s → W1 fires with `mid-video` in the message
  const resMid50 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 500, end: 550, duration: 50 }] }, resolvedCues: [], words: words1800, catalog: mockCatalog });
  const w1Mid50 = resMid50.warnings.find(w => w.startsWith('W1'));
  assert.ok(w1Mid50 && w1Mid50.includes('mid-video'));

  // mid-video span of 30s → no W1
  const resMid30 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 500, end: 530, duration: 30 }] }, resolvedCues: [], words: words1800, catalog: mockCatalog });
  assert.ok(!resMid30.warnings.some(w => w.startsWith('W1')));

  // front-zone span (starts ≤ 270) of 100s → no W1
  const resFront100 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 50, end: 150, duration: 100 }] }, resolvedCues: [], words: words1800, catalog: mockCatalog });
  assert.ok(!resFront100.warnings.some(w => w.startsWith('W1')));

  // front-zone span of 130s → W1 fires with `intro/outro` in the message
  const resFront130 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 50, end: 180, duration: 130 }] }, resolvedCues: [], words: words1800, catalog: mockCatalog });
  const w1Front130 = resFront130.warnings.find(w => w.startsWith('W1'));
  assert.ok(w1Front130 && w1Front130.includes('intro/outro'));

  // gap of 200s between spans → W4 fires
  const resGap200 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 10, end: 50, duration: 40 }, { id: 's2', start: 250, end: 290, duration: 40 }] }, resolvedCues: [], words: words1800, catalog: mockCatalog });
  assert.ok(resGap200.warnings.some(w => w.startsWith('W4')));

  // gap of 170s → no W4
  const resGap170 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 10, end: 50, duration: 40 }, { id: 's2', start: 220, end: 260, duration: 40 }] }, resolvedCues: [], words: words1800, catalog: mockCatalog });
  assert.ok(!resGap170.warnings.some(w => w.startsWith('W4')));

  // 10.5s span → no E3
  const resSpan10_5 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 10, end: 20.5, duration: 10.5 }] }, resolvedCues: [], words: words1800, catalog: mockCatalog });
  assert.ok(!resSpan10_5.errors.some(e => e.startsWith('E3')));

  // 9s span → E3
  const resSpan9 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 10, end: 19, duration: 9 }] }, resolvedCues: [], words: words1800, catalog: mockCatalog });
  assert.ok(resSpan9.errors.some(e => e.startsWith('E3')));
});

test('empty spans array → no errors, no warnings', () => {
  const { errors, warnings } = lintShots({ shotsResolved: { spans: [] }, resolvedCues: [], words, catalog: mockCatalog });
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
});


test('screen segment between avatars < 2.5s -> E5', () => {
  const { errors, warnings } = lintShots({
    shotsResolved: {
      spans: [
        { id: 's1', start: 0, end: 50, duration: 50 },
        { id: 's2', start: 52.4, end: 100, duration: 47.6 }
      ]
    },
    resolvedCues: [],
    words,
    catalog: mockCatalog
  });
  assert.ok(errors.some(e => e.startsWith('E5 orphan-screen')));
});

test('screen segment < 5s -> W5', () => {
  const { errors, warnings } = lintShots({
    shotsResolved: {
      spans: [
        { id: 's1', start: 4, end: 50, duration: 46 } // screen 0 to 4 (4s)
      ]
    },
    resolvedCues: [],
    words,
    catalog: mockCatalog
  });
  assert.ok(warnings.some(w => w.startsWith('W5 short-screen')));
});

test('clean plan silent -> no E5/W5', () => {
  const { errors, warnings } = lintShots({
    shotsResolved: {
      spans: [
        { id: 's1', start: 10, end: 50, duration: 40 },
        { id: 's2', start: 60, end: 100, duration: 40 }
      ]
    },
    resolvedCues: [],
    words: Array.from({ length: 200 }, (_, i) => ({ text: 'w', start: i, end: i + 1 })), // total 200
    catalog: mockCatalog
  });
  assert.ok(!errors.some(e => e.startsWith('E5')));
  assert.ok(!warnings.some(w => w.startsWith('W5')));
});

test('200s panel span does not trip the 300s full cap', () => {
  const shotsResolved = { spans: [{ id: 's1', mode: 'panel', start: 10, end: 360, duration: 350 }] };
  const { errors } = lintShots({ shotsResolved, resolvedCues: [], words, catalog: mockCatalog });
  assert.ok(!errors.some(e => e.startsWith('E4')));
});

test('panel span overlapping a fullframe cue errors with specific message', () => {
  const shotsResolved = { spans: [{ id: 's1', mode: 'panel', start: 90, end: 130, duration: 40 }] };
  const res1 = lintShots({ shotsResolved, resolvedCues: [{ id: 'c1', placement: 'fullframe', start: 100, duration: 20 }], words, catalog: mockCatalog });
  const e2 = res1.errors.find(e => e.startsWith('E2'));
  assert.ok(e2 && e2.includes('panels belong over screen/demo footage'));
});

test('panel span over a screen segment is clean', () => {
  // Screen segment is inferred between avatars or when no fullframe overlaps it.
  const shotsResolved = { spans: [{ id: 's1', mode: 'panel', start: 10, end: 50, duration: 40 }] };
  const res1 = lintShots({ shotsResolved, resolvedCues: [], words, catalog: mockCatalog });
  assert.ok(!res1.errors.some(e => e.startsWith('E2')));
});

test('valid side span inside a side-capable cue', () => {
  const shotsResolved = { spans: [{ id: 's1', mode: 'side', start: 10, end: 20, duration: 10 }] };
  const res = lintShots({ shotsResolved, resolvedCues: [{ id: 'c1', card: 'section/host-side', placement: 'fullframe', start: 5, duration: 20 }], words, catalog: mockCatalog });
  assert.ok(!res.errors.some(e => e.startsWith('E6')));
  assert.ok(!res.errors.some(e => e.startsWith('E2')));
});

test('side span with no covering cue → error', () => {
  const shotsResolved = { spans: [{ id: 's1', mode: 'side', start: 10, end: 20, duration: 10 }] };
  const res = lintShots({ shotsResolved, resolvedCues: [], words, catalog: mockCatalog });
  const e6 = res.errors.find(e => e.startsWith('E6'));
  assert.ok(e6 && e6.includes('has no covering cue'));
});

test('side span covered by a card that is not side-capable → error', () => {
  const shotsResolved = { spans: [{ id: 's1', mode: 'side', start: 10, end: 20, duration: 10 }] };
  const res = lintShots({ shotsResolved, resolvedCues: [{ id: 'c1', card: 'prompt/prompt-typing', placement: 'fullframe', start: 5, duration: 20 }], words, catalog: mockCatalog });
  const e6 = res.errors.find(e => e.startsWith('E6'));
  assert.ok(e6 && e6.includes('is not side-capable'));
});

test('long side span DOES trip the full-screen cap', () => {
  const shotsResolved = { spans: [{ id: 's1', mode: 'side', start: 10, end: 360, duration: 350 }] };
  const res = lintShots({ shotsResolved, resolvedCues: [{ id: 'c1', slug: 'section/host-side', placement: 'fullframe', start: 5, duration: 400 }], words, catalog: mockCatalog });
  assert.ok(res.errors.some(e => e.startsWith('E4')));
});

test('lint-shots CLI resolves the real catalog from a workdir', () => {
  // The bug lived in main(), which no test touched: every case called
  // lintShots({ catalog: mockCatalog }) and never resolved a path.
  //
  // Built on a throwaway workdir rather than a real video. This used to run
  // against `test-03` and broke the moment that video was cleaned up for a
  // fresh run (2026-07-30) — a test must never depend on a workdir someone is
  // expected to wipe.
  const root = path.resolve(import.meta.dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-shots-cli-'));
  try {
    const words = [
      { text: 'welcome', start: 0.0, end: 0.4 },
      { text: 'back', start: 0.4, end: 0.8 },
      { text: 'everyone', start: 0.8, end: 1.4 },
    ];
    fs.writeFileSync(path.join(dir, 'transcript.json'), JSON.stringify(words));
    fs.writeFileSync(path.join(dir, 'resolved.json'), JSON.stringify({ video: 'tmp', resolved: [] }));
    fs.writeFileSync(path.join(dir, 'shots.resolved.json'), JSON.stringify({ video: 'tmp', shots: [] }));

    const res = spawnSync(process.execPath, ['lib/lint-shots.mjs', dir], { cwd: root, encoding: 'utf8' });
    assert.ok(!/ENOENT/.test(res.stderr), `lint-shots threw ENOENT:\n${res.stderr.slice(-500)}`);
    assert.equal(res.status, 0, res.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// E8 intro-host (owner 2026-08-02). The rule lived in shot-constants — and so in
// the shot-pass prompt — since 2026-08-01 with nothing checking it, which is how
// a host at 0:59 shipped. These tests exist so it stays a gate.
test('host span starting after INTRO_HOST_BY → E8', () => {
  const shotsResolved = { spans: [{ id: 's00', start: 59.5, end: 82.7, duration: 23.2 }] };
  const { errors } = lintShots({ shotsResolved, resolvedCues: [], words, catalog: mockCatalog });
  assert.ok(errors.some((e) => e.startsWith('E8 intro-host')), 'a late host must error');
});

test('host span starting at or before INTRO_HOST_BY → no E8', () => {
  const shotsResolved = { spans: [{ id: 's00', start: 12, end: 30, duration: 18 }] };
  const { errors } = lintShots({ shotsResolved, resolvedCues: [], words, catalog: mockCatalog });
  assert.ok(!errors.some((e) => e.startsWith('E8 intro-host')), 'an early host must pass');
});

test('a side span counts as the host being on screen', () => {
  const shotsResolved = { spans: [{ id: 's00', start: 3, end: 20, duration: 17, mode: 'side' }] };
  const { errors } = lintShots({ shotsResolved, resolvedCues: [], words, catalog: mockCatalog });
  assert.ok(!errors.some((e) => e.startsWith('E8 intro-host')), 'side mode satisfies the rule');
});

test('an empty shot plan stays neutral — E8 is about a LATE host, not a missing one', () => {
  const { errors } = lintShots({ shotsResolved: { spans: [] }, resolvedCues: [], words, catalog: mockCatalog });
  assert.ok(!errors.some((e) => e.startsWith('E8 intro-host')), 'empty plans are someone else\'s contract');
});

test('intro_host_waived downgrades E8 to a loud W8 carrying the reason', () => {
  const shotsResolved = { intro_host_waived: 'planned before the gate existed', spans: [{ id: 's00', start: 59.5, end: 82.7, duration: 23.2 }] };
  const { errors, warnings } = lintShots({ shotsResolved, resolvedCues: [], words, catalog: mockCatalog });
  assert.ok(!errors.some((e) => e.startsWith('E8 intro-host')), 'a waiver clears the error');
  const w = warnings.find((x) => x.startsWith('W8 intro-host-waived'));
  assert.ok(w, 'a waiver must still warn every run');
  assert.match(w, /planned before the gate existed/, 'the reason must be echoed, not swallowed');
});

test('an empty waiver reason does NOT clear E8', () => {
  const shotsResolved = { intro_host_waived: '   ', spans: [{ id: 's00', start: 59.5, end: 82.7, duration: 23.2 }] };
  const { errors } = lintShots({ shotsResolved, resolvedCues: [], words, catalog: mockCatalog });
  assert.ok(errors.some((e) => e.startsWith('E8 intro-host')), 'waiving must cost a sentence');
});

// E8 under a film-owned intro (owner 2026-08-03). Plan 187 required E8 to be
// re-anchored and it shipped unmet: lint-shots never imported the predicate, so
// on `intro: "film"` the rule demanded a host span inside the span vf2
// deliberately places no avatars in, and blocked the shot pass on every
// film-owned video. The rule is NOT waived here — the owner's reason for it
// ("it should be in the starting") applies to the body's opening too — it is
// measured from the end of the film instead of from t=0.
const FILM = { start: 0, end: 86.733 };

test('E8 does not fire when the host lands early in the BODY of a film-owned video', () => {
  // The film owns 0-86.7s and contains the host; vf2's first span is at 90s.
  const shotsResolved = { spans: [{ id: 's00', start: 90, end: 140, duration: 50 }] };
  const { errors } = lintShots({ shotsResolved, resolvedCues: [], words, catalog: mockCatalog, filmSpan: FILM });
  assert.ok(
    !errors.some((e) => e.startsWith('E8 intro-host')),
    'a host 3.3s into the body must pass — the film owns everything before it',
  );
});

test('E8 still fires when the host is late INSIDE the body of a film-owned video', () => {
  // Deadline is 86.733 + 15 = 101.7s. A span at 140s is genuinely late.
  const shotsResolved = { spans: [{ id: 's00', start: 140, end: 200, duration: 60 }] };
  const { errors } = lintShots({ shotsResolved, resolvedCues: [], words, catalog: mockCatalog, filmSpan: FILM });
  const e8 = errors.filter((e) => e.startsWith('E8 intro-host'));
  assert.equal(e8.length, 1, 'the rule is re-anchored, not disabled');
  assert.match(e8[0], /into the body/, 'the message must explain the new anchor');
  assert.match(e8[0], /101\.7s/, 'the deadline is the film end plus the 15s bound');
});

test('without a filmSpan E8 behaves exactly as before — the default path is untouched', () => {
  const late = { spans: [{ id: 's00', start: 59.5, end: 82.7, duration: 23.2 }] };
  const early = { spans: [{ id: 's00', start: 12, end: 30, duration: 18 }] };
  assert.ok(lintShots({ shotsResolved: late, resolvedCues: [], words, catalog: mockCatalog }).errors.some((e) => e.startsWith('E8')));
  assert.ok(!lintShots({ shotsResolved: early, resolvedCues: [], words, catalog: mockCatalog }).errors.some((e) => e.startsWith('E8')));
});
