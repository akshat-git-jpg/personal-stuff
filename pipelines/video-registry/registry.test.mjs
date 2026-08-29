import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resolveKey, mint, addAlias, list, save, load, isValidKey, namesFor,
  ensure, whereIs, unregisteredDirs, PIPELINE_VIDEO_ROOTS,
} from './lib/registry.mjs';
import { planSync } from './lib/tracker.mjs';
import {
  planClicksDb, planDesk, diffInvariants, findCollisions, partitionCollisions,
  INVARIANT_QUERIES,
} from './lib/migrate-keys.mjs';

function tmpReg() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vreg-'));
  return path.join(dir, 'videos.json');
}
const empty = () => ({ version: 1, videos: {} });

test('resolves an exact key to itself', () => {
  const reg = mint('ai-avatar-generators', { title: 'T', minted: '2026-08-09' }, empty());
  assert.equal(resolveKey('ai-avatar-generators', reg), 'ai-avatar-generators');
});

test('resolves an alias to its canonical key', () => {
  let reg = mint('ai-avatar-generators', { title: 'T', minted: '2026-08-09' }, empty());
  reg = addAlias('ai-avatar-generators', 'best-ai-video-generator', reg);
  assert.equal(resolveKey('best-ai-video-generator', reg), 'ai-avatar-generators');
});

test('returns null for an unknown name instead of throwing', () => {
  const reg = empty();
  assert.equal(resolveKey('never-heard-of-it', reg), null);
  assert.equal(resolveKey('', reg), null);
  assert.equal(resolveKey(undefined, reg), null);
});

test('refuses a key that collides with an existing key or alias', () => {
  let reg = mint('one', { minted: '2026-08-09' }, empty());
  reg = addAlias('one', 'uno', reg);
  assert.throws(() => mint('one', {}, reg), /already resolves/);
  assert.throws(() => mint('uno', {}, reg), /already resolves/);
});

test('rejects a malformed key', () => {
  assert.equal(isValidKey('Good-Slug'), false);
  assert.equal(isValidKey('good-slug'), true);
  assert.equal(isValidKey('trailing-'), false);
  assert.equal(isValidKey(''), false);
  assert.throws(() => mint('Not A Slug', {}, empty()), /not a valid key/);
});

test('namesFor returns the key plus its aliases', () => {
  let reg = mint('one', { minted: '2026-08-09' }, empty());
  reg = addAlias('one', 'uno', reg);
  assert.deepEqual(namesFor('one', reg), ['one', 'uno']);
  assert.deepEqual(namesFor('nope', reg), []);
});

test('save writes keys sorted and load round-trips', () => {
  const file = tmpReg();
  let reg = empty();
  reg = mint('zulu', { minted: '2026-08-09' }, reg);
  reg = mint('alpha', { minted: '2026-08-09' }, reg);
  save(reg, file);
  assert.deepEqual(Object.keys(load(file).videos), ['alpha', 'zulu']);
  assert.equal(list(load(file)).length, 2);
});

// --- the symmetric entry point: whichever pipeline gets there first mints ---

test('ensure mints when the name is new', () => {
  const { key, minted, reg } = ensure('brand-new-video', { title: 'T' }, empty());
  assert.equal(key, 'brand-new-video');
  assert.equal(minted, true);
  assert.equal(resolveKey('brand-new-video', reg), 'brand-new-video');
});

test('ensure is idempotent — a second call mints nothing', () => {
  const first = ensure('a-video', {}, empty());
  const second = ensure('a-video', {}, first.reg);
  assert.equal(second.key, 'a-video');
  assert.equal(second.minted, false);
  assert.equal(Object.keys(second.reg.videos).length, 1);
});

test('ensure called with an ALIAS returns the canonical key and mints nothing', () => {
  // The whole point: pipeline B starts a video under the name it knows and gets
  // back the key pipeline A already minted, instead of forking the identity.
  let reg = mint('canonical-name', {}, empty());
  reg = addAlias('canonical-name', 'other-name', reg);
  const { key, minted } = ensure('other-name', {}, reg);
  assert.equal(key, 'canonical-name');
  assert.equal(minted, false);
});

// --- cross-pipeline lookup ---

test('whereIs reports a slot per pipeline', () => {
  const spots = whereIs('anything-at-all');
  assert.deepEqual(Object.keys(spots).sort(), Object.keys(PIPELINE_VIDEO_ROOTS).sort());
  for (const s of Object.values(spots)) {
    assert.equal(typeof s.exists, 'boolean');
    assert.ok(path.isAbsolute(s.path));
  }
});

test('whereIs finds a folder that sits under an ALIAS, not the canonical key', () => {
  // Regression: checking only the canonical name reported "missing" for the
  // script-side folder of best-ai-video-generator, which is on disk as
  // ai-video-tools-comparison. Aliasing exists so folders never move, so
  // whereIs must look under every registered name.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vreg-whereis-'));
  const reg = empty();
  reg.videos['best-ai-video-generator'] = { aliases: ['ai-video-tools-comparison'] };

  fs.mkdirSync(path.join(dir, PIPELINE_VIDEO_ROOTS.script, 'ai-video-tools-comparison'), { recursive: true });
  fs.mkdirSync(path.join(dir, PIPELINE_VIDEO_ROOTS.visuals, 'best-ai-video-generator'), { recursive: true });

  const spots = whereIs('best-ai-video-generator', dir, reg);
  assert.equal(spots.script.exists, true, 'script-side folder should be found under its alias');
  assert.equal(spots.script.name, 'ai-video-tools-comparison');
  assert.equal(spots.visuals.exists, true);
  assert.equal(spots.visuals.name, 'best-ai-video-generator');
});

// --- assertions against the committed registry ---

test('unregisteredDirs is empty for the committed registry', () => {
  assert.deepEqual(unregisteredDirs(), []);
});

test('the committed registry links the script and visuals folders of the same video', () => {
  assert.equal(resolveKey('ai-video-tools-comparison'), 'best-ai-video-generator');
});

test('the committed registry does NOT link the two avatar-adjacent videos', () => {
  // ai-avatar-generators is HeyGen/Synthesia talking heads; consistent-ai-influencer
  // is Nano Banana/Flux image consistency. Related topics, different videos.
  assert.equal(resolveKey('consistent-ai-influencer'), 'consistent-ai-influencer');
  assert.equal(resolveKey('ai-avatar-generators'), 'ai-avatar-generators');
});

test('the committed registry parses and every entry is well-formed', () => {
  const reg = load();
  for (const v of list(reg)) {
    assert.ok(isValidKey(v.key), `bad key: ${v.key}`);
    assert.ok(Array.isArray(v.aliases), `${v.key} has no aliases array`);
    assert.match(v.minted, /^\d{4}-\d{2}-\d{2}$/, `${v.key} has a bad minted date`);
    for (const a of v.aliases) assert.ok(isValidKey(a), `${v.key} has a bad alias: ${a}`);
  }
});

const REG = {
  version: 1,
  videos: {
    "best-ai-video-generator": { title: "Best AI Video Software", minted: "2026-07-31", aliases: ["ai-video-tools-comparison"] },
    "opusclip-vs-submagic": { title: "OpusClip vs Submagic", minted: "2026-08-04", aliases: [], card_id: "row_9" },
  },
};
const TODAY = "2026-08-25";

test("mints a card whose slug is unknown", () => {
  const p = planSync([{ id: "row_1", slug: "brand-new-video", title: "Brand New" }], REG, TODAY);
  assert.deepStrictEqual(p.mints, [{ key: "brand-new-video", title: "Brand New", card_id: "row_1", minted: TODAY }]);
});

test("does not re-mint a slug that resolves through an ALIAS", () => {
  const p = planSync([{ id: "row_2", slug: "ai-video-tools-comparison", title: "x" }], REG, TODAY);
  assert.deepStrictEqual(p.mints, []);
});

test("stamps card_id onto an existing entry that has none", () => {
  const p = planSync([{ id: "row_2", slug: "best-ai-video-generator", title: "x" }], REG, TODAY);
  assert.deepStrictEqual(p.stamps, [{ key: "best-ai-video-generator", card_id: "row_2" }]);
});

test("skips a card with no slug", () => {
  const p = planSync([{ id: "row_3", slug: null, title: "No slug yet" }], REG, TODAY);
  assert.deepStrictEqual(p, { mints: [], stamps: [], skipped: [] });
});

test("reports a card_id conflict instead of overwriting", () => {
  const p = planSync([{ id: "row_99", slug: "opusclip-vs-submagic", title: "x" }], REG, TODAY);
  assert.strictEqual(p.skipped.length, 1);
  assert.strictEqual(p.skipped[0].reason, "card_id conflict");
  assert.deepStrictEqual(p.stamps, []);
});

test("a second identical sync is a no-op", () => {
  const rows = [{ id: "row_9", slug: "opusclip-vs-submagic", title: "OpusClip vs Submagic" }];
  const p = planSync(rows, REG, TODAY);
  assert.deepStrictEqual(p, { mints: [], stamps: [], skipped: [] });
});

// --- plan 241: the ordered key migration for clicks-db and the script desk ---
// These assertions exist to stop a future refactor reordering the statements.
// The order is the entire point: it keeps links.video_code -> videos.video_code
// valid at every single step, so no PRAGMA is needed anywhere.

test("clicks-db: insert must precede the links update", () => {
  const s = planClicksDb([{ oldCode: "aB3xY9", newKey: "best-ai-video-generator" }]);
  assert.strictEqual(s.length, 3);
  assert.match(s[0].sql, /^INSERT INTO videos/);
  assert.match(s[1].sql, /^UPDATE links SET video_code/);
  assert.match(s[2].sql, /^DELETE FROM videos/);
});

test("clicks-db: the order holds across several pairs", () => {
  const s = planClicksDb([
    { oldCode: "aB3xY9", newKey: "one-video" },
    { oldCode: "zZ1qQ2", newKey: "two-video" },
  ]);
  assert.strictEqual(s.length, 6);
  for (const base of [0, 3]) {
    assert.match(s[base].sql, /^INSERT INTO videos/);
    assert.match(s[base + 1].sql, /^UPDATE links SET video_code/);
    assert.match(s[base + 2].sql, /^DELETE FROM videos/);
  }
  // every statement of a pair carries that pair's old code, never the other's
  assert.deepStrictEqual(s[2].params, ["aB3xY9"]);
  assert.deepStrictEqual(s[5].params, ["zZ1qQ2"]);
});

test("clicks-db: the new row is inserted before the old one is deleted", () => {
  const s = planClicksDb([{ oldCode: "aB3xY9", newKey: "best-ai-video-generator" }]);
  const insertAt = s.findIndex((st) => /^INSERT INTO videos/.test(st.sql));
  const updateAt = s.findIndex((st) => /^UPDATE links/.test(st.sql));
  const deleteAt = s.findIndex((st) => /^DELETE FROM videos/.test(st.sql));
  assert.ok(insertAt < updateAt, "INSERT must come before the links UPDATE");
  assert.ok(updateAt < deleteAt, "the links UPDATE must come before the DELETE");
});

test("clicks-db: never writes to clicks and never changes a link slug", () => {
  const s = planClicksDb([{ oldCode: "aB3xY9", newKey: "x" }]);
  for (const st of s) {
    assert.ok(!/\bclicks\b/i.test(st.sql), `statement touches clicks: ${st.sql}`);
    assert.ok(!/SET\s+slug\s*=/i.test(st.sql), `statement rewrites a link slug: ${st.sql}`);
  }
});

test("clicks-db: a code already canonical emits nothing", () => {
  assert.deepStrictEqual(planClicksDb([{ oldCode: "same-key", newKey: "same-key" }]), []);
});

test("desk: updates all three tables and never touches token", () => {
  const s = planDesk([{ oldKey: "old-slug", newKey: "new-slug" }]);
  assert.strictEqual(s.length, 3);
  assert.match(s[0].sql, /^UPDATE videos SET key/);
  assert.match(s[1].sql, /^UPDATE answers SET video_key/);
  assert.match(s[2].sql, /^UPDATE say_edits SET video_key/);
  for (const st of s) assert.ok(!/token/i.test(st.sql), `statement touches token: ${st.sql}`);
});

test("desk: a key already canonical emits nothing", () => {
  assert.deepStrictEqual(planDesk([{ oldKey: "same-key", newKey: "same-key" }]), []);
});

test("planners refuse an incomplete pair", () => {
  assert.throws(() => planClicksDb([{ oldCode: "", newKey: "x" }]));
  assert.throws(() => planClicksDb([{ oldCode: "x", newKey: "" }]));
  assert.throws(() => planDesk([{ oldKey: "x", newKey: "" }]));
  assert.throws(() => planDesk([{ oldKey: "", newKey: "x" }]));
});

// --- the unattended safety net: boss runs --apply with nobody watching ---

test("diffInvariants passes when every count held", () => {
  const counts = {};
  for (const q of INVARIANT_QUERIES) counts[q.label] = 7;
  assert.deepStrictEqual(diffInvariants(counts, { ...counts }), []);
});

test("diffInvariants refuses when a single click row moved", () => {
  const before = {}, after = {};
  for (const q of INVARIANT_QUERIES) { before[q.label] = 7; after[q.label] = 7; }
  const label = "clicks rows (must never change)";
  after[label] = 6;
  const v = diffInvariants(before, after);
  assert.strictEqual(v.length, 1);
  assert.deepStrictEqual(v[0], { label, before: 7, after: 6 });
});

test("diffInvariants refuses when a published link slug disappeared", () => {
  const before = {}, after = {};
  for (const q of INVARIANT_QUERIES) { before[q.label] = 7; after[q.label] = 7; }
  const label = "distinct link slugs (published URLs)";
  after[label] = 8;
  assert.deepStrictEqual(diffInvariants(before, after), [{ label, before: 7, after: 8 }]);
});

test("diffInvariants refuses a count it could not read at all", () => {
  const before = {};
  for (const q of INVARIANT_QUERIES) before[q.label] = 7;
  // an empty "after" means the post-apply read failed — that is drift, not a pass
  assert.strictEqual(diffInvariants(before, {}).length, INVARIANT_QUERIES.length);
});

test("findCollisions reports two old codes claiming one new key", () => {
  const c = findCollisions([
    { oldCode: "aB3xY9", newKey: "one-video" },
    { oldCode: "zZ1qQ2", newKey: "one-video" },
    { oldCode: "qQ7wW8", newKey: "two-video" },
  ]);
  assert.deepStrictEqual(c, [{ newKey: "one-video", olds: ["aB3xY9", "zZ1qQ2"] }]);
});

test("findCollisions is empty for a one-to-one mapping", () => {
  assert.deepStrictEqual(findCollisions([
    { oldCode: "aB3xY9", newKey: "one-video" },
    { oldCode: "zZ1qQ2", newKey: "two-video" },
  ]), []);
});

test("partitionCollisions never plans a blocked pair", () => {
  const pairs = [
    { oldCode: "aB3xY9", newKey: "one-video" },
    { oldCode: "zZ1qQ2", newKey: "one-video" },
    { oldCode: "qQ7wW8", newKey: "two-video" },
  ];
  const { safe, blocked, collisions } = partitionCollisions(pairs);
  assert.deepStrictEqual(safe, [{ oldCode: "qQ7wW8", newKey: "two-video" }]);
  assert.strictEqual(blocked.length, 2);
  assert.strictEqual(collisions.length, 1);
  // the whole point: no emitted statement ever merges the two claimants
  const sql = planClicksDb(safe).map((s) => JSON.stringify(s.params)).join(" ");
  assert.ok(!sql.includes("aB3xY9"));
  assert.ok(!sql.includes("zZ1qQ2"));
});

test("partitionCollisions passes a clean list through untouched", () => {
  const pairs = [{ oldKey: "old-slug", newKey: "new-slug" }];
  const { safe, blocked, collisions } = partitionCollisions(pairs);
  assert.deepStrictEqual(safe, pairs);
  assert.deepStrictEqual(blocked, []);
  assert.deepStrictEqual(collisions, []);
});
