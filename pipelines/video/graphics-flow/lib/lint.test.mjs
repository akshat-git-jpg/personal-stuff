import test from 'node:test';
import assert from 'node:assert';
import { lintCues } from './lint-cues.mjs';

const catalog = {
  cards: [
    { slug: 'fullframe/beat', placement: 'fullframe' },
    { slug: 'overlay/stat-hit', placement: 'overlay' },
    { slug: 'overlay/plain', placement: 'overlay' }
  ]
};

function createResolved(cues) {
  return cues.map(c => ({
    id: c.id,
    card: c.card,
    start: c.start,
    duration: c.duration || 5
  }));
}

function createCues(cues) {
  return {
    cues: cues.map(c => ({
      id: c.id,
      card: c.card,
      flagged: c.flagged || false,
      beats: c.beats || []
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
  const cEarly = [{ id: 'c1', card: 'overlay/plain', start: 10 }];
  const resEarly = lintCues({
    cuesFile: createCues(cEarly),
    resolved: createResolved(cEarly),
    words: createWords(900),
    catalog
  });
  assert(resEarly.errors.some(e => e.includes('E4 exclusion-zones')));

  const cLate = [{ id: 'c1', card: 'overlay/plain', start: 885, duration: 10 }];
  const resLate = lintCues({
    cuesFile: createCues(cLate),
    resolved: createResolved(cLate),
    words: createWords(900),
    catalog
  });
  assert(resLate.errors.some(e => e.includes('E4 exclusion-zones')));

  const cPass = [{ id: 'c1', card: 'overlay/plain', start: 20, duration: 10 }];
  const resPass = lintCues({
    cuesFile: createCues(cPass),
    resolved: createResolved(cPass),
    words: createWords(900),
    catalog
  });
  assert(!resPass.errors.some(e => e.includes('E4 exclusion-zones')));
});

test('W3 scaling', () => {
  const T = 900; // 15 min
  const minCues = Math.floor(18 * (T / 1800)); // 9
  const maxCues = Math.ceil(28 * (T / 1800)); // 14
  
  // 30 cues
  const c30 = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, card: 'overlay/plain', start: 20 + i }));
  const res30 = lintCues({
    cuesFile: createCues(c30),
    resolved: createResolved(c30),
    words: createWords(T),
    catalog
  });
  assert(res30.warnings.some(w => w.includes('W3 total-count')));
  
  // 12 cues
  const c12 = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, card: 'overlay/plain', start: 20 + i }));
  const res12 = lintCues({
    cuesFile: createCues(c12),
    resolved: createResolved(c12),
    words: createWords(T),
    catalog
  });
  assert(!res12.warnings.some(w => w.includes('W3 total-count')));
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
    { id: 'c1', card: 'overlay/stat-hit', start: 10, flagged: true },
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
  // c1 is ignored, so no E4 (start < 15)
  assert(!res.errors.some(e => e.includes('E4 exclusion-zones')));
});
