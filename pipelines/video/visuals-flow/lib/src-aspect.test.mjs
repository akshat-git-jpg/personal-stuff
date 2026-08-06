import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { probeSrcAspect, planPanelGeometry, planSideGeometry, CANVAS } from './assemble.mjs';
import { SHOT_CONSTANTS } from './shot-constants.mjs';

// Guards for the srcAspect regression: the geometry planners accepted srcAspect
// from the day they were written and no caller passed it, so a portrait 9:16
// HeyGen render was stretched 3.16x wide before cropping (decisions.md
// 2026-08-03 named this the blocking prerequisite for portrait sources).
//
// These tests exist because the integration fixtures CANNOT catch it: they
// composite solid-colour clips, and a blue rectangle stretched 3.16x is still a
// blue rectangle. Every assertion here is on a shape RATIO, so it fails if the
// aspect is dropped again regardless of the constants' values.

const TMP = path.join(import.meta.dirname, '.test-tmp', 'src-aspect');
const haveFfmpeg = !spawnSync('ffmpeg', ['-version']).error;

test.before(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
});

function makeClip(name, size) {
  const file = path.join(TMP, name);
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=blue:s=${size}:r=30`,
    '-t', '1', '-pix_fmt', 'yuv420p', file]);
  return file;
}

test('probeSrcAspect reads a PORTRAIT source as 9:16', { skip: haveFfmpeg ? false : 'ffmpeg not found' }, () => {
  const file = makeClip('portrait.mp4', '1080x1920');
  assert.ok(Math.abs(probeSrcAspect(file, { cache: new Map() }) - 1080 / 1920) < 1e-6);
});

test('probeSrcAspect reads a LANDSCAPE source as 16:9', { skip: haveFfmpeg ? false : 'ffmpeg not found' }, () => {
  const file = makeClip('landscape.mp4', '1920x1080');
  assert.ok(Math.abs(probeSrcAspect(file, { cache: new Map() }) - 16 / 9) < 1e-6);
});

// A missing clip must not take down an assembly that would otherwise succeed.
test('probeSrcAspect falls back to 16:9 on an unreadable file', () => {
  const missing = path.join(TMP, 'does-not-exist.mp4');
  assert.equal(probeSrcAspect(missing, { cache: new Map() }), 16 / 9);
});

test('probeSrcAspect memoises per file — one probe for repeated asks', () => {
  let calls = 0;
  const run = () => { calls++; return { stdout: '1080x1920' }; };
  const cache = new Map();
  const a = probeSrcAspect('/fake/clip.mp4', { run, cache });
  const b = probeSrcAspect('/fake/clip.mp4', { run, cache });
  assert.equal(calls, 1, 'the overlay loop asks per segment per overlay — probing every time adds a process per composite');
  assert.equal(a, b);
});

// THE BUG ITSELF, stated as a shape: a portrait source must produce a panel
// TALLER than it is wide. Under the dropped-aspect default it came out wide.
test('planPanelGeometry: a portrait source yields a portrait panel', () => {
  const portrait = planPanelGeometry({ canvas: CANVAS, constants: SHOT_CONSTANTS, srcAspect: 1080 / 1920 });
  const landscape = planPanelGeometry({ canvas: CANVAS, constants: SHOT_CONSTANTS, srcAspect: 16 / 9 });
  assert.ok(portrait.h > portrait.w, `portrait source must give a portrait panel, got ${portrait.w}x${portrait.h}`);
  assert.ok(landscape.h < landscape.w, `landscape source must give a landscape panel, got ${landscape.w}x${landscape.h}`);
});

test('planPanelGeometry: panel aspect tracks the source aspect', () => {
  for (const src of [1080 / 1920, 16 / 9, 1, 4 / 3]) {
    const g = planPanelGeometry({ canvas: CANVAS, constants: SHOT_CONSTANTS, srcAspect: src });
    // Even-rounding both dimensions costs at most 1px each, so compare loosely.
    assert.ok(Math.abs(g.w / g.h - src) < 0.02, `panel ${g.w}x${g.h} does not preserve srcAspect ${src}`);
  }
});

test('planPanelGeometry: the panel stays inside the canvas for a portrait source', () => {
  const g = planPanelGeometry({ canvas: CANVAS, constants: SHOT_CONSTANTS, srcAspect: 1080 / 1920 });
  assert.ok(g.x >= 0 && g.y >= 0, `panel origin off-canvas: ${g.x},${g.y}`);
  assert.ok(g.x + g.w <= CANVAS.w && g.y + g.h <= CANVAS.h,
    `panel ${g.w}x${g.h} at ${g.x},${g.y} overflows ${CANVAS.w}x${CANVAS.h}`);
});

test('planPanelGeometry: both dimensions stay even for yuv420p', () => {
  for (const src of [1080 / 1920, 16 / 9, 1]) {
    const g = planPanelGeometry({ canvas: CANVAS, constants: SHOT_CONSTANTS, srcAspect: src });
    assert.equal(g.w % 2, 0, `odd width ${g.w} is rejected by yuv420p`);
    assert.equal(g.h % 2, 0, `odd height ${g.h} is rejected by yuv420p`);
  }
});

// decisions.md 2026-08-03: side mode's 720x1080 column loses only ~16% of a
// PORTRAIT source but 62.5% of a landscape one. That asymmetry only shows up if
// srcAspect actually reaches the planner.
test('planSideGeometry: a portrait source is cropped far less than a landscape one', () => {
  const kept = (srcAspect) => {
    const g = planSideGeometry({ canvas: CANVAS, constants: SHOT_CONSTANTS, srcAspect });
    return (g.cropW * g.cropH) / (g.scaleW * g.scaleH);
  };
  const portraitKept = kept(1080 / 1920);
  const landscapeKept = kept(16 / 9);
  assert.ok(portraitKept > landscapeKept,
    `portrait should survive the side column better: portrait kept ${portraitKept}, landscape kept ${landscapeKept}`);
  assert.ok(portraitKept > 0.75, `expected a portrait source to keep most of its frame, kept ${portraitKept}`);
});

// EVERY test above calls the planners directly, so they all pass even when no
// caller passes srcAspect — which is precisely the bug that shipped. The
// planners were never wrong; the four call sites were. So the call sites get
// pinned as source, the same way the renderer pin is: it is a blunt assertion,
// but it is the one that actually fails when the argument is dropped again.
test('every planPanelGeometry/planSideGeometry call site passes srcAspect', () => {
  const ROOT = path.resolve(import.meta.dirname);
  const files = ['assemble.mjs', 'export-timeline.mjs'];
  const offenders = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      // A CALL, not the definition or an import.
      if (!/\b(planPanelGeometry|planSideGeometry)\s*\(\s*\{/.test(line)) return;
      if (/^\s*export function/.test(line)) return;
      if (!/srcAspect/.test(line)) offenders.push(`${f}:${i + 1}`);
    });
  }
  assert.deepStrictEqual(
    offenders, [],
    `these call sites drop srcAspect and will silently stretch a portrait source: ${offenders.join(', ')}`
  );
});

test('planSideGeometry: the crop always covers the column with no letterbox', () => {
  for (const src of [1080 / 1920, 16 / 9, 1, 4 / 3]) {
    const g = planSideGeometry({ canvas: CANVAS, constants: SHOT_CONSTANTS, srcAspect: src });
    assert.ok(g.scaleW >= g.cropW, `scaled width ${g.scaleW} cannot fill crop ${g.cropW} (srcAspect ${src})`);
    assert.ok(g.scaleH >= g.cropH, `scaled height ${g.scaleH} cannot fill crop ${g.cropH} (srcAspect ${src})`);
    assert.ok(g.cropX >= 0 && g.cropY >= 0, `negative crop offset at srcAspect ${src}`);
  }
});
