import test from 'node:test';
import assert from 'node:assert';
import { lintCues } from './lint-cues.mjs';

const catalog = {
  cards: [
    { slug: 'fullframe/beat', placement: 'fullframe', pre_beat_render: 'chrome' },
    { slug: 'overlay/beat', placement: 'overlay', pre_beat_render: 'chrome' },
    { slug: 'section/opener', placement: 'fullframe', structural: true },
    { slug: 'overlay/stat-hit', placement: 'overlay' },
    { slug: 'overlay/plain', placement: 'overlay' }
  ]
};

function createResolved(cues) {
  return cues.map(c => {
    let placement = 'overlay';
    if (c.card.startsWith('fullframe') || c.card.startsWith('section')) placement = 'fullframe';
    return {
      id: c.id,
      card: c.card,
      placement,
      start: c.start,
      duration: c.duration || 5
    };
  });
}

function createCues(cues) {
  return {
    cues: cues.map(c => ({
      id: c.id,
      card: c.card,
      flagged: c.flagged || false,
      beats: c.beats || [],
      register: c.register,
      register_why: c.register_why,
      motif: c.motif
    }))
  };
}

function createWords(end) {
  return [{ start: 0, end: 0, text: 'start' }, { start: end, end: end, text: 'end' }];
}

test('E1 stat-hit-cap', () => {
  const c = [
    { id: 'c1', card: 'overlay/stat-hit', start: 10 },
    { id: 'c2', card: 'overlay/stat-hit', start: 110 },
    { id: 'c3', card: 'overlay/stat-hit', start: 210 },
    { id: 'c4', card: 'overlay/stat-hit', start: 310 }
  ];
  const res4 = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c),
    words: createWords(900),
    catalog
  });
  assert(res4.errors.some(e => e.includes('E1 stat-hit-cap')));

  const res3 = lintCues({
    cuesFile: createCues(c.slice(0, 3)),
    resolved: createResolved(c.slice(0, 3)),
    words: createWords(900),
    catalog
  });
  assert(!res3.errors.some(e => e.includes('E1 stat-hit-cap')));
});

test('E2 stat-hit-spacing', () => {
  const cFail = [
    { id: 'c1', card: 'overlay/stat-hit', start: 10 },
    { id: 'c2', card: 'overlay/stat-hit', start: 70 }
  ];
  const resFail = lintCues({
    cuesFile: createCues(cFail),
    resolved: createResolved(cFail),
    words: createWords(900),
    catalog
  });
  assert(resFail.errors.some(e => e.includes('E2 stat-hit-spacing')));

  const cPass = [
    { id: 'c1', card: 'overlay/stat-hit', start: 10 },
    { id: 'c2', card: 'overlay/stat-hit', start: 105 }
  ];
  const resPass = lintCues({
    cuesFile: createCues(cPass),
    resolved: createResolved(cPass),
    words: createWords(900),
    catalog
  });
  assert(!resPass.errors.some(e => e.includes('E2 stat-hit-spacing')));
});

test('E3 card-repetition', () => {
  const c = [
    { id: 'c1', card: 'fullframe/beat', start: 20 },
    { id: 'c2', card: 'fullframe/beat', start: 70 },
    { id: 'c3', card: 'fullframe/beat', start: 120 },
    { id: 'c4', card: 'fullframe/beat', start: 170 }
  ];
  const resFail = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c),
    words: createWords(900),
    catalog
  });
  assert(resFail.errors.some(e => e.includes('E3 card-repetition')));

  const cOverlay = [
    { id: 'c1', card: 'overlay/plain', start: 20 },
    { id: 'c2', card: 'overlay/plain', start: 30 },
    { id: 'c3', card: 'overlay/plain', start: 40 },
    { id: 'c4', card: 'overlay/plain', start: 50 }
  ];
  const resOverlay = lintCues({
    cuesFile: createCues(cOverlay),
    resolved: createResolved(cOverlay),
    words: createWords(900),
    catalog
  });
  assert(!resOverlay.errors.some(e => e.includes('E3 card-repetition')));
});

test('E4 exclusion-zones', () => {
  const cEarly = [{ id: 'c1', card: 'overlay/plain', start: 5 }];
  const resEarly = lintCues({
    cuesFile: createCues(cEarly),
    resolved: createResolved(cEarly),
    words: createWords(900),
    catalog
  });
  assert(!resEarly.errors.some(e => e.includes('E4 exclusion-zones')));

  const cLate = [{ id: 'c1', card: 'overlay/plain', start: 885, duration: 10 }];
  const resLate = lintCues({
    cuesFile: createCues(cLate),
    resolved: createResolved(cLate),
    words: createWords(900),
    catalog
  });
  assert(resLate.errors.some(e => e.includes('E4 exclusion-zones')));

  const cLateBrand = [{ id: 'c1', card: 'brand/outro', start: 885, duration: 10 }];
  const resLateBrand = lintCues({
    cuesFile: createCues(cLateBrand),
    resolved: createResolved(cLateBrand),
    words: createWords(900),
    catalog
  });
  assert(!resLateBrand.errors.some(e => e.includes('E4 exclusion-zones')));

  const cLateLink = [{ id: 'c1', card: 'link-in-description/something', start: 885, duration: 10 }];
  const resLateLink = lintCues({
    cuesFile: createCues(cLateLink),
    resolved: createResolved(cLateLink),
    words: createWords(900),
    catalog
  });
  assert(!resLateLink.errors.some(e => e.includes('E4 exclusion-zones')));

  const cPass = [{ id: 'c1', card: 'overlay/plain', start: 20, duration: 10 }];
  const resPass = lintCues({
    cuesFile: createCues(cPass),
    resolved: createResolved(cPass),
    words: createWords(900),
    catalog
  });
  assert(!resPass.errors.some(e => e.includes('E4 exclusion-zones')));
});

test('W3 total-count scaling', () => {
  const T_10min = 600;
  const c3 = Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, card: 'overlay/plain', start: 20 + i }));
  const res_10min = lintCues({
    cuesFile: createCues(c3),
    resolved: createResolved(c3),
    words: createWords(T_10min),
    catalog
  });
  assert(res_10min.warnings.some(w => w.includes('W3 total-count')));
  
  const T_3min = 180;
  const res_3min = lintCues({
    cuesFile: createCues(c3),
    resolved: createResolved(c3),
    words: createWords(T_3min),
    catalog
  });
  assert(!res_3min.warnings.some(w => w.includes('W3 total-count')));
});

test('W1 fullframe-cadence gap', () => {
  const c = [
    { id: 'c1', card: 'fullframe/beat', start: 20 },
    { id: 'c2', card: 'fullframe/beat', start: 140 }
  ];
  const res = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c),
    words: createWords(900),
    catalog
  });
  assert(res.warnings.some(w => w.includes('W1 fullframe-cadence')));
});

test('W2 overlay-density', () => {
  const c3 = [
    { id: 'c1', card: 'overlay/plain', start: 10 },
    { id: 'c2', card: 'overlay/plain', start: 30 },
    { id: 'c3', card: 'overlay/plain', start: 50 }
  ];
  const res3 = lintCues({
    cuesFile: createCues(c3),
    resolved: createResolved(c3),
    words: createWords(900),
    catalog
  });
  assert(!res3.warnings.some(w => w.includes('W2 overlay-density')));

  const c4 = [
    { id: 'c1', card: 'overlay/plain', start: 10 },
    { id: 'c2', card: 'overlay/plain', start: 20 },
    { id: 'c3', card: 'overlay/plain', start: 30 },
    { id: 'c4', card: 'overlay/plain', start: 40 }
  ];
  const res4 = lintCues({
    cuesFile: createCues(c4),
    resolved: createResolved(c4),
    words: createWords(900),
    catalog
  });
  assert(res4.warnings.some(w => w.includes('W2 overlay-density')));
});

test('W6 and W7 bare-stretch', () => {
  const cFail = [
    { id: 'c1', card: 'overlay/plain', start: 20, duration: 5 },
    { id: 'c2', card: 'overlay/plain', start: 90, duration: 5 },
    { id: 'c3', card: 'overlay/plain', start: 160, duration: 5 }
  ];
  const resFail = lintCues({
    cuesFile: createCues(cFail),
    resolved: createResolved(cFail),
    words: createWords(900),
    catalog,
    segmentsData: {
      segments: [
        { kind: 'narration', start: 0, end: 85 },
        { kind: 'demo', start: 85, end: 200 }
      ]
    }
  });
  assert(resFail.warnings.some(w => w.includes('W7 bare-stretch') && w.includes('70.0s'))); // between c1 and c2
  assert(resFail.warnings.some(w => w.includes('W6 bare-stretch') && w.includes('70.0s'))); // between c2 and c3

  const cPass = [
    { id: 'c1', card: 'overlay/plain', start: 20, duration: 5 },
    { id: 'c2', card: 'overlay/plain', start: 35, duration: 5 },
    { id: 'c3', card: 'overlay/plain', start: 50, duration: 5 },
    { id: 'c4', card: 'overlay/plain', start: 90, duration: 5 }
  ];
  const resPass = lintCues({
    cuesFile: createCues(cPass),
    resolved: createResolved(cPass),
    words: createWords(900),
    catalog,
    segmentsData: {
      segments: [
        { kind: 'narration', start: 0, end: 50 },
        { kind: 'demo', start: 50, end: 200 }
      ]
    }
  });
  assert(!resPass.warnings.some(w => w.includes('W6 bare-stretch')));
  assert(!resPass.warnings.some(w => w.includes('W7 bare-stretch')));
});

test('W4 reveal-wordcount', () => {
  const c = [{
    id: 'c1',
    card: 'fullframe/beat',
    start: 20,
    beats: [{ reveal: { text: 'one two three four five six seven' } }]
  }];
  const resFail = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c),
    words: createWords(900),
    catalog
  });
  assert(resFail.warnings.some(w => w.includes('W4 reveal-wordcount')));
});

test('flagged cues are ignored', () => {
  const c = [
    { id: 'c1', card: 'overlay/plain', start: 890, duration: 10, flagged: true },
    { id: 'c2', card: 'overlay/stat-hit', start: 110 },
    { id: 'c3', card: 'overlay/stat-hit', start: 210 },
    { id: 'c4', card: 'overlay/stat-hit', start: 310 }
  ];
  const res = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c), // createResolved doesn't know about flagged, but lintCues filters it
    words: createWords(900),
    catalog
  });
  // Should only count 3 stat-hits, so no E1
  assert(!res.errors.some(e => e.includes('E1 stat-hit-cap')));
  // c1 is ignored, so no E4 (end zone)
  assert(!res.errors.some(e => e.includes('E4 exclusion-zones')));
});

test('E3 exemption: structural fullframe cards repeat freely (one per compared item)', () => {
  const c = [
    { id: 'c1', card: 'section/opener', start: 20 },
    { id: 'c2', card: 'section/opener', start: 120 },
    { id: 'c3', card: 'section/opener', start: 220 },
    { id: 'c4', card: 'section/opener', start: 320 },
    { id: 'c5', card: 'section/opener', start: 420 }
  ];
  const res = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c),
    words: createWords(900),
    catalog
  });
  assert(!res.errors.some(e => e.includes('E3 card-repetition')));
});

test('E4 short-video guard', () => {
  const c = [{ id: 'c1', card: 'overlay/plain', start: 10 }];
  const res = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c),
    words: createWords(30), // video is 30 seconds
    catalog
  });
  const e4Errors = res.errors.filter(e => e.includes('E4 exclusion zones'));
  assert.equal(e4Errors.length, 1);
  assert.match(e4Errors[0], /video too short/);
});

test('W5 first-beat-idle: fullframe card over threshold is an error', () => {
  const c = [{
    id: 'c1',
    card: 'fullframe/beat',
    start: 20,
    beats: [{ reveal: { text: 'one' }, at: 3.0 }]
  }];
  const res = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c).map(r => ({ ...r, variables: { beats: c[0].beats } })),
    words: createWords(900),
    catalog
  });
  assert(res.errors.some(e => e.includes('W5 first-beat-idle')));
  assert(!res.warnings.some(w => w.includes('W5 first-beat-idle')));
});

test('W5 first-beat-idle: overlay card over threshold is a warning', () => {
  const c = [{
    id: 'c1',
    card: 'overlay/beat',
    start: 20,
    beats: [{ reveal: { text: 'one' }, at: 3.0 }]
  }];
  const res = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c).map(r => ({ ...r, variables: { beats: c[0].beats } })),
    words: createWords(900),
    catalog
  });
  assert(!res.errors.some(e => e.includes('W5 first-beat-idle')));
});

test('E5 demo-coverage: confirmed: true + fullframe inside demo -> error', () => {
  const c = [{ id: 'c1', card: 'fullframe/beat', start: 25, duration: 10 }];
  const res = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c),
    words: createWords(900),
    catalog,
    segmentsData: {
      confirmed: true,
      segments: [
        { kind: 'narration', start: 0, end: 20 },
        { kind: 'demo', start: 20, end: 100 }
      ]
    }
  });
  assert(res.errors.some(e => e.includes('E5 demo-coverage')));
  assert(!res.warnings.some(w => w.includes('E5 demo-coverage')));
});

test('E5 demo-coverage: confirmed: false + fullframe inside demo -> warning', () => {
  const c = [{ id: 'c1', card: 'fullframe/beat', start: 25, duration: 10 }];
  const res = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c),
    words: createWords(900),
    catalog,
    segmentsData: {
      confirmed: false,
      segments: [
        { kind: 'narration', start: 0, end: 20 },
        { kind: 'demo', start: 20, end: 100 }
      ]
    }
  });
  assert(!res.errors.some(e => e.includes('E5 demo-coverage')));
  assert(res.warnings.some(w => w.includes('E5 demo-coverage')));
});

test('E5 demo-coverage: overlay inside demo -> neither', () => {
  const c = [{ id: 'c1', card: 'overlay/plain', start: 25, duration: 10 }];
  const res = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c),
    words: createWords(900),
    catalog,
    segmentsData: {
      confirmed: true,
      segments: [
        { kind: 'narration', start: 0, end: 20 },
        { kind: 'demo', start: 20, end: 100 }
      ]
    }
  });
  assert(!res.errors.some(e => e.includes('E5 demo-coverage')));
  assert(!res.warnings.some(w => w.includes('E5 demo-coverage')));
});

test('W1 fullframe-cadence: narration gap ignores demo segments', () => {
  const c = [
    { id: 'c1', card: 'fullframe/beat', start: 10 },
    { id: 'c2', card: 'fullframe/beat', start: 310 }
  ];
  // elapsed gap is 300s. But if we have a 260s demo between them, narration gap is 40s.
  const res = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c),
    words: createWords(900),
    catalog,
    segmentsData: {
      confirmed: true,
      segments: [
        { kind: 'narration', start: 0, end: 20 },
        { kind: 'demo', start: 20, end: 280 }, // 260s demo
        { kind: 'narration', start: 280, end: 900 }
      ]
    }
  });
  assert(!res.warnings.some(w => w.includes('W1 fullframe-cadence')));
});

test('W1 fullframe-cadence: skip W1 when either endpoint sits in a demo/playback segment', () => {
  const c = [
    { id: 'c1', card: 'fullframe/beat', start: 30 },
    { id: 'c2', card: 'fullframe/beat', start: 140 }
  ];
  const res = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c),
    words: createWords(900),
    catalog,
    segmentsData: {
      confirmed: true,
      segments: [
        { kind: 'narration', start: 0, end: 20 },
        { kind: 'demo', start: 20, end: 200 }
      ]
    }
  });
  assert.equal(res.errors.filter(e => e.includes('E5 demo-coverage')).length, 2);
  assert(!res.warnings.some(w => w.includes('W1 fullframe-cadence')));
});

test('E7 uncovered-second on base:none', () => {
  const c = [
    { id: 'c1', card: 'fullframe/beat', start: 10, duration: 5 },
    { id: 'c2', card: 'fullframe/beat', start: 65, duration: 5 }, // gap of 50s. capped to 20 extension -> hole 35-65
  ];
  const T = 100;
  const res = lintCues({
    cuesFile: createCues(c),
    resolved: createResolved(c),
    words: createWords(T),
    catalog,
    manifest: { base: 'none' }
  });
  assert(res.errors.some(e => e.includes('E7 uncovered-second') && e.includes('[35.0–65.0]')));
});

test('E8 concept-register and W8 motif', () => {
  const conceptData = {
    registers: [
      { from_anchor: 'start of span', to_anchor: 'end of span', register: 'dark' }
    ]
  };
  const words = [
    { start: 10, end: 11, text: 'start' },
    { start: 11, end: 12, text: 'of' },
    { start: 12, end: 13, text: 'span' },
    { start: 50, end: 51, text: 'middle' },
    { start: 90, end: 91, text: 'end' },
    { start: 91, end: 92, text: 'of' },
    { start: 92, end: 93, text: 'span' },
    { start: 100, end: 101, text: 'after' }
  ];

  // E8 mismatch fires
  const cFail = [
    { id: 'c1', card: 'overlay/plain', start: 20, register: 'light' },
    { id: 'c2', card: 'overlay/plain', start: 30, register: 'dark', motif: true }
  ];
  const resFail = lintCues({
    cuesFile: createCues(cFail),
    resolved: createResolved(cFail),
    words,
    catalog,
    conceptData
  });
  assert(resFail.errors.some(e => e.includes('E8 concept-register') && e.includes('c1')));
  // W8 fires at 1 motif cue
  assert(resFail.warnings.some(w => w.includes('W8 motif')));

  // register_why suppresses E8; 2 motifs suppresses W8
  const cPass = [
    { id: 'c1', card: 'overlay/plain', start: 20, register: 'light', register_why: 'because', motif: true },
    { id: 'c2', card: 'overlay/plain', start: 30, register: 'dark', motif: true }
  ];
  const resPass = lintCues({
    cuesFile: createCues(cPass),
    resolved: createResolved(cPass),
    words,
    catalog,
    conceptData
  });
  assert(!resPass.errors.some(e => e.includes('E8 concept-register')));
  assert(!resPass.warnings.some(w => w.includes('W8 motif')));

  // missing conceptData -> all quiet
  const resQuiet = lintCues({
    cuesFile: createCues(cFail),
    resolved: createResolved(cFail),
    words,
    catalog
  });
  assert(!resQuiet.errors.some(e => e.includes('E8 concept-register')));
  assert(!resQuiet.warnings.some(w => w.includes('W8 motif')));
});
