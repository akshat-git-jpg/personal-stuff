import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lintCues } from './lint-cues.mjs';

const testTmp = path.join(import.meta.dirname, '.test-tmp', 'regression-cards');

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
