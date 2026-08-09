import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SLUG_MIGRATION, migrateLedger, checkMigration } from './ledger-migration.mjs';
import { loadSteps } from './steps.mjs';

function realLedgers() {
  const dir = path.join(import.meta.dirname, '..', 'videos');
  return fs.readdirSync(dir)
    .map((video) => ({ video, p: path.join(dir, video, 'run-log.json') }))
    .filter(({ p }) => fs.existsSync(p))
    .map(({ video, p }) => ({ video, ledger: JSON.parse(fs.readFileSync(p, 'utf8')) }));
}

test('every mapped destination is a real step folder', () => {
  const r = checkMigration({ ledgers: [] });
  assert.ok(r.ok, r.errors.join('\n'));
});

test('every key in every real ledger is covered, and nothing is lost', () => {
  const r = checkMigration({ ledgers: realLedgers() });
  assert.ok(r.ok, r.errors.join('\n'));
});

test('migrating twice is a no-op — the map is idempotent on migrated keys', () => {
  for (const { video, ledger } of realLedgers()) {
    const once = migrateLedger(ledger).ledger;
    const twice = migrateLedger(once);
    assert.deepEqual(Object.keys(twice.ledger.steps).sort(), Object.keys(once.steps).sort(),
      `LEDGER-KEY-ORPHANED: re-running the migration on ${video} changed the keys — it must be safe to run twice`);
  }
});

test('a ledger entry under any live step survives migration', () => {
  // The map only renames OLD slugs. A step folder that was created fresh rather
  // than renamed appears on neither side of it, so before this was fixed every
  // such step orphaned any ledger that reached it — 140/150/160 sat unnoticed
  // until consistent-ai-influencer actually recorded its 150 approval
  // (2026-08-07). Looping over every live step means the next new folder cannot
  // repeat it: adding one to steps/ without touching this file stays green.
  const slugs = loadSteps().map((s) => s.slug);
  const ledger = { steps: Object.fromEntries(slugs.map((s) => [s, { status: 'done' }])) };
  const { ledger: next, unmapped } = migrateLedger(ledger);
  assert.deepEqual(unmapped, [],
    `LEDGER-KEY-ORPHANED: live step(s) ${unmapped.join(', ')} would orphan a ledger entry`);
  assert.deepEqual(Object.keys(next.steps).sort(), [...slugs].sort());
});

test('the map has no duplicate destinations', () => {
  const dests = Object.values(SLUG_MIGRATION);
  assert.equal(new Set(dests).size, dests.length,
    'LEDGER-KEY-ORPHANED: two steps map to the same slug — one would overwrite the other in every ledger');
});
