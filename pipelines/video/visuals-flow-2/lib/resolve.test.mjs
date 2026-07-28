import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { normWord, resolveCues, lastSentenceBoundaryAtOrBefore } from './resolve.mjs';

const TMP_ROOT = path.join(import.meta.dirname, '.test-tmp', 'resolve');
test.before(() => {
  if (fs.existsSync(TMP_ROOT)) {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  }
});
// Shared fixture: words spaced 0.5s apart, idx*0.5 = start.
const WORDS = [
  { text: "let's", start: 0.0 },
  { text: 'look', start: 0.5 },
  { text: 'at', start: 1.0 },
  { text: 'the', start: 1.5 },
  { text: 'Pros,', start: 2.0 },
  { text: 'the', start: 2.5 },
  { text: 'free', start: 3.0 },
  { text: 'tier', start: 3.5 },
  { text: 'alone', start: 4.0 },
  { text: 'is', start: 4.5 },
  { text: 'great', start: 5.0 },
  { text: 'but', start: 5.5 },
  { text: "it's", start: 6.0 },
  { text: 'not', start: 6.5 },
  { text: 'all', start: 7.0 },
  { text: 'good', start: 7.5 },
  { text: 'the', start: 8.0 },
  { text: 'mobile', start: 8.5 },
  { text: 'app', start: 9.0 },
  { text: 'crawls', start: 9.5 },
  { text: "let's", start: 10.0 },
  { text: 'look', start: 10.5 },
  { text: 'at', start: 11.0 },
  { text: 'the', start: 11.5 },
  { text: 'cons', start: 12.0 },
  { text: 'now', start: 12.5 },
  { text: 'the', start: 13.0 },
  { text: 'free', start: 13.5 },
  { text: 'tier', start: 14.0 },
  { text: 'returns', start: 14.5 },
].map((w) => ({ ...w, end: w.start + 0.4 }));

const CATALOG = {
  cards: [
    {
      slug: 'pros-cons/pros-cons',
      kind: 'beat',
      placement: 'fullframe',
      default_duration: 6,
      beat_shape: { 
        kind: { type: 'string', required: true, enum: ['pro', 'con'] }, 
        text: { type: 'string', required: true } 
      },
    },
    {
      slug: 'overlay/simple-overlay',
      kind: 'single',
      placement: 'overlay',
      default_duration: 4,
    },
  ],
};

test('beat cue resolves start relative to first beat, not cue anchor (BEAT_LEAD_IN clamp)', () => {
  const cues = [
    {
      id: 'c01',
      card: 'pros-cons/pros-cons',
      anchor: "let's look at the",
      variables: { title: 'Notion' },
      beats: [
        { reveal: { kind: 'pro', text: 'Free tier' }, anchor: "it's not all good" },
        { reveal: { kind: 'con', text: 'Not great' }, anchor: 'the mobile app crawls' },
      ],
    },
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG);
  assert.deepEqual(errors, []);
  assert.equal(resolved.length, 1);
  const cue = resolved[0];
  const firstBeatAbs = 6.0;
  
  assert.ok(Math.abs(cue.variables.beats[0].at - 0.6) < 0.05);
  assert.equal(cue.start, firstBeatAbs - 0.6); // 5.4
  assert.ok(Math.abs(cue.variables.beats[1].at - 2.6) < 0.05);
  assert.ok(Math.abs(cue.duration - 5.6) < 0.05);
});

test('anchor not in transcript produces an error and drops the cue', () => {
  const cues = [
    { id: 'c02', card: 'pros-cons/pros-cons', anchor: 'completely nonexistent phrase words', beats: [] },
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG);
  assert.equal(resolved.length, 0);
  assert.ok(errors.some((e) => /^c02:.*anchor not found/.test(e)));
});

test('monotonicity: beat phrase only before the cue anchor is not found (forward search only)', () => {
  const cues = [
    {
      id: 'c03',
      card: 'pros-cons/pros-cons',
      anchor: "let's look at the cons", // matches idx 20-24
      beats: [
        { reveal: { kind: 'pro', text: 'x' }, anchor: "let's look at the pros" }, // only occurs at idx 0-4, before cursor
      ],
    },
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG);
  assert.equal(resolved.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^c03 beat:/);
  assert.match(errors[0], /anchor not found/);
});

test('repeated phrase: second cue matches the second occurrence, forward of the first', () => {
  const cues = [
    { id: 'c04a', card: 'overlay/simple-overlay', anchor: 'the free tier', beats: [] }, // idx 5-7
    { id: 'c04b', card: 'overlay/simple-overlay', anchor: 'the free tier', beats: [] }, // idx 26-28
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG);
  assert.deepEqual(errors, []);
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].start, 2.0); // W[5].start (2.5) - lead 0.5
  assert.equal(resolved[1].start, 12.5); // W[26].start (13.0) - lead 0.5
});

test('anchor with fewer than 3 words is an error', () => {
  const cues = [{ id: 'c05', card: 'pros-cons/pros-cons', anchor: 'the pros', beats: [] }];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG);
  assert.equal(resolved.length, 0);
  assert.ok(errors.some((e) => /fewer than 3 words/.test(e)));
});

test('flagged cue is skipped silently, no error', () => {
  const cues = [
    { id: 'c06', card: 'pros-cons/pros-cons', anchor: 'anything not in the transcript at all', flagged: true, beats: [] },
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG);
  assert.equal(resolved.length, 0);
  assert.deepEqual(errors, []);
});

test('overlapping fullframe cues error; overlay overlapping fullframe does not', () => {
  const cues = [
    { id: 'c07a', card: 'pros-cons/pros-cons', anchor: "let's look at the pros", beats: [] }, // start 0, dur 6 (default)
    { id: 'c07b', card: 'pros-cons/pros-cons', anchor: 'the free tier alone', beats: [] }, // start 2.0, overlaps [0,6)
    { id: 'c07c', card: 'overlay/simple-overlay', anchor: "it's not all good", beats: [] }, // overlay, overlaps c07a too
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG);
  const overlapErrors = errors.filter((e) => /overlaps previous fullframe/.test(e));
  assert.equal(overlapErrors.length, 1);
  assert.match(overlapErrors[0], /^c07b:.*overlaps previous fullframe cue c07a/);
  const ids = resolved.map((c) => c.id);
  assert.deepEqual(ids, ['c07a', 'c07c']);
});

test('sandwich overlap: overlay between fullframes tracks the last fullframe', () => {
  const cues = [
    { id: 'cA', card: 'pros-cons/pros-cons', anchor: "let's look at the pros", beats: [] }, // start 0, dur 6
    { id: 'cB', card: 'overlay/simple-overlay', anchor: 'the free tier alone', beats: [] }, // start 2.0
    { id: 'cC', card: 'pros-cons/pros-cons', anchor: "is great but it's", beats: [] }, // start 4.0, overlaps cA [0, 6)
    { id: 'cD', card: 'pros-cons/pros-cons', anchor: "let's look at the cons", beats: [] }, // start 9.5, no overlap
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG);
  const overlapErrors = errors.filter((e) => /overlaps previous fullframe/.test(e));
  assert.equal(overlapErrors.length, 1);
  assert.match(overlapErrors[0], /^cC:.*overlaps previous fullframe cue cA/);
  const ids = resolved.map((c) => c.id);
  assert.deepEqual(ids, ['cA', 'cB', 'cD']);
});

test('beat anchor inside cue anchor phrase fails; immediately after resolves', () => {
  const cues = [
    {
      id: 'c1',
      card: 'pros-cons/pros-cons',
      anchor: "let's look at the pros", // length 5, idx 0..4
      beats: [
        { reveal: { kind: 'pro', text: '1' }, anchor: 'at the pros' }, // inside cue anchor, fails
      ],
    },
    {
      id: 'c2',
      card: 'pros-cons/pros-cons',
      anchor: "let's look at the cons", // length 5, idx 20..24
      beats: [
        { reveal: { kind: 'con', text: '2' }, anchor: 'now the free tier' }, // idx 25, immediately after, resolves
      ],
    }
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG);
  assert.ok(errors.some(e => /^c1 beat: anchor not found/.test(e)));
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].id, 'c2');
});

test('consecutive cues sharing boundary words resolve correctly', () => {
  const cues = [
    { id: 'c1', card: 'overlay/simple-overlay', anchor: "let's look at", beats: [] }, // idx 0..2
    { id: 'c2', card: 'overlay/simple-overlay', anchor: 'the pros, the free', beats: [] }, // idx 3..6
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG);
  assert.deepEqual(errors, []);
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].id, 'c1');
  assert.equal(resolved[1].id, 'c2');
});

test('beat-less single cue uses catalog default_duration', () => {
  const cues = [{ id: 'c08', card: 'overlay/simple-overlay', anchor: "it's not all good", beats: [] }];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG);
  assert.deepEqual(errors, []);
  assert.equal(resolved[0].duration, 4); // overlay/simple-overlay's default_duration
});

test('normWord strips punctuation and lowercases (transcript "Pros," matches anchor "pros")', () => {
  assert.equal(normWord('Pros,'), 'pros');
  assert.equal(normWord("IT'S"), "it's");
  assert.equal(normWord('--'), '');
});

test('CLI: resolves a fixture workdir to resolved.json and exits 0', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const workdir = fs.mkdtempSync(path.join(TMP_ROOT, 'ok-'));
  fs.copyFileSync(path.join(import.meta.dirname, 'fixtures', 'cues-ok.json'), path.join(workdir, 'cues.json'));
  fs.copyFileSync(path.join(import.meta.dirname, 'fixtures', 'transcript.json'), path.join(workdir, 'transcript.json'));

  const result = spawnSync(process.execPath, [path.join(import.meta.dirname, 'resolve.mjs'), workdir], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const resolvedPath = path.join(workdir, 'resolved.json');
  assert.ok(fs.existsSync(resolvedPath));
  const written = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  assert.equal(written.resolved.length, 1);
  assert.equal(written.resolved[0].id, 'c01');
});

test('CLI: bad anchor exits 1 and writes no resolved.json', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const workdir = fs.mkdtempSync(path.join(TMP_ROOT, 'bad-'));
  fs.copyFileSync(path.join(import.meta.dirname, 'fixtures', 'cues-bad.json'), path.join(workdir, 'cues.json'));
  fs.copyFileSync(path.join(import.meta.dirname, 'fixtures', 'transcript.json'), path.join(workdir, 'transcript.json'));

  const result = spawnSync(process.execPath, [path.join(import.meta.dirname, 'resolve.mjs'), workdir], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.ok(!fs.existsSync(path.join(workdir, 'resolved.json')));
});

test('validateCues: catches the test-01 bug classes', async (t) => {
  const { validateCues } = await import('./resolve.mjs');
  const catalog = { cards: [
    { slug: 'x/single', kind: 'single', placement: 'fullframe', default_duration: 6,
      variables: { title: { type: 'string', required: true, role: 'heading', example: 'Title' }, items: { type: 'array', required: true, item_shape: {} } } },
    { slug: 'x/table', kind: 'beat', placement: 'fullframe', default_duration: 7,
      max_beats: 3, max_reveal_chars: 10,
      variables: { products: { type: 'array', required: true } },
      beat_shape: { name: { type: 'string', required: true }, values: { type: 'array', required: true }, reason: { type: 'string', required: false } } },
  ]};
  const errs = (cues) => validateCues(cues, catalog);

  // single card: missing variable + beats present + empty array (Wait, the new array type does not strictly check for non-empty, but it does check type. The test originally passed empty array `[]`. If it passes `[]`, the new code won't error on empty array. Let's pass a non-array so it errors on type, and assert expected array)
  let e = errs([{ id: 'c1', card: 'x/single', beats: [{ reveal: { a: 1 }, anchor: 'x y z' }], variables: { items: "not an array" } }]);
  assert.ok(e.some((m) => m.includes('beats must be empty')));
  assert.ok(e.some((m) => m.includes('missing variable "title"')));
  assert.ok(e.some((m) => m.includes('expected array')));

  // beat card: width mismatch (the summary-table staircase), max_beats, chars, missing required field
  e = errs([{ id: 'c2', card: 'x/table', variables: { products: ['A', 'B'] }, beats: [
    { reveal: { name: 'ok', values: [1] }, anchor: 'a b c' },
    { reveal: { name: 'way too long a name', values: [1, 2] }, anchor: 'd e f' },
    { reveal: { values: [1, 2] }, anchor: 'g h i' },
    { reveal: { name: 'x', values: [1, 2] }, anchor: 'j k l' },
  ]}]);
  assert.ok(e.some((m) => m.includes('values has 1 entries but products has 2')));
  assert.ok(e.some((m) => m.includes('exceeds max_beats 3')));
  assert.ok(e.some((m) => m.includes('max 10')));
  assert.ok(e.some((m) => m.includes('missing reveal field "name"')));

  // clean cue: no errors; optional reason may be absent
  e = errs([{ id: 'c3', card: 'x/table', variables: { products: ['A', 'B'] }, beats: [
    { reveal: { name: 'ok', values: [1, 2] }, anchor: 'a b c' },
  ]}]);
  assert.equal(e.length, 0);

  // string-form spec throws/errors
  catalog.cards.push({ slug: 'x/legacy', kind: 'beat', placement: 'fullframe', default_duration: 6, max_beats: 3, max_reveal_chars: 10, beat_shape: { name: 'string' } });
  e = errs([{ id: 'c4', card: 'x/legacy', beats: [{ reveal: { name: 'x' }, anchor: 'a b c' }] }]);
  assert.ok(e.some((m) => m.includes('string-form variable contract is unsupported')));

  // headline-chips maxCommas
  catalog.cards.push({ slug: 'slate/headline-chips', kind: 'beat', placement: 'fullframe', default_duration: 6, max_beats: 5, max_reveal_chars: 10, variables: { headline: { type: 'string', role: 'heading', required: true } }, beat_shape: { text: { type: 'string', required: true } } });
  e = errs([{ id: 'c5', card: 'slate/headline-chips', variables: { headline: 'Same video, same goal, same criteria' }, beats: [{ reveal: { text: 'x' }, anchor: 'a b c' }] }]);
  assert.ok(e.some((m) => m.includes('at most 1 comma')));
});

test('word-sync cue resolves start/at/duration', () => {
  const customCatalog = { cards: [ ...CATALOG.cards, { slug: 'slate/kinetic-sentence', kind: 'word-sync', placement: 'fullframe', default_duration: 6, max_beats: 18 } ] };
  const cues = [
    {
      id: 'cWS',
      card: 'slate/kinetic-sentence',
      anchor: "let's look at the",
      variables: { text: "let's look at the", accent: 'look at' },
    },
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, customCatalog);
  assert.deepEqual(errors, []);
  assert.equal(resolved.length, 1);
  const cue = resolved[0];
  assert.equal(cue.start, 0); // W[0].start (0.0) - lead (0.5), floored
  assert.equal(cue.variables.beats.length, 4); // let's look at the
  assert.equal(cue.variables.beats[3].at, 1.5); // "the" is W[3], start 1.5
  assert.equal(cue.duration, 4.5); // last at (1.5) + hold (3.0)
});

test('extendExposure: (a) base none, two fullframes 8s apart -> first extends to second start', async () => {
  const { extendExposure } = await import('./resolve.mjs');
  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 0, duration: 5 },
    { id: 'c2', placement: 'fullframe', start: 13, duration: 5 },
  ];
  const out = extendExposure(resolved, { base: 'none', total: 30 });
  assert.equal(out[0].duration, 13);
  assert.equal(out[1].duration, 17); // 5 + 12 (gap is 30 - 18 = 12)
});

test('extendExposure: (b) gap 25s on base none -> extends exactly 20 (cap)', async () => {
  const { extendExposure } = await import('./resolve.mjs');
  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 0, duration: 5 },
  ];
  const out = extendExposure(resolved, { base: 'none', total: 35 }); // end 5, gap 30
  assert.equal(out[0].duration, 25); // 5 + 20 cap
});

test('extendExposure: (c) base screen gap 3s -> absorbed', async () => {
  const { extendExposure } = await import('./resolve.mjs');
  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 0, duration: 5 },
  ];
  const out = extendExposure(resolved, { base: 'screen', total: 8 }); // gap 3
  assert.equal(out[0].duration, 8); // 5 + 3
});

test('extendExposure: (d) base screen gap 15s -> unchanged', async () => {
  const { extendExposure } = await import('./resolve.mjs');
  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 0, duration: 5 },
  ];
  const out = extendExposure(resolved, { base: 'screen', total: 20 }); // gap 15
  assert.equal(out[0].duration, 5);
});

test('extendExposure: (e) overlays never modified', async () => {
  const { extendExposure } = await import('./resolve.mjs');
  const resolved = [
    { id: 'o1', placement: 'overlay', start: 0, duration: 5 },
  ];
  const out = extendExposure(resolved, { base: 'none', total: 15 });
  assert.equal(out[0].duration, 5);
});

test('bespoke cue with existing dir resolves; missing dir errors; missing placement errors', async () => {
  const { resolveCues } = await import('./resolve.mjs');
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const workdir = fs.mkdtempSync(path.join(TMP_ROOT, 'bespoke-'));
  const bespokeDir = path.join(workdir, 'bespoke', 'test-card');
  fs.mkdirSync(bespokeDir, { recursive: true });
  fs.writeFileSync(path.join(bespokeDir, 'index.html'), 'dummy');

  const cues = [
    { id: 'b1', card: 'bespoke', bespoke: 'test-card', placement: 'fullframe', anchor: "let's look at", beats: [] },
    { id: 'b2', card: 'bespoke', bespoke: 'missing-dir', placement: 'fullframe', anchor: "let's look at", beats: [] },
    { id: 'b3', card: 'bespoke', bespoke: 'test-card', anchor: "let's look at", beats: [] },
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG, null, workdir);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].id, 'b1');
  assert.equal(resolved[0].bespoke, 'test-card');
  assert.ok(errors.some(e => /b2: bespoke dir missing-dir missing index\.html/.test(e)));
  assert.ok(errors.some(e => /b3: bespoke card requires placement "fullframe" or "overlay"/.test(e)));
});

test('variant rotation', () => {
  const customCatalog = {
    cards: [
      { slug: 'slate/test-variants', kind: 'single', placement: 'overlay', default_duration: 1, variants: ['a', 'b'] }
    ]
  };
  const cues = [
    { id: 'c1', card: 'slate/test-variants', anchor: "let's look at" },
    { id: 'c2', card: 'slate/test-variants', anchor: "Pros, the free" },
    { id: 'c3', card: 'slate/test-variants', anchor: "tier alone is", variables: { variant: 'c' } },
    { id: 'c4', card: 'slate/test-variants', anchor: "great but it's" }
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, customCatalog);
  assert.deepEqual(errors, []);
  assert.equal(resolved[0].variables.variant, 'a');
  assert.equal(resolved[1].variables.variant, 'b');
  assert.equal(resolved[2].variables.variant, 'c');
  assert.equal(resolved[3].variables.variant, 'b'); // count is 3, 3%2 = 1 -> 'b'
});


// --- Folded from test-01 Final Cut round 2 (2026-07-24) ---

test('structural card pins its variant instead of rotating (owner v2:6)', () => {
  const catalog = { cards: [{
    slug: 'section/tool-intro', kind: 'single', placement: 'fullframe',
    default_duration: 3, structural: true, variants: ['a', 'b'],
  }] };
  const cues = [
    { id: 'c01', card: 'section/tool-intro', anchor: "let's look at the", variables: {} },
    { id: 'c02', card: 'section/tool-intro', anchor: "it's not all good", variables: {} },
    { id: 'c03', card: 'section/tool-intro', anchor: "let's look at the", variables: {} },
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, catalog);
  assert.deepEqual(errors, []);
  assert.deepEqual(resolved.map(c => c.variables.variant), ['a', 'a', 'a']);
});

test('explicit variant still wins over the structural pin', () => {
  const catalog = { cards: [{
    slug: 'section/tool-intro', kind: 'single', placement: 'fullframe',
    default_duration: 6, structural: true, variants: ['a', 'b'],
  }] };
  const cues = [{ id: 'c01', card: 'section/tool-intro', anchor: "let's look at the", variables: { variant: 'b' } }];
  const { resolved } = resolveCues(cues, WORDS, catalog);
  assert.equal(resolved[0].variables.variant, 'b');
});

test('beat anchoring to a far repeat of the same words errors (owner v2:3)', () => {
  // "the free tier" is spoken at 3.0s and again at 40.0s. A beat quoting it
  // must not silently resolve to the far copy and fire against the wrong line.
  const words = [];
  for (let i = 0; i < 100; i++) words.push({ text: `filler${i}`, start: i * 0.5, end: i * 0.5 + 0.4 });
  const put = (idx, arr) => arr.forEach((t, k) => { words[idx + k] = { text: t, start: (idx + k) * 0.5, end: (idx + k) * 0.5 + 0.4 }; });
  put(0, ['now', 'here', 'is', 'the', 'plan']);
  put(6, ['the', 'free', 'tier']);   // 3.0s
  put(80, ['the', 'free', 'tier']);  // 40.0s — 37s later

  const catalog = { cards: [{
    slug: 'pros-cons/pros-cons', kind: 'beat', placement: 'fullframe', default_duration: 6,
    beat_shape: { kind: { type: 'string', required: true, enum: ['pro', 'con'] }, text: { type: 'string', required: true } },
  }] };
  const cues = [{
    id: 'c01', card: 'pros-cons/pros-cons', anchor: 'now here is', variables: { title: 'Notion' },
    beats: [
      { reveal: { kind: 'pro', text: 'First' }, anchor: 'the free tier' },
      { reveal: { kind: 'con', text: 'Second' }, anchor: 'the free tier' },
    ],
  }];
  const { resolved, errors } = resolveCues(cues, words, catalog);
  assert.equal(resolved.length, 0);
  assert.match(errors.join(' '), /later repeat/);
});

test('chroma-key cards carry their key colour into the resolved entry (owner v2:5)', () => {
  const catalog = { cards: [
    { slug: 'link-in-description/link-in-description', kind: 'single', placement: 'overlay', default_duration: 4, chroma: '0x00b140' },
    { slug: 'overlay/simple-overlay', kind: 'single', placement: 'overlay', default_duration: 4 },
  ] };
  const cues = [
    { id: 'c01', card: 'link-in-description/link-in-description', anchor: "let's look at the", variables: { message: 'Link below' } },
    { id: 'c02', card: 'overlay/simple-overlay', anchor: 'the mobile app crawls', variables: {} },
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, catalog);
  assert.deepEqual(errors, []);
  assert.equal(resolved[0].chroma, '0x00b140');
  assert.ok(!('chroma' in resolved[1]));
});

test('sentenceEndAfter finds the terminal punctuation of the current sentence', async () => {
  const { sentenceEndAfter } = await import('./resolve.mjs');
  const W = [
    { text: 'this', end: 1 }, { text: 'is', end: 2 }, { text: 'one.', end: 3 },
    { text: 'and', end: 4 }, { text: 'two!', end: 5 },
  ];
  assert.equal(sentenceEndAfter(W, 0), 3);
  assert.equal(sentenceEndAfter(W, 3), 5);
  assert.equal(sentenceEndAfter([{ text: 'no', end: 1 }], 0), null);
});

// Owner v2:2 / v2:5 2026-07-25 — a single card used cat.default_duration, a
// constant unrelated to the sentence, so it vanished mid-narration.
test('a fullframe card holds until its sentence finishes (owner v2:2/v2:5)', () => {
  const words = [
    { text: "let's", start: 0.0 }, { text: 'look', start: 0.5 }, { text: 'at', start: 1.0 },
    { text: 'the', start: 1.5 }, { text: 'thing', start: 2.0 }, { text: 'that', start: 2.5 },
    { text: 'keeps', start: 3.0 }, { text: 'going', start: 3.5 }, { text: 'on.', start: 9.0 },
  ].map(w => ({ ...w, end: w.start + 0.4 }));
  const catalog = { cards: [{ slug: 'statement/keyword-statement', kind: 'single', placement: 'fullframe', default_duration: 3 }] };
  const cues = [{ id: 'c01', card: 'statement/keyword-statement', anchor: "let's look at", variables: { text: 'x' } }];
  const { resolved, errors } = resolveCues(cues, words, catalog);
  assert.deepEqual(errors, []);
  // sentence ends at 9.4s; card starts at -0.5 clamped to 0 → duration reaches the sentence end exactly, with no tail (owner ruling 2026-07-28, plan 155)
  assert.ok(resolved[0].duration > 3, `expected > default 3, got ${resolved[0].duration}`);
  assert.ok(Math.abs(resolved[0].start + resolved[0].duration - 9.4) < 0.2,
    `card should end ~9.4s (sentence 9.4), got ${resolved[0].start + resolved[0].duration}`);
});


test('exposure ends on a sentence boundary, never mid-sentence', () => {
  const W = [
    { text: 'Alpha', start: 0.0, end: 0.5 },
    { text: 'beta.', start: 0.5, end: 1.0 },
    { text: 'Gamma', start: 1.0, end: 1.5 },
    { text: 'delta.', start: 1.5, end: 3.0 },
    { text: 'Epsilon', start: 3.0, end: 4.0 },
  ];
  assert.equal(lastSentenceBoundaryAtOrBefore(W, 2.0), 1.0);
  assert.equal(lastSentenceBoundaryAtOrBefore(W, 3.5), 3.0);
  assert.equal(lastSentenceBoundaryAtOrBefore(W, 0.2), null);
});

test('exposure is independent of the card default_duration', () => {
  // Same cue, same transcript, two different card default_durations.
  // The resolved END must be identical — this is the regression that
  // commit 6813379 introduced by changing before-after 8 -> 6.
  const W = [
    { text: 'One', start: 0.0, end: 1.0 },
    { text: 'two.', start: 1.0, end: 2.0 },
    { text: 'Three', start: 2.0, end: 3.0 },
    { text: 'four.', start: 3.0, end: 4.0 },
    { text: 'Five', start: 4.0, end: 20.0 },
  ];
  const cues = [{ id: 'c1', card: 'x/y', anchor: 'One two. Three', lead: 0, hold: 0, beats: [], variables: {} }];
  const mk = (dd) => ({ cards: [{ slug: 'x/y', kind: 'single', placement: 'fullframe', default_duration: dd, variables: {} }] });
  const a = resolveCues(cues, W, mk(2));
  const b = resolveCues(cues, W, mk(3));
  const endA = a.resolved[0].start + a.resolved[0].duration;
  const endB = b.resolved[0].start + b.resolved[0].duration;
  assert.equal(+endA.toFixed(2), +endB.toFixed(2));
  assert.equal(+endA.toFixed(2), 4.0); // the last boundary inside the 12s window
});

test('extendExposure: avatar-full span bounds absorption on base none', async () => {
  const { extendExposure } = await import('./resolve.mjs');
  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 0, duration: 10 },
  ];
  // avatar-full at 20s bounds the gap to 20-10=10s.
  const out1 = extendExposure(resolved, { base: 'none', total: 60, avatarSpans: [[20, 30]] });
  assert.equal(out1[0].duration, 20);

  // without avatar data, it absorbs toward 60s, capped at HOLD_EXTEND_CAP (20s) -> 10+20=30
  const out2 = extendExposure(resolved, { base: 'none', total: 60 });
  assert.equal(out2[0].duration, 30);
});
