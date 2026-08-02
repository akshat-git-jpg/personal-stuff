import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beatSampleTimes, snapshotArgs, checkArgs, parseCheckJson, summariseFindings, beatAt, renderReport,
} from './review-film.mjs';

const screenplay = {
  beats: [
    { id: 'b01', intent: 'hook', register: 'dark', face: 'full', t_start: 0, t_end: 3.65, clause: 'One.', stage: 'Cold open.' },
    { id: 'b02', intent: 'turn', register: 'light', face: 'none', t_start: 3.65, t_end: 13.7, clause: 'Two.', stage: 'Roll call.' },
  ],
};

test('samples the midpoint of each beat, not its boundaries', () => {
  const s = beatSampleTimes(screenplay);
  // Rounded to 2dp. Sub-frame precision is meaningless at 30fps (33ms/frame),
  // so binary-float rounding down on an exact .x25 is not worth defending against.
  assert.deepEqual(s.map((x) => x.t), [1.82, 8.67]);
  assert.deepEqual(s.map((x) => x.id), ['b01', 'b02']);
  assert.equal(s[1].stage, 'Roll call.');
});

test('an empty screenplay samples nothing rather than throwing', () => {
  assert.deepEqual(beatSampleTimes({}), []);
  assert.deepEqual(beatSampleTimes(null), []);
});

test('snapshot args pin the times and disable the paid describe pass', () => {
  const a = snapshotArgs('/film', [1.83, 8.68], '/out');
  assert.ok(a.includes('snapshot'));
  assert.equal(a[a.indexOf('--at') + 1], '1.83,8.68');
  assert.equal(a[a.indexOf('--describe') + 1], 'false');
  assert.ok(a.includes('--no-end'));
});

test('check args sample transition seams, where transient overlaps hide', () => {
  const a = checkArgs('/film');
  assert.ok(a.includes('--at-transitions'));
  assert.ok(a.includes('--json'));
});

test('check output is parsed past the CLI progress preamble', () => {
  const raw = 'Checking composition...\n  spinner noise\n{"layout":{"ok":true}}\n';
  assert.deepEqual(parseCheckJson(raw), { layout: { ok: true } });
});

test('progress printed AFTER the JSON body does not break the parse', () => {
  // stdout and stderr interleave, so the body is bracketed by noise on both sides.
  const raw = 'checking...\n{"layout":{"ok":false}}\n◇ done in 101s\nnpm notice\n';
  assert.deepEqual(parseCheckJson(raw), { layout: { ok: false } });
});

test('a brace inside a finding message does not terminate the scan early', () => {
  const raw = `noise\n{"layout":{"findings":[{"message":"unexpected { in selector","severity":"error"}]}}\ntrailing`;
  assert.equal(parseCheckJson(raw).layout.findings[0].severity, 'error');
});

test('an escaped quote inside a message does not break string tracking', () => {
  const raw = `{"layout":{"findings":[{"text":"say \\"hi\\" {","severity":"error"}]}}\ntail`;
  assert.equal(parseCheckJson(raw).layout.findings[0].text, 'say "hi" {');
});

test('output with no JSON body is an error, not a silent empty report', () => {
  assert.throws(() => parseCheckJson('command not found'), /no JSON object/);
});

test('a truncated JSON body is an error, not a partial parse', () => {
  assert.throws(() => parseCheckJson('{"layout":{"ok":true}'), /unterminated/);
});

test('findings are flattened, info dropped, and ordered error before warning', () => {
  const report = {
    layout: {
      findings: [
        { severity: 'warning', code: 'offset_parent', time: 0.5 },
        { severity: 'info', code: 'text_occluded', time: 83 },
        { severity: 'error', code: 'text_occluded', firstSeen: 74.3, lastSeen: 75.5, text: 'Quick overviews' },
      ],
    },
    contrast: { findings: [{ severity: 'error', code: 'contrast', time: 12 }] },
  };
  const out = summariseFindings(report);
  assert.equal(out.length, 3, 'info findings are dropped');
  assert.deepEqual(out.map((f) => f.severity), ['error', 'error', 'warning']);
  assert.deepEqual(out.map((f) => f.from), [12, 74.3, 0.5]);
  assert.equal(out[1].to, 75.5, 'a persistent finding keeps its span');
});

test('a finding is attributed to the beat whose staging caused it', () => {
  assert.equal(beatAt(screenplay, 1.0).id, 'b01');
  assert.equal(beatAt(screenplay, 3.65).id, 'b02', 'a boundary belongs to the beat it starts');
  assert.equal(beatAt(screenplay, 999).id, 'b02', 'past the end clamps to the last beat');
});

test('the report pairs every beat frame with the stage line it must satisfy', () => {
  const md = renderReport({
    slug: 'poc-01',
    samples: beatSampleTimes(screenplay),
    findings: summariseFindings({ layout: { findings: [{ severity: 'error', code: 'text_occluded', firstSeen: 5, text: 'Quick overviews', selector: 'span', containerSelector: 'img', message: 'Text is hidden.' }] } }),
    screenplay,
    sheetFiles: ['contact-sheet-1.jpg'],
  });
  assert.match(md, /b01 · hook · dark · face:full · 1\.82s/);
  assert.match(md, /Roll call\./);
  assert.match(md, /covered by `img`/);
  assert.match(md, /\(b02 turn\)/, 'the finding names its beat, not just a timestamp');
  assert.match(md, /contact-sheet-1\.jpg/);
});
