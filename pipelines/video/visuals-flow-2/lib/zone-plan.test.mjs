import test from 'node:test';
import assert from 'node:assert';
import { buildZonePlan } from './zone-plan.mjs';

test('zone-plan builder logic', async (t) => {
  await t.test('populates items and categorizes into intro/conclusion', () => {
    const cues = [
      { id: 'c01', at: 1.0, card: 'foo' },
      { id: 'c02', at: 15.0, card: 'bar' },
      { id: 'c03', at: 300.0, card: 'baz' },
    ];
    const structure = [
      { part: 'intro', start: 0, end: 10 },
      { part: 'body', start: 10, end: 200 },
      { part: 'conclusion', start: 200, end: 310 }
    ];
    const resolved = [
      { id: 'c01', start: 1.0, card: 'foo' },
      { id: 'c02', start: 15.0, card: 'bar' },
      { id: 'c03', start: 300.0, card: 'baz' }
    ];
    const catalogSlugs = ['foo', 'baz']; // bar is missing
    
    const zones = buildZonePlan({ structure, resolved, cues, catalogSlugs });
    
    assert.strictEqual(zones.length, 2);
    
    const intro = zones.find(z => z.part === 'intro');
    assert.ok(intro);
    assert.strictEqual(intro.start, 0);
    assert.strictEqual(intro.end, 10);
    assert.strictEqual(intro.items.length, 1);
    assert.strictEqual(intro.items[0].id, 'c01');
    assert.strictEqual(intro.items[0].status, 'existing');
    
    const conclusion = zones.find(z => z.part === 'conclusion');
    assert.ok(conclusion);
    assert.strictEqual(conclusion.start, 200);
    assert.strictEqual(conclusion.end, 310);
    assert.strictEqual(conclusion.items.length, 1);
    assert.strictEqual(conclusion.items[0].id, 'c03');
    assert.strictEqual(conclusion.items[0].status, 'existing');
  });

  await t.test('preserves approval status if zones match (testing change logic)', () => {
    const cues = [{ id: 'c01', at: 1.0, card: 'foo' }];
    const structure = [{ part: 'intro', start: 0, end: 10 }];
    const resolved = [{ id: 'c01', start: 1.0, card: 'foo' }];
    const catalogSlugs = ['foo'];
    
    const prevZones = [
      { part: 'intro', start: 0, end: 10, items: [
        { id: 'c01', at: 1.0, card: 'foo', status: 'existing', placement: null, flagged: false, proposal: null }
      ]}
    ];
    
    const zones = buildZonePlan({ structure, resolved, cues, catalogSlugs });
    const changed = JSON.stringify(prevZones) !== JSON.stringify(zones);
    assert.strictEqual(changed, false);
  });

  await t.test('resets approval status if cues change', () => {
    const cues = [{ id: 'c01', at: 1.0, card: 'foo' }, { id: 'c02', at: 5.0, card: 'new-card' }];
    const structure = [{ part: 'intro', start: 0, end: 10 }];
    const resolved = [{ id: 'c01', start: 1.0, card: 'foo' }, { id: 'c02', start: 5.0, card: 'new-card' }];
    const catalogSlugs = ['foo'];
    
    const prevZones = [
      { part: 'intro', start: 0, end: 10, items: [
        { id: 'c01', at: 1.0, card: 'foo', status: 'existing', placement: null, flagged: false, proposal: null }
      ]}
    ];
    
    const zones = buildZonePlan({ structure, resolved, cues, catalogSlugs });
    const changed = JSON.stringify(prevZones) !== JSON.stringify(zones);
    assert.strictEqual(changed, true);
  });
});
