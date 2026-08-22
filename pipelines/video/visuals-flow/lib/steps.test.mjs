import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  STEPS_DIR,
  loadSteps,
  loadVerbs,
  validateStep,
  findStep,
  stepSlug,
  stepDir,
  allVerbs,
  usageEntries,
  suggestVerbs,
  nextStep,
  nextHintLine,
} from './steps.mjs';

// THE POINT OF THIS FILE. The step list used to be hand-encoded in six places
// and two lib modules resolved step FOLDER NAMES at runtime, so renumbering a
// step broke running code with nothing to catch it. Every test below loops the
// REAL registry rather than a fixture list, so a step added tomorrow is
// covered by all of them the moment its folder exists.

const STEPS = loadSteps();

function stepFolders() {
  return fs
    .readdirSync(STEPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{3}-/.test(d.name))
    .map((d) => d.name)
    .sort();
}

test('every numbered step folder declares a step.json', () => {
  const missing = stepFolders().filter((f) => !fs.existsSync(path.join(STEPS_DIR, f, 'step.json')));
  assert.deepEqual(
    missing,
    [],
    `these step folders have no step.json, so the driver, the ledger and PIPELINE.md cannot see them — write one (copy any neighbour's): ${missing.join(', ')}`,
  );
});

test('the whole registry loads and validates', () => {
  assert.equal(STEPS.length, stepFolders().length);
  assert.ok(STEPS.length >= 21, `expected the real registry, got ${STEPS.length} steps`);
  for (const s of STEPS) assert.doesNotThrow(() => validateStep(s, s.slug));
});

test('numbers are unique and sort the same way the folders do', () => {
  const numbers = STEPS.map((s) => s.number);
  assert.equal(new Set(numbers).size, numbers.length, `duplicate step number in ${numbers.join(', ')}`);
  assert.deepEqual([...numbers].sort(), numbers, 'loadSteps must return steps in number order');
  assert.deepEqual(
    STEPS.map((s) => s.slug),
    stepFolders(),
    'the registry order must match the folder order',
  );
});

test('no two steps claim the same verb, and no step verb collides with a helper', () => {
  const seen = new Map();
  for (const s of STEPS) {
    for (const v of s.verbs) {
      assert.ok(!seen.has(v), `verb "${v}" is claimed by both ${seen.get(v)} and ${s.slug}`);
      seen.set(v, s.slug);
    }
  }
  for (const v of Object.keys(loadVerbs())) {
    assert.ok(!seen.has(v), `_verbs.json declares "${v}", which step ${seen.get(v)} already owns`);
  }
});

test('every declared artifact path is relative to videos/<slug>/', () => {
  for (const s of STEPS) {
    const paths = [...s.consumes, ...s.produces, ...(s.gate ? [s.gate.file] : [])];
    for (const p of paths) {
      assert.ok(!p.startsWith('/'), `${s.slug}: "${p}" must not be absolute`);
      assert.ok(!p.split('/').includes('..'), `${s.slug}: "${p}" must not escape the workdir`);
    }
  }
});

test('a gate and a board tab imply each other', () => {
  for (const s of STEPS) {
    if (s.gate) assert.ok(s.tab, `${s.slug} holds a gate but no tab — it could never be approved`);
    if (s.tab) assert.ok(s.gate, `${s.slug} names a tab but holds no gate`);
  }
});

test('every step declares an effect: an artifact, a gate, or external output', () => {
  for (const s of STEPS) {
    assert.ok(
      s.produces.length || s.gate || s.external === true,
      `${s.slug} writes nothing, gates nothing and is not external — the next-hint walk and the generated table both read it as a no-op`,
    );
  }
});

test('every step declares a valid track', () => {
  for (const s of STEPS) {
    assert.match(s.track, /^(intro|main)$/, `${s.slug} has track "${s.track}"`);
  }
  // The intro track is exactly 110-160 — the bespoke intro film. Everything
  // else, including 440 (which rejoins main with the real avatar clips), is main.
  const introSlugs = STEPS.filter((s) => s.track === 'intro').map((s) => s.slug);
  assert.deepEqual(introSlugs, [
    '110-propose-intro-idea-llm',
    '120-approve-intro-idea-human',
    '130-author-intro-screenplay-llm',
    '140-review-intro-frames-run',
    '150-approve-intro-film-human',
    '160-render-intro-film-run',
  ]);
});

test('stepDir resolves a step by number, verb or slug — all to one folder', () => {
  const byNumber = stepDir('210');
  const byVerb = stepDir('cue-pass');
  const bySlug = stepDir('210-author-body-cues-llm');
  assert.equal(byNumber, byVerb);
  assert.equal(byNumber, bySlug);
  assert.ok(fs.existsSync(byNumber), `${byNumber} must exist on disk`);
  // The property, over the whole registry rather than one hand-picked step.
  for (const s of STEPS) {
    assert.equal(stepSlug(s.number), s.slug);
    assert.equal(findStep(s.slug).slug, s.slug);
    for (const v of s.verbs) assert.equal(stepSlug(v), s.slug);
    assert.ok(fs.existsSync(stepDir(s.number)), `steps/${s.slug} must exist`);
  }
});

test('an unknown ref is refused with E-REG, not resolved to something near it', () => {
  assert.throws(() => stepDir('nope'), /E-REG/);
  assert.throws(() => stepDir('031'), /E-REG/);
});

test('every required field is required — deleting any one of them throws E-REG', () => {
  const good = STEPS.find((s) => s.slug === '210-author-body-cues-llm');
  const required = [
    'slug',
    'number',
    'title',
    'actor',
    'verbs',
    'consumes',
    'produces',
    'gate',
    'tab',
    'external',
    'optional',
    'track',
  ];
  for (const field of required) {
    const broken = { ...good };
    delete broken[field];
    assert.throws(
      () => validateStep(broken, good.slug),
      /E-REG/,
      `a step.json missing "${field}" must be refused at load`,
    );
  }
});

test('a malformed field value is refused too', () => {
  const good = STEPS.find((s) => s.slug === '210-author-body-cues-llm');
  const bad = [
    ['slug', 'something-else'],
    ['number', '30'],
    ['title', ''],
    ['actor', 'robot'],
    ['verbs', 'cue-pass'],
    ['produces', [1]],
    ['produces', ['/etc/passwd']],
    ['consumes', ['../other/thing.json']],
    ['gate', { file: 'x.json', field: 'approved' }],
    ['summary', ''],
    ['track', 'side'],
    ['track', ''],
    ['modes', []],
    ['modes', ['banana']],
    ['modes', 'simple'],
  ];
  for (const [field, value] of bad) {
    assert.throws(
      () => validateStep({ ...good, [field]: value }, good.slug),
      /E-REG/,
      `${field}=${JSON.stringify(value)} must be refused`,
    );
  }
  // Blanking `produces` is the single easiest way to make a step invisible to
  // every consumer, so it is refused rather than accepted as "produces nothing".
  assert.throws(() => validateStep({ ...good, produces: [] }, good.slug), /E-REG/);
  assert.doesNotThrow(() => validateStep({ ...good, modes: ['simple'] }, good.slug), 'a valid modes array passes');
  assert.doesNotThrow(() => validateStep({ ...good, modes: ['simple', 'complex'] }, good.slug), 'a valid modes array passes');
});


test('consumes/produces form a DAG — nothing consumes what a later step produces', () => {
  const producedBy = new Map();
  for (const s of STEPS) for (const f of s.produces) if (!producedBy.has(f)) producedBy.set(f, s);
  const produced = new Set();
  for (const s of STEPS) {
    for (const f of s.consumes) {
      const producer = producedBy.get(f);
      if (!producer) continue; // produced by a helper verb or supplied by the owner
      assert.ok(
        produced.has(f) || producer.number === s.number,
        `${s.slug} consumes "${f}", which only ${producer.slug} produces — that is a backward edge, and the status next-hint walks this order`,
      );
    }
    for (const f of s.produces) produced.add(f);
  }
});

test('_verbs.json holds only non-step commands, each with a known kind', () => {
  const verbs = loadVerbs();
  assert.ok(Object.keys(verbs).length > 0);
  for (const [v, def] of Object.entries(verbs)) {
    assert.match(def.kind, /^(meta|helper|stage|composite)$/, `${v} has kind "${def.kind}"`);
  }
  assert.throws(() => loadVerbs({ dir: path.join(STEPS_DIR, 'nope') }), /E-REG/);
});

test('allVerbs is every step verb plus every helper, with no duplicates', () => {
  const verbs = allVerbs();
  assert.equal(new Set(verbs).size, verbs.length, 'a verb must appear once');
  for (const s of STEPS) for (const v of s.verbs) assert.ok(verbs.includes(v), `${v} is missing`);
  for (const v of Object.keys(loadVerbs())) assert.ok(verbs.includes(v), `${v} is missing`);
  assert.equal(verbs[0], 'status', 'status leads the usage list');
  // usage() prints one line per entry, and only `configure` carries flags.
  const entries = usageEntries();
  assert.deepEqual(entries.map((e) => e.verb), verbs);
  assert.ok(entries.find((e) => e.verb === 'configure').usageArgs.includes('--drive-folder'));
});

test('a near-miss verb is named rather than just refused', () => {
  assert.deepEqual(suggestVerbs('cuepass'), ['cue-pass']);
  assert.ok(suggestVerbs('rende').includes('render'));
  assert.deepEqual(suggestVerbs('xyz'), []);
});

// --------------------------------------------------------------------------
// nextStep — the status next-hint, one entry per track (plan 199). Before the
// tracks existed, this returned a single first-unsatisfied step across the
// whole registry, so an owner gate on the intro film stopped the walk before
// it ever reached the card track.
// --------------------------------------------------------------------------

function probes(present = [], approved = []) {
  const has = new Set(present);
  const ok = new Set(approved);
  return {
    exists: (f) => has.has(f),
    readFlag: (f, field) => ok.has(`${f}:${field}`),
  };
}

test('a fresh workdir parks on the first step of each track', () => {
  const next = nextStep({ ...probes(), mode: 'complex' });
  assert.equal(next.main.number, '010');
  assert.equal(next.intro.number, '110');
});

test('the intro track walks 110 (idea) -> 120 (idea gate) -> 130 (screenplay) -> 140 (review) -> 150 (film gate) -> 160 (render), independent of main', () => {
  const mainDone = ['run-config.json', 'vo.mp3', 'transcript.json', 'transcript.diff.json', 'segments.json', 'concept.json'];

  const idea = nextStep({ ...probes(mainDone), mode: 'complex' });
  assert.equal(idea.intro.number, '110', 'without an idea proposal, the video parks on the idea pass');

  const ideaGate = nextStep({ ...probes([...mainDone, 'intro-film/idea.json']), mode: 'complex' });
  assert.equal(ideaGate.intro.number, '120', 'an unapproved idea parks on its own gate');

  const ideaApproved = [...mainDone, 'intro-film/idea.json'];
  const ideaApprovals = ['intro-film/idea.json:approved'];

  const authoring = nextStep({ ...probes(ideaApproved, ideaApprovals), mode: 'complex' });
  assert.equal(authoring.intro.number, '130', 'an approved idea moves on to authoring the screenplay');

  const review = nextStep({ ...probes([...ideaApproved, 'intro-film/screenplay.json'], ideaApprovals), mode: 'complex' });
  assert.equal(review.intro.number, '140', 'a screenplay with no review moves to the review pass');

  const filmGate = nextStep({
    ...probes([...ideaApproved, 'intro-film/screenplay.json', 'intro-film/review/REVIEW.md'], ideaApprovals),
    mode: 'complex'
  });
  assert.equal(filmGate.intro.number, '150', 'a reviewed screenplay parks on the film gate');
  assert.equal(filmGate.intro.gate.label, 'Intro Film');

  const render = nextStep({
    ...probes(
      [...ideaApproved, 'intro-film/screenplay.json', 'intro-film/review/REVIEW.md'],
      [...ideaApprovals, 'intro-film/screenplay.json:approved'],
    ),
    mode: 'complex'
  });
  assert.equal(render.intro.number, '160', 'an approved film moves on to the render');
});

test('TRACKS-SERIALISED: an intro gate must not block the card track', () => {
  // 120 (approve the intro idea) unapproved, main track fully satisfied up to
  // the cue pass. The intro track must park on 120; the main hint must still
  // advance to 210, not get stuck behind the intro gate.
  const present = [
    'run-config.json', 'vo.mp3', 'transcript.json', 'transcript.diff.json', 'segments.json', 'concept.json',
    'intro-film/idea.json',
  ];
  const next = nextStep({ ...probes(present), mode: 'complex' });
  assert.equal(next.intro.number, '120', 'TRACKS-SERIALISED: the intro track should park on its own gate');
  assert.equal(next.main.number, '210', 'TRACKS-SERIALISED: an intro gate must not block the card track');
});

test('a finished video reports nothing left to do, on either track', () => {
  const everything = [];
  const approvals = [];
  for (const s of STEPS) {
    everything.push(...s.produces);
    if (s.gate) approvals.push(`${s.gate.file}:${s.gate.field}`);
  }
  const next = nextStep({ ...probes(everything, approvals) });
  assert.equal(next.main, null);
  assert.equal(next.intro, null);
});

test('nextHintLine prints one line per track that still has work', () => {
  const cue = STEPS.find((s) => s.number === '210');
  const idea = STEPS.find((s) => s.number === '110');
  const out = nextHintLine('demo', { intro: idea, main: cue });
  const lines = out.split('\n');
  assert.equal(lines.length, 2, `expected two next: lines, got:\n${out}`);
  assert.match(lines[0], /^next: .*110 propose the intro idea/);
  assert.match(lines[1], /^next: run\.sh demo cue-pass  \(210 pick or propose graphics\)/);
});

test('nextHintLine drops a track once it is satisfied, and collapses to one line when both are', () => {
  const cue = STEPS.find((s) => s.number === '210');
  const introOnly = nextHintLine('demo', { intro: null, main: cue });
  assert.equal(introOnly.split('\n').length, 1);
  assert.match(introOnly, /210 pick or propose graphics/);

  const done = nextHintLine('demo', { intro: null, main: null });
  assert.match(done, /nothing/);
  assert.equal(done.split('\n').length, 1);
});

test('the next: line names a verb, or the gate text the step carries', () => {
  const cue = STEPS.find((s) => s.number === '210');
  assert.equal(nextHintLine('demo', { main: cue, intro: null }), 'next: run.sh demo cue-pass  (210 pick or propose graphics)');
  const finalCut = STEPS.find((s) => s.number === '530');
  const out = nextHintLine('demo', { main: finalCut, intro: null });
  assert.match(out, /HUMAN GATE 3/);
  assert.ok(!out.includes('<slug>'), '<slug> must be substituted');
  assert.match(nextHintLine('demo', { main: null, intro: null }), /nothing/);
});

// --------------------------------------------------------------------------
// The couplings this registry exists to remove.
// --------------------------------------------------------------------------

test('no lib/ source resolves a step folder by its literal name', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['.test-tmp', 'fixtures', 'node_modules'].includes(e.name)) continue;
        walk(p);
      } else if (e.name.endsWith('.mjs') && !e.name.endsWith('.test.mjs') && e.name !== 'steps.mjs') {
        if (/['"]steps['"]/.test(fs.readFileSync(p, 'utf8'))) {
          offenders.push(path.relative(import.meta.dirname, p));
        }
      }
    }
  };
  walk(import.meta.dirname);
  assert.deepEqual(
    offenders,
    [],
    `these files build a path into steps/ by hand — use stepDir(<number>) from lib/steps.mjs, or a renumber breaks them silently: ${offenders.join(', ')}`,
  );
});

test('every board tab the registry names is a real board tab', () => {
  const router = fs.readFileSync(
    path.join(import.meta.dirname, '..', 'board-ui', 'src', 'lib', 'router.ts'),
    'utf8',
  );
  for (const s of STEPS) {
    if (!s.tab) continue;
    assert.ok(
      router.includes(`'${s.tab}'`),
      `${s.slug} reviews on tab "${s.tab}", which board-ui/src/lib/router.ts does not know`,
    );
  }
});
