import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import {
  parseSceneLog,
  parseLumaCsv,
  lumaSpikes,
  clusterMoments,
  LUMA_DELTA,
  CLUSTER_GAP
} from './reference-moments.mjs';

test('parseSceneLog parses ffmpeg metadata', () => {
  const text = fs.readFileSync(new URL('./fixtures/reference-scene-log.txt', import.meta.url), 'utf8');
  const scenes = parseSceneLog(text);
  assert.deepStrictEqual(scenes, [
    { t: 1.000, score: 0.3 },
    { t: 4.000, score: 0.4 }
  ]);
});

test('parseLumaCsv and lumaSpikes detect flashes', () => {
  const text = fs.readFileSync(new URL('./fixtures/reference-luma.csv', import.meta.url), 'utf8');
  const rows = parseLumaCsv(text);
  const spikes = lumaSpikes(rows, { delta: LUMA_DELTA });
  
  assert.deepStrictEqual(spikes, [
    { t: 1.000, jump: 30 },
    { t: 4.800, jump: 30 }
  ]);
});

test('clusterMoments merges and ranks moments', () => {
  const scenes = [
    { t: 1.000, score: 0.3 },
    { t: 4.000, score: 0.4 }
  ];
  
  const spikes = [
    { t: 1.000, jump: 30 },
    { t: 4.800, jump: 30 } // within 0.8s of the cut at 4.000
  ];
  
  const clustered = clusterMoments(scenes, spikes, { gap: CLUSTER_GAP });
  
  // They should be clustered as:
  // Cluster 1: [cut at 1.0, flash at 1.0] -> t=1.0, kinds=['cut', 'flash'], max score = 30
  // Cluster 2: [cut at 4.0, flash at 4.8] -> t=4.0, kinds=['cut', 'flash'], max score = 30
  
  assert.deepStrictEqual(clustered.length, 2);
  
  const c1 = clustered.find(c => c.t === 1.000);
  assert.deepStrictEqual(c1, { t: 1.000, kinds: ['cut', 'flash'], score: 30 });
  
  const c2 = clustered.find(c => c.t === 4.000);
  assert.deepStrictEqual(c2, { t: 4.000, kinds: ['cut', 'flash'], score: 30 });
});
