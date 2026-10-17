import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bridgeEditPlan, localAvatarFile } from './edit-plan.mjs';

const write = (dir, name, data) => {
  fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
  fs.writeFileSync(path.join(dir, name), typeof data === 'string' ? data : JSON.stringify(data));
};

function workdir({ shotsApproved = true, jobs, intro = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-plan-'));
  write(dir, 'vo.mp3', '');
  write(dir, 'screen.mp4', '');
  write(dir, 'resolved.json', { video: 'demo', resolved: [
    { id: 'c01', card: 'tool-icon/tool-glass-tile', placement: 'fullframe', start: 20, duration: 6, variables: { name: 'n8n' } },
    { id: 'c02', card: 'callout/lower-third', placement: 'overlay', start: 40, duration: 4, variables: { text: 'Hi' } },
  ] });
  write(dir, 'shots.json', { approved: shotsApproved, spans: [] });
  write(dir, 'avatar-jobs.json', { template: 'specs-man', jobs: jobs ?? [
    { id: 's01', purpose: 'avatar-full', start: 30, end: 36, file: path.join(dir, 's01.mp4') },
  ] });
  write(dir, 's01.mp4', '');
  if (intro) {
    write(dir, 'segments.json', { structure: [{ part: 'intro', start: 0, end: 10 }, { part: 'body', start: 10, end: 100 }] });
    write(dir, 'intro-film/out/intro.mp4', '');
  }
  return dir;
}

const probe = () => 120;

test('cards, avatars, footage and audio come from the workdir, at 25 fps', () => {
  const dir = workdir();
  const { plan, warnings, video } = bridgeEditPlan(dir, { probe });
  assert.equal(video, 'demo');
  assert.deepEqual(warnings, []);
  assert.equal(plan.total, 120);
  assert.deepEqual(plan.canvas, { w: 1920, h: 1080, fps: 25 });
  assert.equal(plan.audio.src, path.join(dir, 'vo.mp3'));
  const byId = Object.fromEntries(plan.clips.map((c) => [`${c.kind}:${c.id}`, c]));
  assert.equal(byId['footage:screen'].src, path.join(dir, 'screen.mp4'));
  assert.equal(byId['card:c01'].layer, 'base');
  assert.equal(byId['card:c02'].layer, 'overlay');
  assert.equal(byId['card:c01'].data.card, 'tool-icon/tool-glass-tile');
  assert.deepEqual(byId['card:c02'].data.variables, { text: 'Hi' });
  assert.equal(byId['avatar:s01'].mode, 'full');
  assert.equal(byId['avatar:s01'].start, 30);
});

test('refuses while the storyboard is not approved', () => {
  assert.throws(() => bridgeEditPlan(workdir({ shotsApproved: false }), { probe }), /storyboard is not approved/);
});

test('a Windows job path is found in the local heygen folder', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-home-'));
  write(home, 'kb-scratch/video/heygen/visuals-flow/demo/s01.mp4', '');
  const job = { file: 'C:\\Users\\kushi\\kb-scratch\\video\\heygen\\visuals-flow\\demo\\s01.mp4' };
  assert.equal(localAvatarFile(job, 'demo', home), path.join(home, 'kb-scratch/video/heygen/visuals-flow/demo/s01.mp4'));
});

test('an avatar clip that is not on this machine is skipped with a warning', () => {
  const dir = workdir({ jobs: [{ id: 's09', purpose: 'avatar-full', start: 50, end: 60, file: 'C:\\nowhere\\s09.mp4' }] });
  const { plan, warnings } = bridgeEditPlan(dir, { probe, home: os.tmpdir() });
  assert.equal(plan.clips.some((c) => c.kind === 'avatar'), false);
  assert.match(warnings[0], /s09/);
});

test('the intro film is a composition clip when its mp4 exists', () => {
  const { plan } = bridgeEditPlan(workdir({ intro: true }), { probe });
  const film = plan.clips.find((c) => c.kind === 'composition');
  assert.deepEqual([film.start, film.end], [0, 10]);
});

// Media is gitignored, so a workspace checkout points this at the main checkout's workdir.
const real = process.env.BRIDGE_REAL_WORKDIR ?? path.resolve(import.meta.dirname, '..', '..', 'videos', 'opusclip-vs-submagic');
test('real workdir: opusclip-vs-submagic', { skip: !fs.existsSync(path.join(real, 'vo.mp3')) && 'media not on this machine' }, () => {
  const { plan } = bridgeEditPlan(real);
  assert.equal(plan.clips.filter((c) => c.kind === 'card').length, 38);
  assert.equal(plan.clips.filter((c) => c.kind === 'avatar').length, 10);
});

test('CLI prints the plan as JSON, and the reason on a refusal', async () => {
  const { spawnSync } = await import('node:child_process');
  const cli = path.join(import.meta.dirname, 'edit-plan.mjs');
  const bad = spawnSync(process.execPath, [cli, workdir({ shotsApproved: false })], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /storyboard is not approved/);
});
