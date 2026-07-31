import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  stepIds,
  stepKind,
  resolveStepId,
  emptyLog,
  readRunLog,
  writeRunLog,
  setStep,
  stepView,
  nextStep,
  summarize,
  renderTable,
  STATUSES,
} from './run-log.mjs';

const TMP_ROOT = path.join(import.meta.dirname, '.test-tmp', 'run-log');
test.before(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
});

function workdir(name) {
  const d = fs.mkdtempSync(path.join(TMP_ROOT, `${name}-`));
  return d;
}

test('step ids come from the steps/ folders', async (t) => {
  await t.test('reads every NNN- folder, in number order', () => {
    const ids = stepIds();
    assert.ok(ids.length >= 15, `expected the real step folders, got ${ids.length}`);
    assert.equal(ids[0], '010-transcribe-run');
    assert.deepEqual([...ids].sort(), ids, 'must come back in step order');
    for (const id of ids) assert.match(id, /^\d{3}-/);
  });

  await t.test('ignores anything that is not a numbered folder', () => {
    const dir = workdir('steps');
    fs.mkdirSync(path.join(dir, '010-real-run'));
    fs.mkdirSync(path.join(dir, 'shared-notes'));
    fs.writeFileSync(path.join(dir, '020-a-file.md'), 'x');
    assert.deepEqual(stepIds(dir), ['010-real-run']);
  });

  await t.test('the folder suffix is the cost signal', () => {
    assert.equal(stepKind('040-sync-graphics-run'), 'script');
    assert.equal(stepKind('030-pick-or-propose-graphics-llm'), 'session');
    assert.equal(stepKind('130-learn-from-feedback-opus'), 'session');
    assert.equal(stepKind('037-approve-card-plan-human'), 'gate');
  });

  await t.test('a step that is both a model pass and a gate reports as both', () => {
    // 038 builds the card, then the owner re-approves it: landing the card
    // flips its plan item new -> existing, which resets card-plan approval.
    assert.equal(stepKind('038-build-cards-llm-and-review-human'), 'session+gate');
    assert.ok(stepIds().includes('038-build-cards-llm-and-review-human'), 'the folder must match the name');
  });
});

test('an invented step name cannot be recorded', async (t) => {
  // This is the whole point of resolving against the folder list. The owner saw
  // the same step called "body cue pass" on one video and "body graphics LLM"
  // on the next, because the name only ever existed in the session's head.
  await t.test('rejects a made-up name and lists the real ones', () => {
    assert.throws(() => resolveStepId('body cue pass'), /unknown step "body cue pass"/);
    assert.throws(() => resolveStepId('body cue pass'), /030-pick-or-propose-graphics-llm/);
  });

  await t.test('accepts the canonical id', () => {
    assert.equal(
      resolveStepId('030-pick-or-propose-graphics-llm'),
      '030-pick-or-propose-graphics-llm',
    );
  });

  await t.test('accepts the bare number and expands it', () => {
    assert.equal(resolveStepId('030'), '030-pick-or-propose-graphics-llm');
    assert.equal(resolveStepId('037'), '037-approve-card-plan-human');
    assert.equal(resolveStepId('038'), '038-build-cards-llm-and-review-human');
  });

  await t.test('rejects an empty step', () => {
    assert.throws(() => resolveStepId(''), /no step given/);
    assert.throws(() => resolveStepId(undefined), /no step given/);
  });
});

test('recording a step', async (t) => {
  await t.test('rejects a status outside the enum', () => {
    assert.throws(() => setStep(emptyLog('v'), '010-transcribe-run', 'finished'), /unknown status/);
    for (const s of STATUSES) {
      const fields = s === 'done' ? { did: 'x', output: 'y' } : {};
      assert.doesNotThrow(() => setStep(emptyLog('v'), '010-transcribe-run', s, fields));
    }
  });

  await t.test('a done step without a summary is refused, not written half-empty', () => {
    assert.throws(
      () => setStep(emptyLog('v'), '030-pick-or-propose-graphics-llm', 'done', { did: 'placed cues' }),
      /needs output/,
    );
    assert.throws(
      () => setStep(emptyLog('v'), '030-pick-or-propose-graphics-llm', 'done', {}),
      /needs did and output/,
    );
  });

  await t.test('an absent issues field becomes an explicit "none found"', () => {
    // A blank must never read as "nobody checked".
    const log = setStep(emptyLog('v'), '040-sync-graphics-run', 'done', {
      did: 'resolved anchors',
      output: 'resolved.json',
    });
    assert.equal(log.steps['040-sync-graphics-run'].issues, 'none found');
  });

  await t.test('running stamps started and clears any old end time', () => {
    let log = setStep(emptyLog('v'), '010-transcribe-run', 'done', { did: 'a', output: 'b' });
    assert.ok(log.steps['010-transcribe-run'].ended);
    log = setStep(log, '010-transcribe-run', 'running');
    assert.ok(log.steps['010-transcribe-run'].started);
    assert.equal(log.steps['010-transcribe-run'].ended, undefined);
  });

  await t.test('a re-run keeps the fields it is not given', () => {
    let log = setStep(emptyLog('v'), '040-sync-graphics-run', 'done', {
      did: 'resolved 23 anchors',
      issues: '2 W7 warnings',
      output: 'resolved.json',
    });
    log = setStep(log, '040-sync-graphics-run', 'done', { output: 'resolved.json (24 cues)' });
    const e = log.steps['040-sync-graphics-run'];
    assert.equal(e.did, 'resolved 23 anchors');
    assert.equal(e.issues, '2 W7 warnings');
    assert.equal(e.output, 'resolved.json (24 cues)');
  });

  await t.test('whitespace-only fields do not satisfy the done requirement', () => {
    assert.throws(
      () => setStep(emptyLog('v'), '010-transcribe-run', 'done', { did: '   ', output: '  ' }),
      /needs did and output/,
    );
  });
});

test('the ledger round-trips through the workdir', () => {
  const dir = workdir('io');
  assert.deepEqual(readRunLog(dir).steps, {}, 'a missing file reads as an empty ledger');
  const log = setStep(emptyLog(path.basename(dir)), '015-map-segments-run', 'done', {
    did: 'measured the source spans',
    output: 'segments.json',
  });
  writeRunLog(dir, log);
  const back = readRunLog(dir);
  assert.equal(back.steps['015-map-segments-run'].did, 'measured the source spans');
  assert.ok(back.updated);
});

test('a corrupt ledger says so instead of silently reading as empty', () => {
  const dir = workdir('corrupt');
  fs.writeFileSync(path.join(dir, 'run-log.json'), '{not json');
  assert.throws(() => readRunLog(dir), /not readable JSON/);
});

test('falling back to the artifacts', async (t) => {
  await t.test('a video that ran before the ledger is not shown as blank', () => {
    const dir = workdir('legacy');
    fs.writeFileSync(path.join(dir, 'transcript.json'), '[]');
    fs.writeFileSync(path.join(dir, 'segments.json'), '{}');
    const view = stepView(dir);
    const byNum = Object.fromEntries(view.map((s) => [s.number, s]));

    assert.equal(byNum['010'].status, 'done');
    assert.equal(byNum['010'].derived, true, 'must be marked derived — no summary was ever written');
    assert.equal(byNum['015'].status, 'done');
    assert.equal(byNum['020'].status, 'todo');
    assert.equal(byNum['010'].did, undefined, 'a derived entry must not invent a summary');
    assert.equal(byNum['020'].derived, undefined, 'an unstarted step has nothing inferred about it');
  });

  await t.test('a recorded entry beats the artifact probe', () => {
    const dir = workdir('recorded');
    fs.writeFileSync(path.join(dir, 'transcript.json'), '[]');
    writeRunLog(
      dir,
      setStep(emptyLog('v'), '010-transcribe-run', 'blocked', { issues: 'groq 401' }),
    );
    const s = stepView(dir).find((v) => v.number === '010');
    assert.equal(s.status, 'blocked');
    assert.ok(!s.derived);
    assert.equal(s.issues, 'groq 401');
  });

  await t.test('030 and 035 are told apart by whether a cue carries a zone', () => {
    const dir = workdir('zones');
    fs.writeFileSync(
      path.join(dir, 'cues.json'),
      JSON.stringify({ cues: [{ id: 'c01', card: 'a' }] }),
    );
    let byNum = Object.fromEntries(stepView(dir).map((s) => [s.number, s]));
    assert.equal(byNum['030'].status, 'done', 'a body cue proves the body pass ran');
    assert.equal(byNum['035'].status, 'todo', 'no zone cue yet');

    fs.writeFileSync(
      path.join(dir, 'cues.json'),
      JSON.stringify({ cues: [{ id: 'c01', card: 'a' }, { id: 'c02', card: 'b', zone: 'intro' }] }),
    );
    byNum = Object.fromEntries(stepView(dir).map((s) => [s.number, s]));
    assert.equal(byNum['035'].status, 'done');
  });

  await t.test('037 needs approval, not just a file', () => {
    const dir = workdir('gate');
    fs.writeFileSync(path.join(dir, 'card-plan.json'), JSON.stringify({ approved: false, sections: [] }));
    assert.equal(stepView(dir).find((s) => s.number === '037').status, 'todo');
    fs.writeFileSync(path.join(dir, 'card-plan.json'), JSON.stringify({ approved: true, sections: [] }));
    assert.equal(stepView(dir).find((s) => s.number === '037').status, 'done');
  });

  await t.test('038 is done when the plan has no NEW cards left', () => {
    const dir = workdir('build');
    const plan = (status) => JSON.stringify({ sections: [{ items: [{ id: 'c01', status }] }] });
    fs.writeFileSync(path.join(dir, 'card-plan.json'), plan('new'));
    assert.equal(stepView(dir).find((s) => s.number === '038').status, 'todo');
    fs.writeFileSync(path.join(dir, 'card-plan.json'), plan('existing'));
    assert.equal(stepView(dir).find((s) => s.number === '038').status, 'done');
  });

  await t.test('unreadable artifacts read as not-done rather than throwing', () => {
    const dir = workdir('junk');
    fs.writeFileSync(path.join(dir, 'cues.json'), '{broken');
    fs.writeFileSync(path.join(dir, 'card-plan.json'), '{broken');
    assert.doesNotThrow(() => stepView(dir));
    assert.equal(stepView(dir).find((s) => s.number === '030').status, 'todo');
  });
});

test('the view answers "where are we"', async (t) => {
  await t.test('nextStep is the first thing not done or skipped', () => {
    const view = [
      { id: 'a', status: 'done' },
      { id: 'b', status: 'skipped' },
      { id: 'c', status: 'todo' },
      { id: 'd', status: 'todo' },
    ];
    assert.equal(nextStep(view).id, 'c');
    assert.equal(nextStep(view.map((s) => ({ ...s, status: 'done' }))), null);
  });

  await t.test('summarize counts each bucket', () => {
    const view = [
      { status: 'done' },
      { status: 'done', derived: true },
      { status: 'running' },
      { status: 'blocked' },
      { status: 'todo' },
    ];
    assert.deepEqual(summarize(view), {
      total: 5,
      done: 2,
      running: 1,
      blocked: 1,
      skipped: 0,
      todo: 1,
      derived: 1,
    });
  });
});

test('the rendered table', async (t) => {
  await t.test('shows all three fields for a recorded done step', () => {
    const out = renderTable([
      {
        id: '030-pick-or-propose-graphics-llm',
        number: '030',
        kind: 'session',
        status: 'done',
        did: 'placed 23 body cues',
        issues: '2 W7 warnings, left as-is',
        output: 'cues.json',
      },
    ]);
    assert.match(out, /\[x\] 030-pick-or-propose-graphics-llm/);
    assert.match(out, /did: {4}placed 23 body cues/);
    assert.match(out, /issues: 2 W7 warnings/);
    assert.match(out, /output: cues\.json/);
  });

  await t.test('says plainly when a step was only inferred', () => {
    const out = renderTable([
      { id: '010-transcribe-run', number: '010', kind: 'script', status: 'done', derived: true },
    ]);
    assert.match(out, /inferred from artifacts, no summary recorded/);
    // The count moved from a parenthetical on the total line into an explicit
    // WARNING naming the steps and the fix — see "inferred steps are surfaced as a
    // warning" below for why a footnote was not enough.
    assert.match(out, /WARNING: 1 step\(s\) have no recorded summary \(010\)/);
  });
});

test('CLI: writes, reads back, and refuses an invented step', () => {
  const dir = workdir('cli');
  const cli = path.join(import.meta.dirname, 'run-log.mjs');

  const bad = spawnSync(process.execPath, [cli, dir, 'body cue pass', 'done'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown step/);

  const noSummary = spawnSync(process.execPath, [cli, dir, '030', 'done'], { encoding: 'utf8' });
  assert.equal(noSummary.status, 1, 'a done step with no summary must fail');

  const ok = spawnSync(
    process.execPath,
    [cli, dir, '030', 'done', '--did', 'placed 23 cues', '--output', 'cues.json'],
    { encoding: 'utf8' },
  );
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /030-pick-or-propose-graphics-llm: done/);

  const shown = spawnSync(process.execPath, [cli, dir], { encoding: 'utf8' });
  assert.equal(shown.status, 0);
  assert.match(shown.stdout, /placed 23 cues/);
  assert.match(shown.stdout, /none found/, 'issues defaulted');
});

// The ledger belongs to a VIDEO workdir. scripts/test-run-sh.sh drives verbs with
// slug "." to assert their printed output, and resolveWorkdir(".") is the pipeline
// root — so an unguarded write drops a run-log.json beside run.sh, where it is
// neither a video's record nor gitignored.
test('a write is refused when the target is the pipeline root', () => {
  const cli = path.join(import.meta.dirname, 'run-log.mjs');
  const root = path.resolve(import.meta.dirname, '..');
  const before = fs.existsSync(path.join(root, 'run-log.json'));

  const w = spawnSync(process.execPath, [cli, '.', '050', 'running'], {
    encoding: 'utf8',
    cwd: root,
  });
  assert.equal(w.status, 1, 'writing to the pipeline root must fail');
  assert.match(w.stderr, /pipeline root/i);
  assert.equal(
    fs.existsSync(path.join(root, 'run-log.json')),
    before,
    'no run-log.json may appear in the pipeline root',
  );

  // Reading stays allowed: `run.sh . status` renders the ledger view.
  const r = spawnSync(process.execPath, [cli, '.'], { encoding: 'utf8', cwd: root });
  assert.equal(r.status, 0, 'reading the root must still work');
});

// A step whose entry was never written shows as done-by-inference. That used to
// render as a quiet parenthetical, so five steps of real work read as "done" with
// no record of what they did or found. It has to announce itself.
test('inferred steps are surfaced as a warning, not a footnote', () => {
  const dir = workdir('derived');
  fs.writeFileSync(path.join(dir, 'transcript.json'), '[]');

  const view = stepView(dir);
  const inferred = view.filter((s) => s.derived);
  assert.ok(inferred.length >= 1, 'transcript.json alone should infer 010 as done');

  const out = renderTable(view);
  assert.match(out, /no recorded summary/i, 'the count must be stated, not just per-row');
  assert.match(out, /run-log\.mjs/, 'it must name the command that fixes it');

  // And it must NOT warn when every done step was actually recorded.
  const clean = workdir('clean');
  fs.writeFileSync(path.join(clean, 'transcript.json'), '[]');
  let log = readRunLog(clean);
  log = setStep(log, '010-transcribe-run', 'done', { did: 'transcribed', output: 'transcript.json' });
  writeRunLog(clean, log);
  const cleanOut = renderTable(stepView(clean));
  assert.doesNotMatch(cleanOut, /no recorded summary/i);
});

test('a skipped step cannot carry did — work means done (owner report 2026-07-31)', () => {
  let log = emptyLog('x');
  assert.throws(
    () => setStep(log, '038-build-cards-llm-and-review-human', 'skipped', { did: 'built a card' }),
    /cannot carry --did/,
  );
  // the why-skipped belongs in issues, which stays legal
  log = setStep(log, '038-build-cards-llm-and-review-human', 'skipped', { issues: 'nothing NEW to build' });
  assert.equal(log.steps['038-build-cards-llm-and-review-human'].status, 'skipped');
});

test('090 infers done from media files only, never the bare renders dir (owner report 2026-07-31)', () => {
  const dir = workdir('renders-proof');
  fs.mkdirSync(path.join(dir, 'renders'), { recursive: true });
  let s090 = stepView(dir).find((s) => s.number === '090');
  assert.equal(s090.status, 'todo', 'an empty renders/ must not infer done');

  fs.writeFileSync(path.join(dir, 'renders', 'probe.png'), '');
  s090 = stepView(dir).find((s) => s.number === '090');
  assert.equal(s090.status, 'todo', 'probe leftovers must not infer done');

  fs.writeFileSync(path.join(dir, 'renders', '0001-c01-card.mp4'), '');
  s090 = stepView(dir).find((s) => s.number === '090');
  assert.equal(s090.status, 'done');
  assert.ok(s090.derived, 'still marked inferred, never a recorded done');
});
