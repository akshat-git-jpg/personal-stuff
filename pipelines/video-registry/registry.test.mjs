import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resolveKey, mint, addAlias, list, save, load, isValidKey, namesFor,
  ensure, whereIs, unregisteredDirs, PIPELINE_VIDEO_ROOTS,
} from './lib/registry.mjs';

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
  const spots = whereIs('best-ai-video-generator');
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
