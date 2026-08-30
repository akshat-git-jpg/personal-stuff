import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, validate, listChannels, getChannel, defaultChannel } from './channels.mjs';

const base = () => JSON.parse(JSON.stringify(loadRegistry()));

test('the shipped registry is valid', () => {
  assert.deepEqual(validate(), []);
});

test('agrollo is present and owns go.agrolloo.com', () => {
  const c = getChannel('agrollo');
  assert.equal(c.link_domain, 'go.agrolloo.com');
  assert.equal(c.youtube_channel_id, 'UCXuXNNuyhtdsiw9bZr0pUxw');
  assert.equal(c.archived, false);
});

test('the default channel resolves', () => {
  assert.equal(defaultChannel().id, loadRegistry().default_channel_id);
});

test('listChannels hides archived channels', () => {
  const reg = base();
  reg.channels[0].archived = true;
  assert.equal(listChannels(reg).length, 0);
});

test('an unknown default is rejected', () => {
  const reg = base();
  reg.default_channel_id = 'nope';
  assert.ok(validate(reg).some((e) => e.startsWith('CHANNEL_DEFAULT_UNKNOWN')));
});

test('two channels cannot share a link_domain', () => {
  const reg = base();
  reg.channels.push({ ...reg.channels[0], id: 'other', youtube_channel_id: 'UCaaaaaaaaaaaaaaaaaaaaaa' });
  assert.ok(validate(reg).some((e) => e.startsWith('CHANNEL_DOMAIN_DUPLICATE')));
});

test('two channels cannot share a youtube_channel_id', () => {
  const reg = base();
  reg.channels.push({ ...reg.channels[0], id: 'other', link_domain: 'go.example.com', zone_name: 'example.com' });
  assert.ok(validate(reg).some((e) => e.startsWith('CHANNEL_YT_ID_DUPLICATE')));
});

test('a malformed youtube_channel_id is rejected', () => {
  const reg = base();
  reg.channels[0].youtube_channel_id = 'UCtooshort';
  assert.ok(validate(reg).some((e) => e.startsWith('CHANNEL_YT_ID_INVALID')));
});

test('a link_domain outside its zone is rejected', () => {
  const reg = base();
  reg.channels[0].link_domain = 'go.elsewhere.com';
  assert.ok(validate(reg).some((e) => e.startsWith('CHANNEL_ZONE_MISMATCH')));
});

test('a channel with no owner account is rejected', () => {
  const reg = base();
  reg.channels[0].owner_account = '';
  assert.ok(validate(reg).some((e) => e.startsWith('CHANNEL_OWNER_INVALID')));
});

test('getChannel throws on an unknown id', () => {
  assert.throws(() => getChannel('missing'), /CHANNEL_UNKNOWN/);
});
