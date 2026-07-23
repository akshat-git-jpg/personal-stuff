import test from 'node:test';
import assert from 'node:assert';
import { planDownloads } from './drive-pull.mjs';

test('planDownloads matches and ignores correctly', () => {
  const listing = `id1\ts01.mp4\tvideo/mp4
id2\ts02.mov\tvideo/quicktime
id3\ts03_wrong.mp4\tvideo/mp4
id4\ts04.txt\ttext/plain
`;
  const sections = [
    { id: 's01', demo: true },
    { id: 's02', demo: true },
    { id: 's03', demo: true }
  ];

  const plan = planDownloads(listing, sections);
  assert.deepStrictEqual(plan.fetches, [
    { id: 'id1', name: 's01.mp4', secId: 's01' },
    { id: 'id2', name: 's02.mov', secId: 's02' }
  ]);
  assert.deepStrictEqual(plan.ignored, ['s03_wrong.mp4', 's04.txt']);
  assert.deepStrictEqual(plan.missing, ['s03']);
});
