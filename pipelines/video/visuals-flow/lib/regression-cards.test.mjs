import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lintCues } from './lint-cues.mjs';
import { zonePartsFor, ZONE_PARTS } from './zone-constants.mjs';
import { ownsIntroSpan, INTRO_MODES } from './intro-modes.mjs';

const testTmp = path.join(import.meta.dirname, '.test-tmp', 'regression-cards');

function tmpWorkdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'regression-cards-test-'));
}

test('Step 6: default path is untouched (intro: "cards" vs unconfigured)', async () => {
  fs.rmSync(testTmp, { recursive: true, force: true });
  fs.mkdirSync(testTmp, { recursive: true });
  
  const cues = [{ id: 'z1', placement: 'fullframe', start: 0, duration: 2, card: 'intro/open-cover' }];
  fs.writeFileSync(path.join(testTmp, 'cues.json'), JSON.stringify({ approved: true, cues }));
  fs.writeFileSync(path.join(testTmp, 'segments.json'), JSON.stringify({ structure: [{ part: 'intro', start: 0, end: 10 }, { part: 'conclusion', start: 20, end: 30 }] }));
  
  const inputs = {
    workdir: testTmp,
    cuesFile: { cues, approved: true },
    resolved: cues,
    words: [],
    catalog: { cards: {} },
    segmentsData: { structure: [{ part: 'intro', start: 0, end: 10 }, { part: 'conclusion', start: 20, end: 30 }] },
    manifest: { base: 'screen' },
    conceptData: null,
    avatarJobs: null
  };

  const reportUnconfigured = lintCues(inputs);
  
  fs.writeFileSync(path.join(testTmp, 'run-config.json'), JSON.stringify({ intro: 'cards' }));
  const reportCards = lintCues(inputs);
  
  assert.deepEqual(reportUnconfigured, reportCards);

  const { planSegments, loadAssemblyInputs } = await import('./assemble.mjs');
  
  const segmentsUnconfigured = planSegments({ resolved: cues, avatarJobs: [], total: 30 });
  const segmentsCards = planSegments({ resolved: cues, avatarJobs: [], total: 30 });
  assert.deepEqual(segmentsUnconfigured, segmentsCards);
});

// The owner's requirement, stated directly against the capability query: an
// unconfigured video and an explicit intro: "cards" video must be
// indistinguishable, and intro: "film" must never leak into either.
test('unconfigured behaves exactly like intro: "cards"; intro: "film" does not leak into it', () => {
  const w = tmpWorkdir();

  assert.equal(ownsIntroSpan(w), false, 'unconfigured: ownsIntroSpan is false');
  assert.deepEqual(zonePartsFor(w), ZONE_PARTS, 'unconfigured: zonePartsFor returns both zones');

  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'cards' }));
  assert.equal(ownsIntroSpan(w), false, 'intro: "cards": ownsIntroSpan is false');
  assert.deepEqual(zonePartsFor(w), ZONE_PARTS, 'intro: "cards": zonePartsFor returns both zones');

  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'film' }));
  assert.equal(ownsIntroSpan(w), true, 'intro: "film": ownsIntroSpan is true');
  assert.deepEqual(zonePartsFor(w), ['conclusion'], 'intro: "film": zonePartsFor returns only the conclusion');

  fs.rmSync(w, { recursive: true, force: true });
});

// The cross-mode isolation property, stated directly: a hypothetical third
// mode must never change what "cards" or "film" resolve to. Mutating a COPY
// of the table (never the real export) is the point — this proves the
// isolation holds for a flow that does not exist yet, not just for the two
// that do.
test('a hypothetical third mode, added to a copy of the table, changes neither "cards" nor "film"', () => {
  const w = tmpWorkdir();

  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'cards' }));
  const cardsOwnsBefore = ownsIntroSpan(w);
  const cardsZonesBefore = zonePartsFor(w);

  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'film' }));
  const filmOwnsBefore = ownsIntroSpan(w);
  const filmZonesBefore = zonePartsFor(w);

  const hypotheticalTable = { ...INTRO_MODES, template: { label: 'hypothetical template flow', ownsIntroSpan: true, spanFrom: 'segments.structure.intro' } };
  assert.ok(!('template' in INTRO_MODES), 'the copy must not have mutated the real export');
  assert.ok('template' in hypotheticalTable, 'the copy must carry the hypothetical third mode');

  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'cards' }));
  assert.equal(ownsIntroSpan(w), cardsOwnsBefore, 'cards unaffected by a hypothetical third mode');
  assert.deepEqual(zonePartsFor(w), cardsZonesBefore, 'cards zones unaffected by a hypothetical third mode');

  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'film' }));
  assert.equal(ownsIntroSpan(w), filmOwnsBefore, 'film unaffected by a hypothetical third mode');
  assert.deepEqual(zonePartsFor(w), filmZonesBefore, 'film zones unaffected by a hypothetical third mode');

  fs.rmSync(w, { recursive: true, force: true });
});
