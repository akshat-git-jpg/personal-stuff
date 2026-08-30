import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry } from './channels.mjs';
import { knownAvatarSlugs, knownVoiceSlugs, profileFor, validateProfiles } from './profiles.mjs';

const base = () => JSON.parse(JSON.stringify(loadRegistry()));

test('the shipped profiles all resolve', () => {
  assert.deepEqual(validateProfiles(), []);
});

test('the asset catalogues are non-empty', () => {
  // An empty catalogue makes every membership check vacuously pass. That is a
  // disarmed gate, not a passing one.
  assert.ok(knownVoiceSlugs().length >= 3, 'voice catalogue parsed empty');
  assert.ok(knownAvatarSlugs().length >= 3, 'avatar registry parsed empty');
});

test('profileFor returns the block', () => {
  assert.equal(profileFor('agrollo').brand, 'default');
});

test('an unknown avatar is rejected', () => {
  const reg = base();
  reg.channels[0].profile.avatar_slug = 'not-a-real-avatar';
  assert.ok(validateProfiles(reg).some((e) => e.startsWith('PROFILE_AVATAR_UNKNOWN')));
});

test('an unknown voice is rejected', () => {
  const reg = base();
  reg.channels[0].profile.voice_slug = 'not-a-real-voice';
  assert.ok(validateProfiles(reg).some((e) => e.startsWith('PROFILE_VOICE_UNKNOWN')));
});

test('a brand with no file is rejected', () => {
  const reg = base();
  reg.channels[0].profile.brand = 'nonexistent-brand';
  assert.ok(validateProfiles(reg).some((e) => e.startsWith('PROFILE_BRAND_UNRESOLVED')));
});

test('a missing taste file is rejected', () => {
  const reg = base();
  reg.channels[0].profile.taste_file = 'pipelines/nope/TASTE.md';
  assert.ok(validateProfiles(reg).some((e) => e.startsWith('PROFILE_TASTE_FILE_MISSING')));
});

test('a style_dna path that does not exist is rejected', () => {
  const reg = base();
  reg.channels[0].profile.style_dna = 'pipelines/nope/dna.md';
  assert.ok(validateProfiles(reg).some((e) => e.startsWith('PROFILE_STYLE_DNA_MISSING')));
});

test('null style_dna is allowed', () => {
  const reg = base();
  reg.channels[0].profile.style_dna = null;
  assert.deepEqual(validateProfiles(reg), []);
});

test('a channel with no profile block is rejected', () => {
  const reg = base();
  delete reg.channels[0].profile;
  assert.ok(validateProfiles(reg).some((e) => e.startsWith('PROFILE_MISSING')));
});
