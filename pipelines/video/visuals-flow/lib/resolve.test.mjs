import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { normWord, resolveCues } from './resolve.mjs';

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
      beat_shape: { kind: "'pro' | 'con'", text: 'string' },
    },
    {
      slug: 'overlay/simple-overlay',
      kind: 'single',
      placement: 'overlay',
      default_duration: 4,
    },
  ],
};

test('happy path: cue + 2 beats resolves start/at/duration', () => {
  const cues = [
    {
      id: 'c01',
      card: 'pros-cons/pros-cons',
      anchor: "let's look at the pros",
      variables: { title: 'Notion' },
      beats: [
        { reveal: { kind: 'pro', text: 'Free tier' }, anchor: 'the free tier alone' },
        { reveal: { kind: 'con', text: 'Not great' }, anchor: "it's not all good" },
      ],
    },
  ];
  const { resolved, errors } = resolveCues(cues, WORDS, CATALOG);
  assert.deepEqual(errors, []);
  assert.equal(resolved.length, 1);
  const cue = resolved[0];
  assert.equal(cue.start, 0); // anchor start (0.0) - lead (0.5), floored at 0
  assert.equal(cue.variables.beats[0].at, 2.5);
  assert.equal(cue.variables.beats[1].at, 6);
  assert.equal(cue.duration, 9); // last at (6) + hold (3.0)
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
  const tmpRoot = path.join(import.meta.dirname, '.test-tmp');
  fs.mkdirSync(tmpRoot, { recursive: true });
  const workdir = fs.mkdtempSync(path.join(tmpRoot, 'ok-'));
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
  const tmpRoot = path.join(import.meta.dirname, '.test-tmp');
  fs.mkdirSync(tmpRoot, { recursive: true });
  const workdir = fs.mkdtempSync(path.join(tmpRoot, 'bad-'));
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
      variables: { title: 'string', items: 'array of {label} or plain strings' } },
    { slug: 'x/table', kind: 'beat', placement: 'fullframe', default_duration: 7,
      max_beats: 3, max_reveal_chars: 10,
      variables: { products: 'array of strings' },
      beat_shape: { name: 'string', values: 'array, one per product', reason: 'string (optional)' } },
  ]};
  const errs = (cues) => validateCues(cues, catalog);

  // single card: missing variable + beats present + empty array
  let e = errs([{ id: 'c1', card: 'x/single', beats: [{ reveal: { a: 1 }, anchor: 'x y z' }], variables: { items: [] } }]);
  assert.ok(e.some((m) => m.includes('beats must be empty')));
  assert.ok(e.some((m) => m.includes('missing variable "title"')));
  assert.ok(e.some((m) => m.includes('non-empty array')));

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
  assert.ok(e.some((m) => m.includes('missing required field "name"')));

  // clean cue: no errors; optional reason may be absent
  e = errs([{ id: 'c3', card: 'x/table', variables: { products: ['A', 'B'] }, beats: [
    { reveal: { name: 'ok', values: [1, 2] }, anchor: 'a b c' },
  ]}]);
  assert.equal(e.length, 0);
});
