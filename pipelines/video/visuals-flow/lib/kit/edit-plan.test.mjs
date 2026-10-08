import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateEditPlan, editPlanErrors, editPlanToTracks, resolveCanvas, DEFAULT_CANVAS, assembleEditPlan } from './index.mjs';

const card = (id, start, duration, extra = {}) => ({ kind: 'card', id, start, duration, src: `/r/${id}.mp4`, ...extra });
const plan = (clips, extra = {}) => ({ total: 60, clips, ...extra });

test('a well-formed plan validates', () => {
  const p = plan([
    { kind: 'footage', id: 'screen', src: '/s.mp4', offset: 1.5 },
    { kind: 'composition', id: 'opening', start: 0, end: 8, src: '/film.mp4', shadows: true },
    card('c1', 10, 4),
    card('o1', 11, 2, { layer: 'overlay', chroma: '0x00ff00' }),
    { kind: 'avatar', id: 'a1', start: 20, end: 30, src: '/a1.mp4' },
    { kind: 'avatar', id: 'p1', mode: 'panel', start: 21, end: 25, src: '/p1.mp4' },
  ]);
  assert.equal(validateEditPlan(p), p);
});

test('unknown kind is refused by name', () => {
  assert.throws(() => validateEditPlan(plan([{ kind: 'sticker', id: 'x', start: 0, end: 1, src: '/x' }])),
    /clip x: unknown kind "sticker" \(known: card, composition, footage, avatar, image, generated\)/);
});

test('reserved kinds are refused until implemented', () => {
  for (const kind of ['image', 'generated']) {
    assert.throws(() => validateEditPlan(plan([{ kind, id: 'g', start: 0, end: 1, src: '/g.png' }])),
      new RegExp(`clip g: kind "${kind}" is reserved and not implemented yet`));
  }
});

test('overlapping base clips are refused with both ids', () => {
  assert.throws(() => validateEditPlan(plan([card('c1', 10, 5), { kind: 'avatar', id: 'a1', start: 12, end: 20, src: '/a' }])),
    /overlapping base clips: c1 ends 15, a1 starts 12/);
});

test('overlays, side-by-side avatars and touching base clips are not overlaps', () => {
  assert.deepEqual(editPlanErrors(plan([
    card('c1', 10, 5),
    card('o1', 11, 3, { layer: 'overlay' }),
    { kind: 'avatar', id: 's1', mode: 'side', start: 10, end: 15, src: '/s' },
    { kind: 'avatar', id: 'b1', mode: 'bubble', start: 0, end: 60, src: '/b' },
    card('c2', 15, 5),
    card('c3', 19.97, 5),   // within the planner's 50ms tolerance
  ])), []);
});

test('a shadowing composition drops base clips that start inside it', () => {
  assert.deepEqual(editPlanErrors(plan([
    { kind: 'composition', id: 'opening', start: 0, end: 10, src: '/f.mp4', shadows: true },
    card('c1', 4, 3),
  ])), []);
  assert.deepEqual(editPlanErrors(plan([
    { kind: 'composition', id: 'mid', start: 20, end: 30, src: '/f.mp4', shadows: true },
    card('c1', 25, 3),
    card('c2', 12, 4),
  ])), []);
  assert.match(editPlanErrors(plan([card('c1', 4, 3, { shadows: true })])).join('\n'), /clip c1: shadows is for composition clips only/);
});

test('any number of compositions sit anywhere, touching is fine', () => {
  assert.deepEqual(editPlanErrors(plan([
    { kind: 'footage', id: 'bed', src: '/s.mp4' },
    { kind: 'composition', id: 'm01', start: 5, end: 9, src: '/m01.mp4' },
    { kind: 'composition', id: 'm02', start: 9, end: 12.5, src: '/m02.mp4' },
    card('c1', 13, 4),
    { kind: 'composition', id: 'm03', start: 40, duration: 6, src: '/m03.mp4' },
  ])), []);
});

test('a composition may not overlap another base clip, by name', () => {
  assert.match(editPlanErrors(plan([
    { kind: 'composition', id: 'm01', start: 5, end: 9, src: '/a.mp4' },
    { kind: 'composition', id: 'm02', start: 8, end: 12, src: '/b.mp4' },
  ])).join('\n'), /overlapping base clips: m01 ends 9, m02 starts 8/);
  assert.match(editPlanErrors(plan([
    card('c1', 10, 5),
    { kind: 'composition', id: 'm01', start: 12, end: 16, src: '/a.mp4' },
  ])).join('\n'), /overlapping base clips: c1 ends 15, m01 starts 12/);
  // Without shadows, a card cued inside a composition is a clash, not a silent drop.
  assert.match(editPlanErrors(plan([
    { kind: 'composition', id: 'm01', start: 0, end: 10, src: '/a.mp4' },
    card('c1', 4, 3),
  ])).join('\n'), /overlapping base clips: m01 ends 10, c1 starts 4/);
});

test('plan audio names its file or is left out', () => {
  assert.deepEqual(editPlanErrors(plan([], { audio: { src: '/vo/take-3.wav' } })), []);
  assert.match(editPlanErrors(plan([], { audio: {} })).join(), /audio.src must be a non-empty path/);
  assert.match(editPlanErrors(plan([], { audio: { src: '' } })).join(), /audio.src/);
});

test('missing src is refused, except a full avatar with a placeholder still', () => {
  assert.throws(() => validateEditPlan(plan([{ kind: 'card', id: 'c1', start: 0, duration: 2 }])), /clip c1: missing src/);
  assert.throws(() => validateEditPlan(plan([{ kind: 'footage', id: 'screen' }])), /clip screen: missing src/);
  assert.deepEqual(editPlanErrors(plan([{ kind: 'avatar', id: 'a1', start: 0, end: 5, placeholder: '/still.png' }])), []);
  assert.match(editPlanErrors(plan([{ kind: 'avatar', id: 'p1', mode: 'panel', start: 0, end: 5, placeholder: '/still.png' }])).join('\n'),
    /placeholder is only supported on a full avatar/);
});

test('timing must be start plus exactly one of end or duration', () => {
  const errs = editPlanErrors(plan([
    { kind: 'card', id: 'both', start: 0, end: 2, duration: 2, src: '/x' },
    { kind: 'card', id: 'neither', start: 0, src: '/x' },
    { kind: 'card', id: 'back', start: 5, end: 4, src: '/x' },
    { kind: 'footage', id: 'screen', src: '/s', start: 0 },
  ])).join('\n');
  assert.match(errs, /clip both: give exactly one of end or duration/);
  assert.match(errs, /clip neither: give exactly one of end or duration/);
  assert.match(errs, /clip back: ends at 4, not after its start 5/);
  assert.match(errs, /clip screen: footage is the bed and takes no start\/end\/duration/);
});

test('every problem is reported at once', () => {
  const errs = editPlanErrors({ total: 0, clips: [{ kind: 'nope', id: 'a' }, { kind: 'card', id: 'b', start: 0, duration: 1 }] });
  assert.equal(errs.length, 3);
});

test('canvas defaults to 1920x1080 at 30 and validates overrides', () => {
  assert.deepEqual(resolveCanvas(undefined), { w: 1920, h: 1080, fps: 30 });
  assert.equal(resolveCanvas(undefined), DEFAULT_CANVAS);
  assert.deepEqual(resolveCanvas({ w: 1080, h: 1920 }), { w: 1080, h: 1920, fps: 30 });
  assert.throws(() => resolveCanvas({ w: 1081 }), /w must be a positive even integer/);
  assert.match(editPlanErrors(plan([], { canvas: { fps: 0 } })).join('\n'), /fps must be a positive integer/);
});

test('tracks: cards keep their data and stated timing, avatars route by mode', () => {
  const t = editPlanToTracks(plan([
    { kind: 'footage', id: 'screen', src: '/s.mp4', offset: 2 },
    { kind: 'composition', id: 'opening', start: 0, end: 8, src: '/f.mp4', shadows: true },
    { kind: 'composition', id: 'm01', start: 50, duration: 4, src: '/m01.mp4' },
    card('c1', 10, 4.1, { data: { card: 'x/y', variables: { a: 1 } } }),
    card('o1', 11, 2, { layer: 'overlay', clearsCaptions: true }),
    { kind: 'avatar', id: 'a1', start: 20, end: 30, src: '/a1.mp4' },
    { kind: 'avatar', id: 'a2', start: 31, end: 40, placeholder: '/still.png' },
    { kind: 'avatar', id: 'p1', mode: 'panel', start: 21, end: 25, src: '/p1.mp4' },
    { kind: 'avatar', id: 's1', mode: 'side', start: 41, end: 45, src: '/s1.mp4' },
    { kind: 'avatar', id: 'b1', mode: 'bubble', start: 0, end: 60, src: '/b1.mp4' },
  ]));
  assert.deepEqual(t.resolved[0], { card: 'x/y', variables: { a: 1 }, id: 'c1', start: 10, duration: 4.1, placement: 'fullframe' });
  assert.equal(t.resolved[1].placement, 'overlay');
  assert.equal(t.resolved[1].clearsCaptions, true);
  assert.equal(t.cardSrc.get('c1'), '/r/c1.mp4');
  assert.deepEqual(t.avatarJobs.map((j) => [j.id, j.purpose, j.placeholder ?? false]), [['a1', 'avatar-full', false], ['a2', 'avatar-full', true]]);
  assert.equal(t.avatarJobs[1].placeholderFile, '/still.png');
  assert.deepEqual([t.panelJobs[0].id, t.sideJobs[0].id, t.cornerJobs[0].id], ['p1', 's1', 'b1']);
  assert.deepEqual(t.films, [
    { id: 'opening', start: 0, end: 8, src: '/f.mp4', shadows: true },
    { id: 'm01', start: 50, end: 54, src: '/m01.mp4', shadows: false }]);
  assert.equal(t.audio, null);
  assert.equal(editPlanToTracks(plan([], { audio: { src: '/a.wav' } })).audio, '/a.wav');
  assert.deepEqual([t.screen, t.screenOffset, t.base], ['/s.mp4', 2, 'screen']);
  assert.equal(editPlanToTracks(plan([card('c1', 0, 60)])).base, 'none');
});

test('assembleEditPlan validates before touching anything', async () => {
  await assert.rejects(assembleEditPlan(plan([{ kind: 'image', id: 'i', start: 0, end: 1, src: '/i.png' }]), { workdir: '/nonexistent' }),
    /invalid edit plan:\n  clip i: kind "image" is reserved/);
});

test('a vertical canvas assembles at its own size', { skip: spawnSync('ffmpeg', ['-version']).error ? 'ffmpeg not found' : false }, async () => {
  const wd = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-canvas-'));
  try {
    const ff = (args) => assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]).status, 0);
    const clip = path.join(wd, 'clip.mp4');
    ff(['-f', 'lavfi', '-i', 'color=c=blue:s=360x640:r=30', '-t', '2', '-pix_fmt', 'yuv420p', clip]);
    ff(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '2', '-q:a', '9', path.join(wd, 'vo.mp3')]);
    const out = path.join(wd, 'out.mp4');
    await assembleEditPlan({ total: 2, canvas: { w: 360, h: 640, fps: 30 }, clips: [card('c1', 0, 2, { src: clip })] },
      { workdir: wd, out, encoder: 'x264', captions: 'off', transitions: 'none', beats: 'off' });
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', out], { encoding: 'utf8' });
    assert.equal(probe.stdout.trim(), '360x640');
  } finally {
    fs.rmSync(wd, { recursive: true, force: true });
  }
});
